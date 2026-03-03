"""Calculators for UK Spring Statement 2026 dashboard metrics.

Methodology aligned with PolicyEngine API v2.
Single reform: November 2025 OBR forecasts (baseline) vs March 2026 (reform).

Uses native MicroSeries from PolicyEngine — sim.calculate() returns
MicroSeries with weights.

All calculators output both nominal and real (CPI-deflated) values,
suffixed with _nominal and _real respectively.
"""

import microdf as mdf
import numpy as np
import pandas as pd
from policyengine_uk import Microsimulation

from .reforms import get_pre_statement_scenario, get_real_deflator

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

# Decile labels for income distribution analysis
DECILE_LABELS = [
    "1st", "2nd", "3rd", "4th", "5th",
    "6th", "7th", "8th", "9th", "10th",
]


def _create_simulations():
    """Create baseline and reformed Microsimulation instances.

    Baseline = November 2025 OBR forecasts (pre-Spring Statement).
    Reformed = March 2026 OBR forecasts (policyengine-uk default).
    """
    scenario = get_pre_statement_scenario()
    baseline = Microsimulation(scenario=scenario)
    reformed = Microsimulation()
    return baseline, reformed


class DistributionalImpactCalculator:
    """Calculate impact by income decile.

    API v2 methodology:
    - Relative: groupby(decile).sum() / groupby(decile).sum() for baseline
    - Average: groupby(decile).mean()
    - Uses baseline weights for reform MicroSeries
    """

    def calculate(self, year: int) -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)

        baseline_income = baseline.calculate("household_net_income", year)
        reform_income_raw = reformed.calculate("household_net_income", year)
        income_decile = baseline.calculate("household_income_decile", year)

        # Nominal: reform values at their own price level
        reform_income_nominal = mdf.MicroSeries(
            reform_income_raw.values, weights=baseline_income.weights
        )
        # Real: deflate reform income to baseline price level
        reform_income_real = mdf.MicroSeries(
            reform_income_raw.values * deflator, weights=baseline_income.weights
        )

        valid = np.array(income_decile) >= 0
        baseline_income = baseline_income[valid]
        reform_income_nominal = reform_income_nominal[valid]
        reform_income_real = reform_income_real[valid]
        income_change_nominal = reform_income_nominal - baseline_income
        income_change_real = reform_income_real - baseline_income
        decile_values = income_decile[valid]

        results = []

        for decile in range(1, 11):
            mask = np.array(decile_values) == decile
            if not mask.any():
                continue

            baseline_sum = baseline_income[mask].sum()

            change_sum_nom = income_change_nominal[mask].sum()
            change_sum_real = income_change_real[mask].sum()
            relative_nom = (change_sum_nom / baseline_sum) * 100 if baseline_sum > 0 else 0
            relative_real = (change_sum_real / baseline_sum) * 100 if baseline_sum > 0 else 0
            avg_change_nom = income_change_nominal[mask].mean()
            avg_change_real = income_change_real[mask].mean()

            results.append({
                "year": year,
                "decile": DECILE_LABELS[decile - 1],
                "absolute_change_nominal": round(float(avg_change_nom), 2),
                "absolute_change_real": round(float(avg_change_real), 2),
                "relative_change_nominal": round(float(relative_nom), 4),
                "relative_change_real": round(float(relative_real), 4),
            })

        total_change_nom = income_change_nominal.sum()
        total_change_real = income_change_real.sum()
        total_baseline = baseline_income.sum()
        overall_relative_nom = (
            (total_change_nom / total_baseline) * 100 if total_baseline > 0 else 0
        )
        overall_relative_real = (
            (total_change_real / total_baseline) * 100 if total_baseline > 0 else 0
        )
        results.append({
            "year": year,
            "decile": "All",
            "absolute_change_nominal": round(float(income_change_nominal.mean()), 2),
            "absolute_change_real": round(float(income_change_real.mean()), 2),
            "relative_change_nominal": round(float(overall_relative_nom), 4),
            "relative_change_real": round(float(overall_relative_real), 4),
        })

        return results


