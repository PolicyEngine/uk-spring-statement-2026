"""Data generation pipeline for UK Spring Statement 2026 dashboard.

Runs all calculators for each year and saves output to public/data/.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .calculators import (
    DistributionalImpactCalculator,
    InequalityCalculator,
    MetricsCalculator,
    WinnersLosersCalculator,
    _create_simulations,
)
from .reforms import (
    DEFAULT_YEARS,
    save_economic_forecast_json,
)
from .spring_statement import (
    _compute_decomposition,
    PROGRAM_STRUCTURE,
    PERSON_VARS,
    BENUNIT_VARS,
    HOUSEHOLD_VARS,
)

# Default output directory
DEFAULT_OUTPUT_DIR = Path("public/data")


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
    inequality_calc = InequalityCalculator()

    # Aggregate results
    all_distributional = []
    all_metrics = []
    all_winners_losers = []
    all_inequality = []

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

        print(f"  Done: {year}")

    # Build DataFrames
    results = {
        "distributional_impact": pd.DataFrame(all_distributional),
        "metrics": pd.DataFrame(all_metrics),
        "winners_losers": pd.DataFrame(all_winners_losers),
        "inequality": pd.DataFrame(all_inequality),
    }

    # Save to CSV
    for name, df in results.items():
        if len(df) > 0:
            _save_csv(df, output_dir / f"{name}.csv")

    # Household archetypes (stats + comparison JSONs)
    _generate_household_archetypes(output_dir, years=years)

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


def _generate_household_archetypes(output_dir: Path, years: list[int] = None):
    """Generate household decomposition JSON for all years.

    Output: household_decomposition.json — decomposition per group per year.
    """
    import microdf as mdf

    if years is None:
        years = DEFAULT_YEARS

    baseline, reformed = _create_simulations()

    all_decomposition = []

    for year in years:
        print(f"  Household archetypes: {year}...")
        groups = _classify_household(baseline, year)
        baseline_hnet = baseline.calculate("household_net_income", year)
        reform_hnet_raw = reformed.calculate("household_net_income", year)

        # Align reform weights to baseline
        reform_hnet_nominal = mdf.MicroSeries(
            reform_hnet_raw.values, weights=baseline_hnet.weights
        )
        weights = np.array(baseline_hnet.weights)

        # Market income: employment + self-employment, mapped to household
        market_b = np.array(
            baseline.calculate("employment_income", year, map_to="household")
        ) + np.array(
            baseline.calculate("self_employment_income", year, map_to="household")
        )
        market_r = np.array(
            reformed.calculate("employment_income", year, map_to="household")
        ) + np.array(
            reformed.calculate("self_employment_income", year, map_to="household")
        )

        # Taxes & benefits from PROGRAM_STRUCTURE
        taxes_b = np.zeros(len(weights))
        taxes_r = np.zeros(len(weights))
        benefits_b = np.zeros(len(weights))
        benefits_r = np.zeros(len(weights))
        for prog in PROGRAM_STRUCTURE:
            pid = prog["id"]
            try:
                arr_b = np.array(baseline.calculate(pid, year, map_to="household"))
                arr_r = np.array(reformed.calculate(pid, year, map_to="household"))
            except (ValueError, Exception):
                continue
            if prog.get("is_tax", False):
                taxes_b += arr_b
                taxes_r += arr_r
            else:
                benefits_b += arr_b
                benefits_r += arr_r

        for group in _HH_GROUPS:
            mask = groups == group
            if not mask.any():
                continue

            w = weights[mask]
            weighted_n = float(w.sum())

            # Weighted means
            def _wmean(arr):
                return float(np.average(arr[mask], weights=w))

            mean_b = _wmean(np.array(baseline_hnet))
            mean_r_nom = _wmean(np.array(reform_hnet_nominal))
            mean_market_b = _wmean(market_b)
            mean_market_r = _wmean(market_r)
            mean_taxes_b = _wmean(taxes_b)
            mean_taxes_r = _wmean(taxes_r)
            mean_benefits_b = _wmean(benefits_b)
            mean_benefits_r = _wmean(benefits_r)

            decomposition = _compute_decomposition(
                mean_b,
                mean_r_nom,
                mean_taxes_b,
                mean_taxes_r,
                mean_benefits_b,
                mean_benefits_r,
                mean_market_b,
                mean_market_r,
                year,
            )

            all_decomposition.append({
                "year": year,
                "group": group,
                "weighted_n": round(weighted_n),
                "decomposition": decomposition,
            })

    output_dir.mkdir(parents=True, exist_ok=True)
    with open(output_dir / "household_decomposition.json", "w") as f:
        json.dump(all_decomposition, f, indent=2)
    print(f"Saved: {output_dir / 'household_decomposition.json'}")


if __name__ == "__main__":
    generate_all_data()
