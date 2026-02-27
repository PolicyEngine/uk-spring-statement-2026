"""Generate UK baseline projections for disposable income and poverty rates.

Adapted from the PolicyEngine budget dashboard baseline script.
This generates UK-wide projections under current law (baseline).

METHODOLOGY NOTES:
- Uses RELATIVE poverty (60% of UK median income) for poverty_rate_bhc/ahc
- Uses ABSOLUTE poverty (2010/11 threshold + CPI) for absolute_poverty_bhc/ahc
- No region filtering - covers all of UK
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from policyengine_uk import Microsimulation

# Years to project
YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]


def calculate_uk_baseline(output_dir: Path = None) -> pd.DataFrame:
    """Calculate baseline projections for the whole UK.

    Returns DataFrame with poverty rates, income metrics, and population counts.
    """
    script_dir = Path(__file__).parent

    if output_dir is None:
        output_dir = script_dir.parent / "public" / "data"

    sim = Microsimulation()
    print("Using default PolicyEngine UK dataset")

    results = []

    for year in YEARS:
        print(f"Processing {year}...")

        age = sim.calculate("age", year, map_to="person").values
        weight = sim.calculate("person_weight", year, map_to="person").values

        # Get RELATIVE poverty (60% of UK median)
        in_pov_rel_bhc = sim.calculate(
            "in_relative_poverty_bhc", year, map_to="person"
        ).values
        in_pov_rel_ahc = sim.calculate(
            "in_relative_poverty_ahc", year, map_to="person"
        ).values

        # Get ABSOLUTE poverty (2010/11 threshold + CPI)
        in_pov_abs_bhc = sim.calculate(
            "in_poverty_bhc", year, map_to="person"
        ).values
        in_pov_abs_ahc = sim.calculate(
            "in_poverty_ahc", year, map_to="person"
        ).values

        # Age groups
        is_child = age < 18
        is_working_age = (age >= 16) & (age < 65)
        is_pensioner = age >= 65

        total_pop = weight.sum()

        # Overall relative poverty
        pov_bhc = (weight[in_pov_rel_bhc].sum() / total_pop) * 100
        pov_ahc = (weight[in_pov_rel_ahc].sum() / total_pop) * 100

        # Overall absolute poverty
        abs_pov_bhc = (weight[in_pov_abs_bhc].sum() / total_pop) * 100
        abs_pov_ahc = (weight[in_pov_abs_ahc].sum() / total_pop) * 100

        # Child poverty (relative)
        child_mask = is_child
        total_children = weight[child_mask].sum()
        child_pov_bhc = (
            weight[child_mask & in_pov_rel_bhc].sum() / total_children
        ) * 100
        child_pov_ahc = (
            weight[child_mask & in_pov_rel_ahc].sum() / total_children
        ) * 100

        # Child absolute poverty
        child_abs_pov = (
            weight[child_mask & in_pov_abs_bhc].sum() / total_children
        ) * 100

        # Working age poverty
        wa_mask = is_working_age
        total_wa = weight[wa_mask].sum()
        wa_pov_bhc = (weight[wa_mask & in_pov_rel_bhc].sum() / total_wa) * 100
        wa_pov_ahc = (weight[wa_mask & in_pov_rel_ahc].sum() / total_wa) * 100

        # Pensioner poverty
        pens_mask = is_pensioner
        total_pens = weight[pens_mask].sum()
        pens_pov_bhc = (
            weight[pens_mask & in_pov_rel_bhc].sum() / total_pens
        ) * 100
        pens_pov_ahc = (
            weight[pens_mask & in_pov_rel_ahc].sum() / total_pens
        ) * 100

        # Household data (no region filter - UK-wide)
        hh_income = sim.calculate(
            "hbai_household_net_income", year, map_to="household"
        ).values
        hh_weight = sim.calculate(
            "household_weight", year, map_to="household"
        ).values

        total_hh = hh_weight.sum()
        mean_income = (hh_income * hh_weight).sum() / total_hh

        # Median income
        sorted_idx = np.argsort(hh_income)
        sorted_inc = hh_income[sorted_idx]
        sorted_w = hh_weight[sorted_idx]
        cum_w = np.cumsum(sorted_w)
        med_idx = np.searchsorted(cum_w, total_hh / 2)
        median_income = sorted_inc[min(med_idx, len(sorted_inc) - 1)]

        # Taxpayer stats
        total_income = sim.calculate(
            "total_income", year, map_to="person"
        ).values
        is_taxpayer = total_income > 12570
        taxpayer_inc = total_income[is_taxpayer]
        taxpayer_w = weight[is_taxpayer]
        total_taxpayers = taxpayer_w.sum()

        sorted_idx = np.argsort(taxpayer_inc)
        sorted_ti = taxpayer_inc[sorted_idx]
        sorted_tw = taxpayer_w[sorted_idx]
        cum_tw = np.cumsum(sorted_tw)

        p25_idx = np.searchsorted(cum_tw, total_taxpayers * 0.25)
        p50_idx = np.searchsorted(cum_tw, total_taxpayers * 0.50)
        p75_idx = np.searchsorted(cum_tw, total_taxpayers * 0.75)

        taxpayer_p25 = sorted_ti[min(p25_idx, len(sorted_ti) - 1)]
        taxpayer_median = sorted_ti[min(p50_idx, len(sorted_ti) - 1)]
        taxpayer_p75 = sorted_ti[min(p75_idx, len(sorted_ti) - 1)]

        # Income per head and total
        total_hh_income = (hh_income * hh_weight).sum()
        mean_income_per_head = total_hh_income / total_pop
        total_income_bn = total_hh_income / 1e9

        # Median income per head
        hh_count_people = sim.calculate(
            "household_count_people", year, map_to="household"
        ).values
        income_per_head = hh_income / np.maximum(hh_count_people, 1)

        people_weights = hh_weight * hh_count_people
        sorted_idx = np.argsort(income_per_head)
        sorted_inc_ph = income_per_head[sorted_idx]
        sorted_pw = people_weights[sorted_idx]
        cum_pw = np.cumsum(sorted_pw)
        total_people_w = cum_pw[-1]
        med_ph_idx = np.searchsorted(cum_pw, total_people_w / 2)
        median_income_per_head = sorted_inc_ph[
            min(med_ph_idx, len(sorted_inc_ph) - 1)
        ]

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
