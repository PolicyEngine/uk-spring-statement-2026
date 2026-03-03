"""Data generation pipeline for UK Spring Statement 2026 dashboard.

Runs all calculators for each year and saves output to public/data/.
"""

import json
from pathlib import Path

import h5py
import numpy as np
import pandas as pd
from huggingface_hub import hf_hub_download

from .calculators import (
    ConstituencyCalculator,
    DetailedBudgetaryImpactCalculator,
    DistributionalImpactCalculator,
    HouseholdScatterCalculator,
    InequalityCalculator,
    IntraDecileCalculator,
    MetricsCalculator,
    WinnersLosersCalculator,
)
from .reforms import (
    DEFAULT_YEARS,
    generate_economic_forecast_json,
    get_pre_statement_scenario,
    get_real_deflator,
    save_economic_forecast_json,
)

# HuggingFace repo for data files
HF_REPO = "policyengine/policyengine-uk-data"

# Default output directory
DEFAULT_OUTPUT_DIR = Path("public/data")


def _get_constituency_files() -> tuple[str, str]:
    """Download parliamentary constituency files from HuggingFace."""
    weights_path = hf_hub_download(
        HF_REPO, "parliamentary_constituency_weights.h5"
    )
    csv_path = hf_hub_download(
        HF_REPO, "parliamentary_constituencies_2025.csv"
    )
    return weights_path, csv_path