class MetricsCalculator:
    """Calculate summary metrics including poverty rates.

    Ensures reform MicroSeries uses baseline weights (API v2 parity).
    Poverty rates are binary variables — no nominal/real distinction needed.
    """

    def calculate(self, year: int) -> list[dict]:
        baseline, reformed = _create_simulations()
        is_child = np.array(
            baseline.calculate("is_child", year, map_to="person")
        )

        results = []

        def _add_metric_set(prefix, baseline_ms, reformed_ms, child_filter=None):
            reformed_aligned = mdf.MicroSeries(
                reformed_ms.values, weights=baseline_ms.weights
            )
            if child_filter is not None:
                b_rate = baseline_ms[child_filter].mean() * 100
                r_rate = reformed_aligned[child_filter].mean() * 100
            else:
                b_rate = baseline_ms.mean() * 100
                r_rate = reformed_aligned.mean() * 100

            results.append({"year": year, "metric": f"{prefix}_baseline", "value": round(float(b_rate), 6)})
            results.append({"year": year, "metric": f"{prefix}_reform", "value": round(float(r_rate), 6)})
            results.append({"year": year, "metric": f"{prefix}_change", "value": round(float(r_rate - b_rate), 6)})

        for housing_cost in ["bhc", "ahc"]:
            for poverty_type in ["absolute", "relative"]:
                prefix = f"{poverty_type[:3]}_{housing_cost}"
                if poverty_type == "absolute":
                    var = f"in_poverty_{housing_cost}"
                    deep_var = f"in_deep_poverty_{housing_cost}"
                else:
                    var = f"in_relative_poverty_{housing_cost}"
                    deep_var = None

                b_pov = baseline.calculate(var, year, map_to="person")
                r_pov = reformed.calculate(var, year, map_to="person")

                _add_metric_set(f"{prefix}_poverty_rate", b_pov, r_pov)
                _add_metric_set(f"{prefix}_child_poverty_rate", b_pov, r_pov, is_child)

                if deep_var:
                    b_deep = baseline.calculate(deep_var, year, map_to="person")
                    r_deep = reformed.calculate(deep_var, year, map_to="person")
                    _add_metric_set(f"{prefix}_deep_poverty_rate", b_deep, r_deep)
                    _add_metric_set(f"{prefix}_child_deep_poverty_rate", b_deep, r_deep, is_child)

        return results


class InequalityCalculator:
    """Calculate inequality metrics (Gini, top 10%/1% shares).

    API v2 methodology:
    - Uses equiv_household_net_income
    - Clamps negative incomes to 0
    - Person-weights for ranking (weights *= household_count_people)
    - Restores weights for share calculation
    """

    def calculate(self, year: int) -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)
        results = []

        # Compute baseline once
        b_income = baseline.calculate("equiv_household_net_income", year)
        b_vals = b_income.values.copy()
        b_vals[b_vals < 0] = 0
        b_hh_count = baseline.calculate("household_count_people", year)
        b_original_weights = b_income.weights.copy()
        b_person_weights = b_original_weights * np.array(b_hh_count)

        b_income_ms = mdf.MicroSeries(b_vals, weights=b_person_weights)
        b_gini = b_income_ms.gini()
        b_in_top_10 = b_income_ms.decile_rank() == 10
        b_in_top_1 = b_income_ms.percentile_rank() == 100
        b_income_hh = mdf.MicroSeries(b_vals, weights=b_original_weights)
        b_total = b_income_hh.sum()
        b_top_10_share = b_income_hh[b_in_top_10].sum() / b_total if b_total > 0 else 0
        b_top_1_share = b_income_hh[b_in_top_1].sum() / b_total if b_total > 0 else 0

        # Compute reform for both nominal and real
        r_income = reformed.calculate("equiv_household_net_income", year)
        r_hh_count = reformed.calculate("household_count_people", year)
        r_original_weights = r_income.weights.copy()
        r_person_weights = r_original_weights * np.array(r_hh_count)

        reform_results = {}
        for mode, factor in [("nominal", 1.0), ("real", deflator)]:
            r_vals = r_income.values.copy() * factor
            r_vals[r_vals < 0] = 0

            r_income_ms = mdf.MicroSeries(r_vals, weights=r_person_weights)
            r_gini = r_income_ms.gini()
            r_in_top_10 = r_income_ms.decile_rank() == 10
            r_in_top_1 = r_income_ms.percentile_rank() == 100
            r_income_hh = mdf.MicroSeries(r_vals, weights=r_original_weights)
            r_total = r_income_hh.sum()
            r_top_10_share = r_income_hh[r_in_top_10].sum() / r_total if r_total > 0 else 0
            r_top_1_share = r_income_hh[r_in_top_1].sum() / r_total if r_total > 0 else 0

            reform_results[mode] = {
                "gini": r_gini,
                "top_10_pct_share": r_top_10_share,
                "top_1_pct_share": r_top_1_share,
            }

        merged = []
        for metric in ["gini", "top_10_pct_share", "top_1_pct_share"]:
            baseline_val = {"gini": b_gini, "top_10_pct_share": b_top_10_share, "top_1_pct_share": b_top_1_share}[metric]
            merged.append({
                "year": year,
                "metric": metric,
                "baseline": float(baseline_val),
                "reform_nominal": float(reform_results["nominal"][metric]),
                "reform_real": float(reform_results["real"][metric]),
            })

        return merged


