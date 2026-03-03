"""Calculators for UK Spring Statement 2026 dashboard metrics.

Each calculator generates a specific type of output data.
Methodology aligned with PolicyEngine API v2
(policyengine/outputs/macro/comparison/calculate_economy_comparison.py).

Uses native MicroSeries from PolicyEngine - sim.calculate() returns MicroSeries with weights.
"""

import microdf as mdf
import numpy as np
import pandas as pd
from policyengine_uk import Microsimulation

from .reforms import (
    apply_advanced_rate_freeze_reform,
    apply_basic_rate_uplift_reform,
    apply_benefit_baby_boost_reform,
    apply_benefit_inflation_reform,
    apply_combined_reform,
    apply_higher_rate_freeze_reform,
    apply_intermediate_rate_uplift_reform,
    apply_top_rate_freeze_reform,
    disable_benefit_baby_boost,
    disable_benefit_combined,
    disable_benefit_inflation,
)

# Map reform IDs to their apply functions
REFORM_APPLY_FNS = {
    "benefit_inflation": apply_benefit_inflation_reform,
    "benefit_baby_boost": apply_benefit_baby_boost_reform,
    "income_tax_basic_uplift": apply_basic_rate_uplift_reform,
    "income_tax_intermediate_uplift": apply_intermediate_rate_uplift_reform,
    "higher_rate_freeze": apply_higher_rate_freeze_reform,
    "advanced_rate_freeze": apply_advanced_rate_freeze_reform,
    "top_rate_freeze": apply_top_rate_freeze_reform,
    "combined": apply_combined_reform,
}

# Map reform IDs to baseline modifiers (for counterfactual baselines)
# These are applied to the baseline to create a proper comparison
BASELINE_MODIFIERS = {
    "benefit_inflation": disable_benefit_inflation,  # Set benefit to baseline rate to measure inflation impact
    "benefit_baby_boost": disable_benefit_baby_boost,  # Baby boost is in PE baseline, disable to measure impact
    "combined": disable_benefit_combined,  # Combined includes both benefit inflation and baby boost
}

# Programs for detailed budgetary breakdown (API v2 UKPrograms.PROGRAMS)
UK_PROGRAMS = {
    "income_tax": {"variable": "income_tax", "is_tax": True},
    "national_insurance": {"variable": "national_insurance", "is_tax": True},
    "vat": {"variable": "vat", "is_tax": True},
    "council_tax": {"variable": "council_tax", "is_tax": True},
    "fuel_duty": {"variable": "fuel_duty", "is_tax": True},
    "tax_credits": {"variable": "tax_credits", "is_tax": False},
    "universal_credit": {"variable": "universal_credit", "is_tax": False},
    "child_benefit": {"variable": "child_benefit", "is_tax": False},
    "state_pension": {"variable": "state_pension", "is_tax": False},
    "pension_credit": {"variable": "pension_credit", "is_tax": False},
    "ni_employer": {"variable": "employer_national_insurance", "is_tax": True},
}


class BudgetaryImpactCalculator:
    """Calculate budgetary impact (cost) of reforms.

    API v2 methodology:
    budgetary_impact = (reform_gov_tax - baseline_gov_tax) - (reform_gov_spending - baseline_gov_spending)
    Positive = deficit reduction (revenue gain or spending cut).

    The CSV `value` column is negated so positive = cost to government for chart compatibility.
    """

    def __init__(self, years: list[int] = None):
        self.years = years or [2026, 2027, 2028, 2029, 2030]

    def calculate(self, reform_id: str, reform_name: str) -> list[dict]:
        """Calculate budgetary impact for all years using gov_tax and gov_spending.

        Returns rows with:
        - value: negated budgetary impact (positive = cost to government, for chart compat)
        - tax_revenue_impact: change in tax revenue (£m)
        - benefit_spending_impact: change in benefit spending (£m)
        """
        results = []

        for year in self.years:
            baseline = Microsimulation()
            reformed = Microsimulation()

            # Apply baseline modifier if needed (for counterfactual baselines)
            if reform_id in BASELINE_MODIFIERS:
                BASELINE_MODIFIERS[reform_id](baseline)

            if reform_id in REFORM_APPLY_FNS:
                REFORM_APPLY_FNS[reform_id](reformed)

            # API v2 formula: use gov_tax and gov_spending
            baseline_tax = baseline.calculate("gov_tax", year).sum()
            reform_tax = reformed.calculate("gov_tax", year).sum()
            baseline_spending = baseline.calculate("gov_spending", year).sum()
            reform_spending = reformed.calculate("gov_spending", year).sum()

            tax_revenue_impact = (reform_tax - baseline_tax) / 1e6
            benefit_spending_impact = (reform_spending - baseline_spending) / 1e6
            budgetary_impact = tax_revenue_impact - benefit_spending_impact

            # Negate for CSV: positive = cost to government (chart convention)
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "value": -budgetary_impact,
                "tax_revenue_impact": tax_revenue_impact,
                "benefit_spending_impact": benefit_spending_impact,
            })

        return results


