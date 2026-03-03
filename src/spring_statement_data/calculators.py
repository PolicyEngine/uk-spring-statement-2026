"""Calculators for UK Spring Statement 2026 dashboard metrics.

Each calculator generates a specific type of output data.  There is only
one reform (updated OBR forecasts), so the calculators are simpler than the
Autumn Budget equivalents.

Uses native MicroSeries from PolicyEngine -- sim.calculate() returns
MicroSeries with weights.
"""

import microdf as mdf
import numpy as np
import pandas as pd
from policyengine_uk import Microsimulation

from .reforms import SPRING_STATEMENT_PARAMS, get_reform_scenario


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_simulations(year: int = None):
    """Create baseline and reformed Microsimulation instances.

    Returns:
        (baseline, reformed) tuple.
    """
    baseline = Microsimulation()
    scenario = get_reform_scenario()
    reformed = Microsimulation(scenario=scenario)
    return baseline, reformed


# ---------------------------------------------------------------------------
# Distributional impact
# ---------------------------------------------------------------------------


class DistributionalImpactCalculator:
    """Calculate impact by income decile.

    Groups households by ``household_income_decile`` and calculates the
    mean absolute change in ``household_net_income`` per decile.
    """

    def calculate(self, year: int) -> list[dict]:
        """Calculate distributional impact for a single year.

        Returns list of dicts with keys:
            year, decile, absolute_change, relative_change
        """
        baseline, reformed = _create_simulations()

        baseline_income = baseline.calculate(
            "household_net_income", year
        )
        reformed_income = reformed.calculate(
            "household_net_income", year
        )
        income_decile = baseline.calculate(
            "household_income_decile", year
        )

        income_change = reformed_income - baseline_income

        results = []
        decile_labels = [
            "1st", "2nd", "3rd", "4th", "5th",
            "6th", "7th", "8th", "9th", "10th",
        ]

        for decile in range(1, 11):
            mask = np.array(income_decile) == decile
            if not mask.any():
                continue

            avg_change = float(income_change[mask].mean())
            avg_baseline = float(baseline_income[mask].mean())
            relative = (
                (avg_change / avg_baseline) * 100
                if avg_baseline > 0
                else 0
            )

            results.append({
                "year": year,
                "decile": decile_labels[decile - 1],
                "absolute_change": round(avg_change, 2),
                "relative_change": round(relative, 4),
            })

        # Overall average
        overall_change = float(income_change.mean())
        overall_baseline = float(baseline_income.mean())
        overall_relative = (
            (overall_change / overall_baseline) * 100
            if overall_baseline > 0
            else 0
        )
        results.append({
            "year": year,
            "decile": "All",
            "absolute_change": round(overall_change, 2),
            "relative_change": round(overall_relative, 4),
        })

        return results


# ---------------------------------------------------------------------------
# Summary metrics (poverty, Gini)
# ---------------------------------------------------------------------------


class MetricsCalculator:
    """Calculate summary metrics including poverty rates and Gini."""

    def calculate(self, year: int) -> list[dict]:
        """Calculate poverty and inequality metrics.

        Returns list of dicts with keys: year, metric, value
        """
        baseline, reformed = _create_simulations()

        results = []

        def _add(metric: str, value: float):
            results.append({
                "year": year,
                "metric": metric,
                "value": round(value, 6),
            })

        # Poverty rates (person-level)
        for housing_cost in ["bhc", "ahc"]:
            for poverty_type in ["absolute", "relative"]:
                if poverty_type == "absolute":
                    var = f"in_poverty_{housing_cost}"
                else:
                    var = f"in_relative_poverty_{housing_cost}"

                prefix = f"{poverty_type[:3]}_{housing_cost}"

                b_pov = baseline.calculate(var, year, map_to="person")
                r_pov = reformed.calculate(var, year, map_to="person")

                b_rate = float(b_pov.mean()) * 100
                r_rate = float(r_pov.mean()) * 100

                _add(f"{prefix}_poverty_rate_baseline", b_rate)
                _add(f"{prefix}_poverty_rate_reform", r_rate)
                _add(f"{prefix}_poverty_rate_change", r_rate - b_rate)

        # Gini coefficient (household-level equivalised income)
        b_equiv = baseline.calculate(
            "equiv_household_net_income", year
        )
        r_equiv = reformed.calculate(
            "equiv_household_net_income", year
        )

        b_gini = float(b_equiv.gini())
        r_gini = float(r_equiv.gini())

        _add("gini_baseline", b_gini)
        _add("gini_reform", r_gini)
        _add("gini_change", r_gini - b_gini)

        return results


# ---------------------------------------------------------------------------
# Winners and losers
# ---------------------------------------------------------------------------