def _save_csv(df: pd.DataFrame, path: Path) -> None:
    """Save DataFrame to CSV, creating parent directories if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    print(f"Saved: {path}")


def generate_all_data(
    output_dir: Path = None,
    years: list[int] = None,
) -> dict[str, pd.DataFrame]:
    """Generate all dashboard data."""
    output_dir = output_dir or DEFAULT_OUTPUT_DIR
    years = years or DEFAULT_YEARS

    # Economic forecast JSON
    save_economic_forecast_json(output_dir / "economic_forecast.json")

    # Calculators
    distributional_calc = DistributionalImpactCalculator()
    metrics_calc = MetricsCalculator()
    winners_losers_calc = WinnersLosersCalculator()
    scatter_calc = HouseholdScatterCalculator()
    constituency_calc = ConstituencyCalculator()
    inequality_calc = InequalityCalculator()
    intra_decile_calc = IntraDecileCalculator()
    detailed_budget_calc = DetailedBudgetaryImpactCalculator()

    # Download constituency data
    constituency_weights = None
    constituency_df = None

    try:
        weights_path, csv_path = _get_constituency_files()
        print("Downloaded constituency files from HuggingFace")

        with h5py.File(weights_path, "r") as f:
            keys = sorted(f.keys())
            constituency_weights = f[keys[-1]][...]
        constituency_df = pd.read_csv(csv_path)
        print(f"Loaded {len(constituency_df)} constituencies")
    except Exception as e:
        print(f"Warning: Could not load constituency data: {e}")

    # Aggregate results
    all_distributional = []
    all_metrics = []
    all_winners_losers = []
    all_constituency = []
    all_inequality = []
    all_intra_decile = []
    all_detailed_budget = []
    scatter_df = None

    for year in years:
        print(f"\nYear {year}...")

        distributional = distributional_calc.calculate(year)
        all_distributional.extend(distributional)

        metrics = metrics_calc.calculate(year)
        all_metrics.extend(metrics)

        winners_losers = winners_losers_calc.calculate(year)
        all_winners_losers.extend(winners_losers)

        inequality = inequality_calc.calculate(year)
        all_inequality.extend(inequality)

        intra_decile = intra_decile_calc.calculate(year)
        all_intra_decile.extend(intra_decile)

        detailed_budget = detailed_budget_calc.calculate(year)
        all_detailed_budget.extend(detailed_budget)

        if scatter_df is None:
            scatter_df = scatter_calc.calculate(year)

        if constituency_weights is not None and constituency_df is not None:
            constituency = constituency_calc.calculate(
                year, constituency_weights, constituency_df
            )
            all_constituency.extend(constituency)

        print(f"  Done: {year}")

    # Build DataFrames
    results = {
        "distributional_impact": pd.DataFrame(all_distributional),
        "metrics": pd.DataFrame(all_metrics),
        "winners_losers": pd.DataFrame(all_winners_losers),
        "inequality": pd.DataFrame(all_inequality),
        "intra_decile": pd.DataFrame(all_intra_decile),
        "detailed_budgetary_impact": pd.DataFrame(all_detailed_budget),
        "household_scatter": (
            scatter_df if scatter_df is not None else pd.DataFrame()
        ),
        "constituency": pd.DataFrame(all_constituency),
    }

    # Save to CSV
    for name, df in results.items():
        if len(df) > 0:
            _save_csv(df, output_dir / f"{name}.csv")

    # Household archetypes (stats + comparison JSONs)
    _generate_household_archetypes(output_dir, year=2029)

    print(f"\nAll data saved to {output_dir}/")
    return results


# Household type classification
_HH_GROUPS = [
    "Single adult, no children",
    "Couple, no children",
    "Single parent",
    "Couple with children",
    "Single pensioner",
    "Pensioner couple",
]


def _classify_household(sim, year):
    """Return an array classifying each household into an archetype group.

    All variables mapped to household level for consistent shapes.
    """
    # num_adults/num_children are benunit-level; map to household
    n_adults = np.array(sim.calculate("num_adults", year, map_to="household"))
    n_children = np.array(sim.calculate("num_children", year, map_to="household"))
    # is_SP_age is person-level; map_to="household" gives max across members
    is_sp_age = np.array(
        sim.calculate("is_SP_age", year, map_to="household")
    ).astype(bool)

    groups = np.full(len(n_adults), "", dtype=object)
    groups[(n_adults == 1) & (n_children == 0) & (~is_sp_age)] = "Single adult, no children"
    groups[(n_adults >= 2) & (n_children == 0) & (~is_sp_age)] = "Couple, no children"
    groups[(n_adults == 1) & (n_children > 0)] = "Single parent"
    groups[(n_adults >= 2) & (n_children > 0)] = "Couple with children"
    groups[(n_adults == 1) & (n_children == 0) & is_sp_age] = "Single pensioner"
    groups[(n_adults >= 2) & (n_children == 0) & is_sp_age] = "Pensioner couple"
    return groups


def _generate_household_archetypes(output_dir: Path, year: int = 2029):
    """Generate household_stats.json and household_comparison.json (real terms)."""
    from policyengine_uk import Microsimulation
    import microdf as mdf

    deflator = get_real_deflator(year)
    scenario = get_pre_statement_scenario()
    baseline = Microsimulation(scenario=scenario)
    reformed = Microsimulation()

    groups = _classify_household(baseline, year)
    baseline_hnet = baseline.calculate("household_net_income", year)
    reform_hnet_raw = reformed.calculate("household_net_income", year)
    # Deflate reform to baseline prices
    reform_hnet = mdf.MicroSeries(
        reform_hnet_raw.values * deflator, weights=baseline_hnet.weights
    )
    weights = np.array(baseline_hnet.weights)

    stats = []
    comparison = []

    for group in _HH_GROUPS:
        mask = groups == group
        if not mask.any():
            continue

        b_inc = baseline_hnet[mask]
        r_inc = reform_hnet[mask]
        w = weights[mask]

        mean_b = float(b_inc.mean())
        mean_r = float(r_inc.mean())
        median_b = float(b_inc.median())
        weighted_n = float(w.sum())

        stats.append({
            "group": group,
            "mean_hnet": round(mean_b),
            "median_hnet": round(median_b),
            "weighted_n": round(weighted_n),
        })
        comparison.append({
            "group": group,
            "baseline_hnet": round(mean_b),
            "reformed_hnet": round(mean_r),
            "change": round(mean_r - mean_b),
        })

    output_dir.mkdir(parents=True, exist_ok=True)
    with open(output_dir / "household_stats.json", "w") as f:
        json.dump(stats, f, indent=2)
    print(f"Saved: {output_dir / 'household_stats.json'}")
    with open(output_dir / "household_comparison.json", "w") as f:
        json.dump(comparison, f, indent=2)
    print(f"Saved: {output_dir / 'household_comparison.json'}")


if __name__ == "__main__":
    generate_all_data()