class DetailedBudgetaryImpactCalculator:
    """Per-program budgetary breakdown matching API v2 UKPrograms.PROGRAMS."""

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> list[dict]:
        """Calculate per-program budgetary impact."""
        results = []

        for program_name, program_info in UK_PROGRAMS.items():
            variable = program_info["variable"]
            is_tax = program_info["is_tax"]

            try:
                baseline_val = baseline.calculate(variable, year, map_to="household").sum()
                reform_val = reformed.calculate(variable, year, map_to="household").sum()
            except Exception:
                # Variable may not exist in this version of PE UK
                continue

            # Taxes are positive (revenue), benefits are negative (spending)
            # For budgetary impact: tax increase = positive, benefit increase = negative
            sign = 1 if is_tax else -1
            difference = sign * (reform_val - baseline_val) / 1e6

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "program": program_name,
                "baseline": baseline_val / 1e6,
                "reform": reform_val / 1e6,
                "difference": difference,
            })

        return results


class DistributionalImpactCalculator:
    """Calculate distributional impact by income decile.

    API v2 methodology:
    - Relative: groupby(decile).sum() / groupby(decile).sum() for baseline
    - Average: groupby(decile).sum() / groupby(decile).count()
    - Uses baseline weights for reform MicroSeries
    - Filters decile >= 0
    """

    def calculate(
        self,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> list[dict]:
        """Calculate distributional impact for a single year."""
        baseline = Microsimulation()
        reformed = Microsimulation()

        # Apply baseline modifier if needed
        if reform_id in BASELINE_MODIFIERS:
            BASELINE_MODIFIERS[reform_id](baseline)

        if reform_id in REFORM_APPLY_FNS:
            REFORM_APPLY_FNS[reform_id](reformed)

        # sim.calculate() returns MicroSeries with weights
        baseline_income = baseline.calculate("household_net_income", year)
        reform_income_raw = reformed.calculate("household_net_income", year)
        income_decile = baseline.calculate("household_income_decile", year)

        # API v2: reform MicroSeries uses baseline weights
        reform_income = mdf.MicroSeries(
            reform_income_raw.values, weights=baseline_income.weights
        )

        # Filter decile >= 0 (API v2 convention)
        valid = np.array(income_decile) >= 0
        baseline_income = baseline_income[valid]
        reform_income = reform_income[valid]
        income_change = reform_income - baseline_income
        decile_values = income_decile[valid]

        results = []
        decile_labels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"]

        for decile in range(1, 11):
            decile_mask = np.array(decile_values) == decile
            if not decile_mask.any():
                continue

            # API v2: relative = groupby(decile).sum() / groupby(decile).sum()
            change_sum = income_change[decile_mask].sum()
            baseline_sum = baseline_income[decile_mask].sum()
            relative_change = (change_sum / baseline_sum) * 100 if baseline_sum > 0 else 0

            # API v2: average = groupby(decile).sum() / groupby(decile).count()
            # MicroSeries .count() returns weighted count (sum of weights)
            avg_change = income_change[decile_mask].mean()

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "decile": decile_labels[decile - 1],
                "value": relative_change,
                "absolute_change": avg_change,
            })

        # Overall: sum across all / sum across all
        total_change_sum = income_change.sum()
        total_baseline_sum = baseline_income.sum()
        overall_relative = (total_change_sum / total_baseline_sum) * 100 if total_baseline_sum > 0 else 0
        overall_avg = income_change.mean()

        results.append({
            "reform_id": reform_id,
            "reform_name": reform_name,
            "year": year,
            "decile": "All",
            "value": overall_relative,
            "absolute_change": overall_avg,
        })

        return results