class WinnersLosersCalculator:
    """Calculate percentage of households gaining/losing by decile.

    A change > 0.50 is a winner, < -0.50 is a loser.
    """

    THRESHOLD = 0.50

    def calculate(self, year: int) -> list[dict]:
        """Calculate winners/losers for a single year.

        Returns list of dicts with keys:
            year, decile, pct_gaining, pct_losing, pct_unchanged
        """
        baseline, reformed = _create_simulations()

        baseline_income = baseline.calculate(
            "household_net_income", year
        )
        reformed_income = reformed.calculate(
            "household_net_income", year
        )
        income_decile = baseline.calculate(
            "household_income_decile", year
        )

        change = reformed_income - baseline_income
        weights = np.array(baseline_income.weights)
        change_arr = np.array(change)
        decile_arr = np.array(income_decile)

        results = []
        decile_labels = [
            "1st", "2nd", "3rd", "4th", "5th",
            "6th", "7th", "8th", "9th", "10th",
        ]

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
                "decile": decile_labels[decile - 1],
                "pct_gaining": round(gaining, 2),
                "pct_losing": round(losing, 2),
                "pct_unchanged": round(unchanged, 2),
            })

        # Overall
        total_w = weights.sum()
        gaining = (
            (weights * (change_arr > self.THRESHOLD)).sum()
            / total_w * 100
        )
        losing = (
            (weights * (change_arr < -self.THRESHOLD)).sum()
            / total_w * 100
        )
        unchanged = 100.0 - gaining - losing

        results.append({
            "year": year,
            "decile": "All",
            "pct_gaining": round(gaining, 2),
            "pct_losing": round(losing, 2),
            "pct_unchanged": round(unchanged, 2),
        })

        return results


# ---------------------------------------------------------------------------
# Household scatter
# ---------------------------------------------------------------------------


class HouseholdScatterCalculator:
    """Sample individual household impacts for scatter-plot display.

    Returns baseline income vs net impact, capped at 150k income.
    Samples approximately 2000 rows.
    """

    MAX_INCOME = 150_000
    SAMPLE_SIZE = 2000

    def calculate(self, year: int) -> pd.DataFrame:
        """Calculate household scatter data.

        Returns DataFrame with columns:
            baseline_income, net_impact, decile
        """
        baseline, reformed = _create_simulations()

        baseline_income = np.array(
            baseline.calculate("household_net_income", year)
        )
        reformed_income = np.array(
            reformed.calculate("household_net_income", year)
        )
        income_decile = np.array(
            baseline.calculate("household_income_decile", year)
        )

        change = reformed_income - baseline_income

        # Cap at max income
        mask = baseline_income <= self.MAX_INCOME
        baseline_income = baseline_income[mask]
        change = change[mask]
        income_decile = income_decile[mask]

        df = pd.DataFrame({
            "baseline_income": baseline_income,
            "net_impact": change,
            "decile": income_decile,
        })

        # Sample down
        if len(df) > self.SAMPLE_SIZE:
            df = df.sample(
                n=self.SAMPLE_SIZE, random_state=42
            )

        return df


# ---------------------------------------------------------------------------
# Constituency impacts
# ---------------------------------------------------------------------------


class ConstituencyCalculator:
    """Calculate average household impact per parliamentary constituency.

    Uses constituency weights from HuggingFace
    ``policyengine/policyengine-uk-data`` file
    ``parliamentary_constituency_weights.h5``.
    """

    def calculate(
        self,
        year: int,
        weights: np.ndarray,
        constituency_df: pd.DataFrame,
    ) -> list[dict]:
        """Calculate average impact for each constituency.

        Args:
            year: The fiscal year.
            weights: Array of shape (n_constituencies, n_households).
            constituency_df: DataFrame with constituency codes/names.

        Returns list of dicts with keys:
            year, constituency_code, constituency_name,
            average_gain, relative_change
        """
        baseline, reformed = _create_simulations()

        baseline_income = np.array(
            baseline.calculate("household_net_income", year)
        )
        reformed_income = np.array(
            reformed.calculate("household_net_income", year)
        )

        results = []

        for idx, row in constituency_df.iterrows():
            if idx >= weights.shape[0]:
                continue

            code = row.get("code", row.get("constituency_code", ""))
            name = row.get("name", row.get("constituency_name", ""))

            w = weights[idx, :]

            baseline_ms = mdf.MicroSeries(baseline_income, weights=w)
            reform_ms = mdf.MicroSeries(reformed_income, weights=w)

            avg_baseline = float(baseline_ms.mean())
            avg_reform = float(reform_ms.mean())
            avg_gain = avg_reform - avg_baseline
            relative = (
                (avg_gain / avg_baseline) * 100
                if avg_baseline > 0
                else 0
            )

            results.append({
                "year": year,
                "constituency_code": code,
                "constituency_name": name,
                "average_gain": round(avg_gain, 2),
                "relative_change": round(relative, 4),
            })

        return results