class IntraDecileCalculator:
    """Calculate intra-decile winners/losers (API v2).

    For each decile, share of people who:
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

    def calculate(self, year: int) -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)

        baseline_income = baseline.calculate("household_net_income", year)
        reform_income_raw = reformed.calculate("household_net_income", year)
        income_decile = baseline.calculate("household_income_decile", year)
        hh_count_people = baseline.calculate("household_count_people", year)

        people = mdf.MicroSeries(
            np.array(hh_count_people), weights=baseline_income.weights
        )

        results = []

        for mode, factor in [("nominal", 1.0), ("real", deflator)]:
            reform_income = mdf.MicroSeries(
                reform_income_raw.values * factor, weights=baseline_income.weights
            )

            # API v2 percentage change
            absolute_change = (reform_income - baseline_income).values
            capped_baseline = np.maximum(baseline_income.values, 1)
            capped_reform = np.maximum(reform_income.values, 1) + absolute_change
            pct_change = (capped_reform - capped_baseline) / capped_baseline

            all_decile_shares = []

            for decile in range(1, 11):
                in_decile = np.array(income_decile) == decile
                decile_total = people[in_decile].sum()

                decile_shares = {}
                for i, label in enumerate(self.LABELS):
                    lower, upper = self.BOUNDS[i], self.BOUNDS[i + 1]
                    in_bin = (pct_change > lower) & (pct_change <= upper)
                    share = people[in_decile & in_bin].sum() / decile_total if decile_total > 0 else 0
                    decile_shares[label] = share

                    results.append({
                        "year": year,
                        "decile": DECILE_LABELS[decile - 1],
                        "outcome": label,
                        f"share_{mode}": float(share),
                    })

                all_decile_shares.append(decile_shares)

            # "All" = mean of 10 decile proportions (API v2)
            for label in self.LABELS:
                mean_share = np.mean([d[label] for d in all_decile_shares])
                results.append({
                    "year": year,
                    "decile": "All",
                    "outcome": label,
                    f"share_{mode}": float(mean_share),
                })

        # Merge nominal and real rows by (year, decile, outcome)
        merged = {}
        for row in results:
            key = (row["year"], row["decile"], row["outcome"])
            if key not in merged:
                merged[key] = {"year": row["year"], "decile": row["decile"], "outcome": row["outcome"]}
            if "share_nominal" in row:
                merged[key]["share_nominal"] = row["share_nominal"]
            if "share_real" in row:
                merged[key]["share_real"] = row["share_real"]

        return list(merged.values())


class DetailedBudgetaryImpactCalculator:
    """Per-program budgetary breakdown (API v2 UKPrograms)."""

    def calculate(self, year: int) -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)
        results = []

        for program_name, info in UK_PROGRAMS.items():
            variable = info["variable"]
            is_tax = info["is_tax"]

            try:
                b_val = baseline.calculate(variable, year, map_to="household").sum()
                r_val = reformed.calculate(variable, year, map_to="household").sum()
            except Exception:
                continue

            r_val_real = r_val * deflator
            sign = 1 if is_tax else -1

            results.append({
                "year": year,
                "program": program_name,
                "baseline": float(b_val / 1e6),
                "reform_nominal": float(r_val / 1e6),
                "reform_real": float(r_val_real / 1e6),
                "difference_nominal": float(sign * (r_val - b_val) / 1e6),
                "difference_real": float(sign * (r_val_real - b_val) / 1e6),
            })

        return results


class WinnersLosersCalculator:
    """Calculate percentage of households gaining/losing by decile."""

    THRESHOLD = 0.50

    def calculate(self, year: int) -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)

        baseline_income = baseline.calculate("household_net_income", year)
        reformed_income = reformed.calculate("household_net_income", year)
        income_decile = baseline.calculate("household_income_decile", year)

        weights = np.array(baseline_income.weights)
        decile_arr = np.array(income_decile)

        results = []

        for mode, factor in [("nominal", 1.0), ("real", deflator)]:
            change = mdf.MicroSeries(
                reformed_income.values * factor, weights=reformed_income.weights
            ) - baseline_income
            change_arr = np.array(change)

            for decile in range(1, 11):
                mask = decile_arr == decile
                if not mask.any():
                    continue

                w = weights[mask]
                c = change_arr[mask]
                total_w = w.sum()

                gaining = (w * (c > self.THRESHOLD)).sum() / total_w * 100
                losing = (w * (c < -self.THRESHOLD)).sum() / total_w * 100
                unchanged = 100.0 - gaining - losing

                results.append({
                    "year": year,
                    "decile": DECILE_LABELS[decile - 1],
                    f"pct_gaining_{mode}": round(gaining, 2),
                    f"pct_losing_{mode}": round(losing, 2),
                    f"pct_unchanged_{mode}": round(unchanged, 2),
                })

            total_w = weights.sum()
            gaining = (weights * (change_arr > self.THRESHOLD)).sum() / total_w * 100
            losing = (weights * (change_arr < -self.THRESHOLD)).sum() / total_w * 100
            unchanged = 100.0 - gaining - losing

            results.append({
                "year": year,
                "decile": "All",
                f"pct_gaining_{mode}": round(gaining, 2),
                f"pct_losing_{mode}": round(losing, 2),
                f"pct_unchanged_{mode}": round(unchanged, 2),
            })

        # Merge nominal and real rows by (year, decile)
        merged = {}
        for row in results:
            key = (row["year"], row["decile"])
            if key not in merged:
                merged[key] = {"year": row["year"], "decile": row["decile"]}
            merged[key].update({k: v for k, v in row.items() if k not in ("year", "decile")})

        return list(merged.values())


class HouseholdScatterCalculator:
    """Sample individual household impacts for scatter-plot display."""

    MAX_INCOME = 150_000
    SAMPLE_SIZE = 2000

    def calculate(self, year: int) -> pd.DataFrame:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)

        baseline_income = np.array(
            baseline.calculate("household_net_income", year)
        )
        reformed_income = np.array(
            reformed.calculate("household_net_income", year)
        )
        income_decile = np.array(
            baseline.calculate("household_income_decile", year)
        )

        change_nominal = reformed_income - baseline_income
        change_real = reformed_income * deflator - baseline_income
        mask = baseline_income <= self.MAX_INCOME

        df = pd.DataFrame({
            "baseline_income": baseline_income[mask],
            "net_impact_nominal": change_nominal[mask],
            "net_impact_real": change_real[mask],
            "decile": income_decile[mask],
        })

        if len(df) > self.SAMPLE_SIZE:
            df = df.sample(n=self.SAMPLE_SIZE, random_state=42)

        return df


class ConstituencyCalculator:
    """Calculate average household impact per parliamentary constituency.

    API v2 methodology:
    - Average: (reform.sum() - baseline.sum()) / baseline.count()
    - Relative: reform.sum() / baseline.sum() - 1
    """

    def calculate(
        self,
        year: int,
        weights: np.ndarray,
        constituency_df: pd.DataFrame,
    ) -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)

        baseline_income = np.array(
            baseline.calculate("household_net_income", year)
        )
        reformed_income = np.array(
            reformed.calculate("household_net_income", year)
        )
        reformed_income_real = reformed_income * deflator

        results = []

        for idx, row in constituency_df.iterrows():
            if idx >= weights.shape[0]:
                continue

            code = row.get("code", row.get("constituency_code", ""))
            name = row.get("name", row.get("constituency_name", ""))
            w = weights[idx, :]

            baseline_ms = mdf.MicroSeries(baseline_income, weights=w)
            reform_ms_real = mdf.MicroSeries(reformed_income_real, weights=w)

            baseline_sum = baseline_ms.sum()
            reform_sum = reform_ms_real.sum()
            weighted_count = baseline_ms.count()

            avg_gain = (
                (reform_sum - baseline_sum) / weighted_count
                if weighted_count > 0
                else 0
            )
            relative = (
                ((reform_sum / baseline_sum) - 1) * 100
                if baseline_sum > 0
                else 0
            )

            results.append({
                "year": year,
                "constituency_code": code,
                "constituency_name": name,
                "average_gain": round(float(avg_gain), 2),
                "relative_change": round(float(relative), 4),
            })

        return results