class MetricsCalculator:
    """Calculate summary metrics including poverty impacts.

    Ensures reform MicroSeries uses baseline weights (API v2 parity).
    """

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> list[dict]:
        """Calculate poverty and other summary metrics."""
        is_child = np.array(baseline.calculate("is_child", year, map_to="person"))

        def add_metric_set(
            results: list[dict],
            metric_prefix: str,
            baseline_ms,
            reformed_ms,
            child_filter: np.ndarray = None,
        ) -> None:
            """Add baseline, reform, and change metrics for a given measure."""
            # Ensure reform uses baseline weights
            reformed_aligned = mdf.MicroSeries(
                reformed_ms.values, weights=baseline_ms.weights
            )

            if child_filter is not None:
                baseline_rate = baseline_ms[child_filter].mean() * 100
                reformed_rate = reformed_aligned[child_filter].mean() * 100
            else:
                baseline_rate = baseline_ms.mean() * 100
                reformed_rate = reformed_aligned.mean() * 100

            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{metric_prefix}_baseline",
                "value": baseline_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{metric_prefix}_reform",
                "value": reformed_rate,
            })
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "metric": f"{metric_prefix}_change",
                "value": reformed_rate - baseline_rate,
            })

        results = []

        for housing_cost in ["bhc", "ahc"]:
            for poverty_type in ["absolute", "relative"]:
                prefix = f"{poverty_type[:3]}_{housing_cost}_"

                if poverty_type == "absolute":
                    poverty_var = f"in_poverty_{housing_cost}"
                    deep_poverty_var = f"in_deep_poverty_{housing_cost}"
                else:
                    poverty_var = f"in_relative_poverty_{housing_cost}"
                    deep_poverty_var = None

                baseline_poverty = baseline.calculate(poverty_var, year, map_to="person")
                reformed_poverty = reformed.calculate(poverty_var, year, map_to="person")

                add_metric_set(results, f"{prefix}poverty_rate", baseline_poverty, reformed_poverty)
                add_metric_set(results, f"{prefix}child_poverty_rate", baseline_poverty, reformed_poverty, is_child)

                if deep_poverty_var:
                    baseline_deep = baseline.calculate(deep_poverty_var, year, map_to="person")
                    reformed_deep = reformed.calculate(deep_poverty_var, year, map_to="person")

                    add_metric_set(results, f"{prefix}deep_poverty_rate", baseline_deep, reformed_deep)
                    add_metric_set(results, f"{prefix}child_deep_poverty_rate", baseline_deep, reformed_deep, is_child)

        return results


class InequalityCalculator:
    """Calculate inequality metrics (Gini, top 10%/1% shares).

    API v2 methodology from calculate_single_economy.py lines 99-125:
    - Uses equiv_household_net_income
    - Clamps negative incomes to 0
    - Person-weights for ranking (weights *= household_count_people)
    - Restores weights for share calculation
    """

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> list[dict]:
        """Calculate inequality metrics for baseline and reform."""
        results = []

        for sim, label in [(baseline, "baseline"), (reformed, "reform")]:
            income = sim.calculate("equiv_household_net_income", year)
            income_vals = income.values.copy()
            income_vals[income_vals < 0] = 0

            hh_count = sim.calculate("household_count_people", year)
            original_weights = income.weights.copy()

            # Person-weighted MicroSeries for ranking
            person_weights = original_weights * np.array(hh_count)
            income_ms = mdf.MicroSeries(income_vals, weights=person_weights)

            gini = income_ms.gini()

            in_top_10 = income_ms.decile_rank() == 10
            in_top_1 = income_ms.percentile_rank() == 100

            # Restore household weights for share calculation
            income_hh = mdf.MicroSeries(income_vals, weights=original_weights)
            top_10_share = income_hh[in_top_10].sum() / income_hh.sum() if income_hh.sum() > 0 else 0
            top_1_share = income_hh[in_top_1].sum() / income_hh.sum() if income_hh.sum() > 0 else 0

            for metric, value in [
                ("gini", gini),
                ("top_10_pct_share", top_10_share),
                ("top_1_pct_share", top_1_share),
            ]:
                results.append({
                    "reform_id": reform_id,
                    "reform_name": reform_name,
                    "year": year,
                    "metric": metric,
                    label: value,
                })

        # Merge baseline and reform into single rows
        merged = {}
        for row in results:
            key = (row["metric"],)
            if key not in merged:
                merged[key] = {
                    "reform_id": reform_id,
                    "reform_name": reform_name,
                    "year": year,
                    "metric": row["metric"],
                }
            if "baseline" in row:
                merged[key]["baseline"] = row["baseline"]
            if "reform" in row:
                merged[key]["reform"] = row["reform"]

        return list(merged.values())


