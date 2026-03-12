"""Data generation pipeline for UK Spring Statement 2026 dashboard.

Runs all calculators for each year and saves output to public/data/.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .calculators import (
    COUNTRIES,
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
        for country in COUNTRIES:
            print(f"\nYear {year}, country {country}...")

            distributional = distributional_calc.calculate(year, country=country)
            all_distributional.extend(distributional)

            metrics = metrics_calc.calculate(year, country=country)
            all_metrics.extend(metrics)

            winners_losers = winners_losers_calc.calculate(year, country=country)
            all_winners_losers.extend(winners_losers)

            inequality = inequality_calc.calculate(year, country=country)
            all_inequality.extend(inequality)

            print(f"  Done: {year} / {country}")

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
    """Generate household decomposition JSON for all years and countries.

    Output: household_decomposition.json — decomposition per group per year per country.
    """
    import microdf as mdf
    from .calculators import _get_country_mask

    if years is None:
        years = DEFAULT_YEARS

    baseline, reformed = _create_simulations()

    all_decomposition = []

    for year in years:
        # Pre-compute all household-level arrays once per year
        groups = _classify_household(baseline, year)
        baseline_hnet = baseline.calculate("household_net_income", year)
        reform_hnet_raw = reformed.calculate("household_net_income", year)
        reform_hnet_nominal = mdf.MicroSeries(
            reform_hnet_raw.values, weights=baseline_hnet.weights
        )
        all_weights = np.array(baseline_hnet.weights)

        market_b = np.array(baseline.calculate("household_market_income", year))
        market_r = np.array(reformed.calculate("household_market_income", year))
        taxes_b = np.array(baseline.calculate("household_tax", year))
        taxes_r = np.array(reformed.calculate("household_tax", year))
        benefits_b = np.array(baseline.calculate("household_benefits", year))
        benefits_r = np.array(reformed.calculate("household_benefits", year))
        pension_contrib_b = np.array(
            baseline.calculate("pension_contributions", year, map_to="household")
        )
        pension_contrib_r = np.array(
            reformed.calculate("pension_contributions", year, map_to="household")
        )

        for country in COUNTRIES:
            print(f"  Household archetypes: {year} / {country}...")
            country_mask = _get_country_mask(baseline, year, country)

            # Apply country filter
            if country_mask is not None:
                idx = country_mask
                c_groups = groups[idx]
                c_weights = all_weights[idx]
                c_baseline_hnet = np.array(baseline_hnet)[idx]
                c_reform_hnet = np.array(reform_hnet_nominal)[idx]
                c_market_b = market_b[idx]
                c_market_r = market_r[idx]
                c_taxes_b = taxes_b[idx]
                c_taxes_r = taxes_r[idx]
                c_benefits_b = benefits_b[idx]
                c_benefits_r = benefits_r[idx]
                c_pc_b = pension_contrib_b[idx]
                c_pc_r = pension_contrib_r[idx]
            else:
                c_groups = groups
                c_weights = all_weights
                c_baseline_hnet = np.array(baseline_hnet)
                c_reform_hnet = np.array(reform_hnet_nominal)
                c_market_b = market_b
                c_market_r = market_r
                c_taxes_b = taxes_b
                c_taxes_r = taxes_r
                c_benefits_b = benefits_b
                c_benefits_r = benefits_r
                c_pc_b = pension_contrib_b
                c_pc_r = pension_contrib_r

            for group in _HH_GROUPS:
                mask = c_groups == group
                if not mask.any():
                    continue

                w = c_weights[mask]
                weighted_n = float(w.sum())

                def _wmean(arr, _mask=mask, _w=w):
                    return float(np.average(arr[_mask], weights=_w))

                decomposition = _compute_decomposition(
                    _wmean(c_baseline_hnet),
                    _wmean(c_reform_hnet),
                    _wmean(c_taxes_b),
                    _wmean(c_taxes_r),
                    _wmean(c_benefits_b),
                    _wmean(c_benefits_r),
                    _wmean(c_market_b),
                    _wmean(c_market_r),
                    year,
                    pension_contrib_b=_wmean(c_pc_b),
                    pension_contrib_r=_wmean(c_pc_r),
                )

                all_decomposition.append({
                    "year": year,
                    "country": country,
                    "group": group,
                    "weighted_n": round(weighted_n),
                    "decomposition": decomposition,
                })

            # "All households" aggregate for this country
            def _wmean_all(arr, _w=c_weights):
                return float(np.average(arr, weights=_w))

            all_decomposition.append({
                "year": year,
                "country": country,
                "group": "All households",
                "weighted_n": round(float(c_weights.sum())),
                "decomposition": _compute_decomposition(
                    _wmean_all(c_baseline_hnet),
                    _wmean_all(c_reform_hnet),
                    _wmean_all(c_taxes_b),
                    _wmean_all(c_taxes_r),
                    _wmean_all(c_benefits_b),
                    _wmean_all(c_benefits_r),
                    _wmean_all(c_market_b),
                    _wmean_all(c_market_r),
                    year,
                    pension_contrib_b=_wmean_all(c_pc_b),
                    pension_contrib_r=_wmean_all(c_pc_r),
                ),
            })

    output_dir.mkdir(parents=True, exist_ok=True)
    with open(output_dir / "household_decomposition.json", "w") as f:
        json.dump(all_decomposition, f, indent=2)
    print(f"Saved: {output_dir / 'household_decomposition.json'}")


if __name__ == "__main__":
    generate_all_data()
