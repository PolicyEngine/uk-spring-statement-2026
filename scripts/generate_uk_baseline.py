"""Generate UK baseline projections for disposable income and poverty rates.

Adapted from the PolicyEngine budget dashboard baseline script.
This generates UK-wide projections under current law (baseline).

METHODOLOGY NOTES:
- Uses RELATIVE poverty (60% of UK median income) for poverty_rate_bhc/ahc
- Uses ABSOLUTE poverty (2010/11 threshold + CPI) for absolute_poverty_bhc/ahc
- No region filtering - covers all of UK
- Uses MicroSeries .mean() for weighted averages (API v2 parity)
"""

from pathlib import Path

import microdf as mdf
import numpy as np
import pandas as pd
from policyengine_uk import Microsimulation

# Years to project
YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]


def calculate_uk_baseline(output_dir: Path = None) -> pd.DataFrame:
    """Calculate baseline projections for the whole UK.

    Returns DataFrame with poverty rates, income metrics, and population counts.
    Uses MicroSeries .mean() for all weighted rates (consistent with API v2).
    """
    script_dir = Path(__file__).parent

    if output_dir is None:
        output_dir = script_dir.parent / "public" / "data"

    sim = Microsimulation()
    print("Using default PolicyEngine UK dataset")

    results = []

    for year in YEARS:
        print(f"Processing {year}...")

        weight = sim.calculate("person_weight", year, map_to="person")
        age = sim.calculate("age", year, map_to="person")

        # Poverty MicroSeries (already have weights from sim.calculate)
        in_pov_rel_bhc = sim.calculate("in_relative_poverty_bhc", year, map_to="person")
        in_pov_rel_ahc = sim.calculate("in_relative_poverty_ahc", year, map_to="person")
        in_pov_abs_bhc = sim.calculate("in_poverty_bhc", year, map_to="person")
        in_pov_abs_ahc = sim.calculate("in_poverty_ahc", year, map_to="person")

        # Age group masks
        age_vals = np.array(age)
        is_child = age_vals < 18
        is_working_age = (age_vals >= 16) & (age_vals < 65)
        is_pensioner = age_vals >= 65

        total_pop = weight.sum()

        # Overall relative poverty — MicroSeries .mean() is weighted
        pov_bhc = in_pov_rel_bhc.mean() * 100
        pov_ahc = in_pov_rel_ahc.mean() * 100

        # Overall absolute poverty
        abs_pov_bhc = in_pov_abs_bhc.mean() * 100
        abs_pov_ahc = in_pov_abs_ahc.mean() * 100

        # Child poverty (relative) — filter MicroSeries by mask
        total_children = weight[is_child].sum()
        child_pov_bhc = in_pov_rel_bhc[is_child].mean() * 100
        child_pov_ahc = in_pov_rel_ahc[is_child].mean() * 100

        # Child absolute poverty
        child_abs_pov = in_pov_abs_bhc[is_child].mean() * 100

        # Working age poverty
        total_wa = weight[is_working_age].sum()
        wa_pov_bhc = in_pov_rel_bhc[is_working_age].mean() * 100
        wa_pov_ahc = in_pov_rel_ahc[is_working_age].mean() * 100

        # Pensioner poverty
        total_pens = weight[is_pensioner].sum()
        pens_pov_bhc = in_pov_rel_bhc[is_pensioner].mean() * 100
        pens_pov_ahc = in_pov_rel_ahc[is_pensioner].mean() * 100

        # Household data — MicroSeries for income
        hh_income = sim.calculate("hbai_household_net_income", year, map_to="household")
        hh_weight = sim.calculate("household_weight", year, map_to="household")

        total_hh = hh_weight.sum()
        mean_income = hh_income.mean()

        # Median income — use MicroSeries .median()
        median_income = hh_income.median()

        # Taxpayer stats
        total_income = sim.calculate("total_income", year, map_to="person")
        is_taxpayer = np.array(total_income) > 12570
        taxpayer_inc = total_income[is_taxpayer]
        total_taxpayers = weight[is_taxpayer].sum()

        # Taxpayer percentiles — use sorted weighted approach
        taxpayer_vals = taxpayer_inc.values
        taxpayer_w = taxpayer_inc.weights
        sorted_idx = np.argsort(taxpayer_vals)
        sorted_ti = taxpayer_vals[sorted_idx]
        sorted_tw = taxpayer_w[sorted_idx]
        cum_tw = np.cumsum(sorted_tw)

        p25_idx = np.searchsorted(cum_tw, total_taxpayers * 0.25)
        p50_idx = np.searchsorted(cum_tw, total_taxpayers * 0.50)
        p75_idx = np.searchsorted(cum_tw, total_taxpayers * 0.75)

        taxpayer_p25 = sorted_ti[min(p25_idx, len(sorted_ti) - 1)]
        taxpayer_median = sorted_ti[min(p50_idx, len(sorted_ti) - 1)]
        taxpayer_p75 = sorted_ti[min(p75_idx, len(sorted_ti) - 1)]

        # Income per head and total
        total_hh_income = hh_income.sum()
        mean_income_per_head = total_hh_income / total_pop
        total_income_bn = total_hh_income / 1e9

        # Median income per head
        hh_count_people = sim.calculate("household_count_people", year, map_to="household")
        income_per_head_vals = np.array(hh_income) / np.maximum(np.array(hh_count_people), 1)
        people_weights = np.array(hh_weight) * np.array(hh_count_people)
        income_per_head_ms = mdf.MicroSeries(income_per_head_vals, weights=people_weights)
        median_income_per_head = income_per_head_ms.median()

        results.append(
            {
                "year": year,
                "mean_disposable_income": mean_income,
                "median_disposable_income": median_income,
                "median_taxpayer_income": taxpayer_median,
                "taxpayer_income_p25": taxpayer_p25,
                "taxpayer_income_p75": taxpayer_p75,
                "mean_income_per_head": mean_income_per_head,
                "median_income_per_head": median_income_per_head,
                "total_disposable_income_bn": total_income_bn,
                "poverty_rate_bhc": pov_bhc,
                "poverty_rate_ahc": pov_ahc,
                "absolute_poverty_bhc": abs_pov_bhc,
                "absolute_poverty_ahc": abs_pov_ahc,
                "child_poverty_bhc": child_pov_bhc,
                "child_poverty_ahc": child_pov_ahc,
                "child_absolute_poverty": child_abs_pov,
                "working_age_poverty_bhc": wa_pov_bhc,
                "working_age_poverty_ahc": wa_pov_ahc,
                "pensioner_poverty_bhc": pens_pov_bhc,
                "pensioner_poverty_ahc": pens_pov_ahc,
                "total_households": total_hh,
                "total_population": total_pop,
                "total_children": total_children,
                "total_working_age": total_wa,
                "total_pensioners": total_pens,
                "total_taxpayers": total_taxpayers,
            }
        )

        print(
            f"  Year {year}: "
            f"Rel poverty BHC {pov_bhc:.1f}%, AHC {pov_ahc:.1f}% | "
            f"Abs poverty BHC {abs_pov_bhc:.1f}%, AHC {abs_pov_ahc:.1f}% | "
            f"Mean HH income £{mean_income:,.0f}"
        )

    df = pd.DataFrame(results)

    # Save to output
    output_path = output_dir / "uk_baseline.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"\nSaved UK baseline to {output_path}")

    # Print summary
    print("\n=== 2023 Summary ===")
    r = results[0]
    print(f"Overall relative poverty BHC: {r['poverty_rate_bhc']:.1f}%")
    print(f"Overall relative poverty AHC: {r['poverty_rate_ahc']:.1f}%")
    print(f"Overall absolute poverty BHC: {r['absolute_poverty_bhc']:.1f}%")
    print(f"Overall absolute poverty AHC: {r['absolute_poverty_ahc']:.1f}%")
    print(f"Child poverty BHC (relative): {r['child_poverty_bhc']:.1f}%")
    print(f"Child poverty AHC (relative): {r['child_poverty_ahc']:.1f}%")
    print(f"Child poverty (absolute): {r['child_absolute_poverty']:.1f}%")
    print(f"Working-age poverty BHC: {r['working_age_poverty_bhc']:.1f}%")
    print(f"Pensioner poverty BHC: {r['pensioner_poverty_bhc']:.1f}%")
    print(f"\nMean household income: £{r['mean_disposable_income']:,.0f}")
    print(f"Median household income: £{r['median_disposable_income']:,.0f}")
    print(f"Mean income per head: £{r['mean_income_per_head']:,.0f}")
    print(f"\nPopulation: {r['total_population']:,.0f}")
    print(f"Households: {r['total_households']:,.0f}")

    return df


if __name__ == "__main__":
    calculate_uk_baseline()