class IntraDecileCalculator:
    """Calculate intra-decile winners/losers (API v2 lines 409-470).

    For each decile, calculates the share of people in each outcome category:
    - Lose more than 5%
    - Lose less than 5%
    - No change
    - Gain less than 5%
    - Gain more than 5%
    """

    BOUNDS = [float("-inf"), -0.05, -1e-3, 1e-3, 0.05, float("inf")]
    LABELS = [
        "Lose more than 5%",
        "Lose less than 5%",
        "No change",
        "Gain less than 5%",
        "Gain more than 5%",
    ]

    def calculate(
        self,
        reform_id: str,
        reform_name: str,
        year: int,
    ) -> list[dict]:
        """Calculate intra-decile outcome shares."""
        baseline_sim = Microsimulation()
        reformed_sim = Microsimulation()

        if reform_id in BASELINE_MODIFIERS:
            BASELINE_MODIFIERS[reform_id](baseline_sim)

        if reform_id in REFORM_APPLY_FNS:
            REFORM_APPLY_FNS[reform_id](reformed_sim)

        baseline_income = baseline_sim.calculate("household_net_income", year)
        reform_income_raw = reformed_sim.calculate("household_net_income", year)
        income_decile = baseline_sim.calculate("household_income_decile", year)
        hh_count_people = baseline_sim.calculate("household_count_people", year)

        # Reform uses baseline weights
        reform_income = mdf.MicroSeries(
            reform_income_raw.values, weights=baseline_income.weights
        )

        # API v2 percentage change calculation (matches calculate_economy_comparison.py lines 422-429)
        absolute_change = (reform_income - baseline_income).values
        capped_baseline = np.maximum(baseline_income.values, 1)
        capped_reform = np.maximum(reform_income.values, 1) + absolute_change
        pct_change = (capped_reform - capped_baseline) / capped_baseline

        # People series with baseline weights
        people = mdf.MicroSeries(
            np.array(hh_count_people), weights=baseline_income.weights
        )

        results = []
        decile_labels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"]
        all_decile_shares = []

        for decile in range(1, 11):
            in_decile = np.array(income_decile) == decile
            decile_people_total = people[in_decile].sum()

            decile_shares = {}
            for i in range(len(self.LABELS)):
                lower = self.BOUNDS[i]
                upper = self.BOUNDS[i + 1]
                in_bin = (pct_change > lower) & (pct_change <= upper)
                in_both = in_decile & in_bin

                share = people[in_both].sum() / decile_people_total if decile_people_total > 0 else 0
                decile_shares[self.LABELS[i]] = share

                results.append({
                    "reform_id": reform_id,
                    "reform_name": reform_name,
                    "year": year,
                    "decile": decile_labels[decile - 1],
                    "outcome": self.LABELS[i],
                    "share": share,
                })

            all_decile_shares.append(decile_shares)

        # "All" = mean of 10 decile proportions (NOT population-weighted, per API v2)
        for label in self.LABELS:
            mean_share = np.mean([d[label] for d in all_decile_shares])
            results.append({
                "reform_id": reform_id,
                "reform_name": reform_name,
                "year": year,
                "decile": "All",
                "outcome": label,
                "share": mean_share,
            })

        return results


class LocalAuthorityCalculator:
    """Calculate local authority-level impacts.

    API v2 methodology:
    - Average: (reform.sum() - baseline.sum()) / baseline.count()
    - Relative: reform.sum() / baseline.sum() - 1

    Note: Uses external weights from HuggingFace (not simulation weights).
    """

    def calculate(
        self,
        baseline: Microsimulation,
        reformed: Microsimulation,
        reform_id: str,
        year: int,
        weights: np.ndarray,
        local_authority_df: pd.DataFrame,
    ) -> list[dict]:
        """Calculate average impact for each local authority."""
        baseline_income = np.array(baseline.calculate("household_net_income", period=year, map_to="household"))
        reform_income = np.array(reformed.calculate("household_net_income", period=year, map_to="household"))

        results = []

        for idx, (_, row) in enumerate(local_authority_df.iterrows()):
            code = row["code"]
            name = row["name"]

            if idx >= weights.shape[0]:
                continue

            la_weights = weights[idx, :]

            # Use external LA weights with MicroSeries
            baseline_ms = mdf.MicroSeries(baseline_income, weights=la_weights)
            reform_ms = mdf.MicroSeries(reform_income, weights=la_weights)

            # API v2: average = (reform.sum() - baseline.sum()) / baseline.count()
            # MicroSeries .count() returns weighted count (sum of weights)
            baseline_sum = baseline_ms.sum()
            reform_sum = reform_ms.sum()
            weighted_count = baseline_ms.count()
            avg_gain = (reform_sum - baseline_sum) / weighted_count if weighted_count > 0 else 0

            # API v2: relative = reform.sum() / baseline.sum() - 1
            relative_change = ((reform_sum / baseline_sum) - 1) * 100 if baseline_sum > 0 else 0

            results.append({
                "reform_id": reform_id,
                "year": year,
                "local_authority_code": code,
                "local_authority_name": name,
                "average_gain": avg_gain,
                "relative_change": relative_change,
            })

        return results
