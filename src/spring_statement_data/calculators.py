"""Calculators for UK Spring Statement 2026 dashboard metrics.

Methodology aligned with PolicyEngine API v2.
Single reform: November 2025 OBR forecasts (baseline) vs March 2026 (reform).

Uses native MicroSeries from PolicyEngine — sim.calculate() returns
MicroSeries with weights.

Real-terms values use the OBR CPI deflator (``get_real_deflator``) to convert
reform nominal income to baseline (November 2025) price levels, matching the
decomposition methodology used in the household archetypes tab.
"""

import microdf as mdf
import numpy as np
from policyengine_uk import Microsimulation

from .reforms import get_pre_statement_scenario, get_real_deflator, PRE_STATEMENT_PARAMS

# Decile labels for income distribution analysis
DECILE_LABELS = [
    "1st", "2nd", "3rd", "4th", "5th",
    "6th", "7th", "8th", "9th", "10th",
]

# Countries available for filtering
COUNTRIES = ["UK", "ENGLAND", "SCOTLAND", "WALES", "NORTHERN_IRELAND"]

_cached_sims = None


def _create_simulations():
    """Create baseline and reformed Microsimulation instances.

    Baseline = November 2025 OBR forecasts (pre-Spring Statement).
    Reformed = March 2026 OBR forecasts (policyengine-uk default).

    Works around a PE UK bug where ``process_parameters()`` calls
    ``convert_to_fiscal_year_parameters`` which overwrites scenario parameter
    changes.  The fix: monkey-patch ``process_parameters`` to re-apply the
    pre-statement values using year-period format after the fiscal-year
    conversion, and clear the URL dataset cache between sims so each gets
    independently uprated data.

    Results are cached so all calculators share the same sim pair.
    """
    global _cached_sims
    if _cached_sims is not None:
        return _cached_sims

    from policyengine_uk import CountryTaxBenefitSystem
    import policyengine_uk.simulation as sim_mod

    original_process = CountryTaxBenefitSystem.process_parameters
    pending_changes = {}

    def _patched_process(self):
        original_process(self)
        if pending_changes:
            for param_path, values in pending_changes.items():
                p = self.parameters.get_child(param_path)
                for tp, val in values.items():
                    p.update(period=tp[:4], value=val)
                self.reset_parameter_caches()

    CountryTaxBenefitSystem.process_parameters = _patched_process
    try:
        # Baseline: pre-statement (November 2025) parameters
        sim_mod._url_dataset_cache.clear()
        pending_changes.update(PRE_STATEMENT_PARAMS)
        baseline = Microsimulation(scenario=get_pre_statement_scenario())
        pending_changes.clear()

        # Reform: post-statement (March 2026 / PE UK default)
        sim_mod._url_dataset_cache.clear()
        reformed = Microsimulation()
    finally:
        CountryTaxBenefitSystem.process_parameters = original_process

    _cached_sims = (baseline, reformed)
    return baseline, reformed


def _get_country_mask(sim, year: int, country: str):
    """Return a boolean mask for households in the given country.

    If country is "UK" or None, returns None (no filtering).
    """
    if not country or country == "UK":
        return None
    country_arr = np.array(sim.calculate("country", year))
    return country_arr == country


class DistributionalImpactCalculator:
    """Calculate impact by income decile.

    API v2 methodology:
    - Relative: groupby(decile).sum() / groupby(decile).sum() for baseline
    - Average: groupby(decile).mean()
    - Uses baseline weights for reform MicroSeries
    """

    def calculate(self, year: int, country: str = "UK") -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)

        baseline_income = baseline.calculate("household_net_income", year)
        reform_income_nominal_raw = reformed.calculate("household_net_income", year)
        income_decile = baseline.calculate("household_income_decile", year)

        # Align reform weights to baseline
        reform_income_nominal = mdf.MicroSeries(
            reform_income_nominal_raw.values, weights=baseline_income.weights
        )
        # Real: deflate reform nominal to baseline (Nov 2025) prices
        reform_income_real = mdf.MicroSeries(
            reform_income_nominal_raw.values * deflator, weights=baseline_income.weights
        )

        valid = np.array(income_decile) >= 0
        # Apply country filter
        country_mask = _get_country_mask(baseline, year, country)
        if country_mask is not None:
            valid = valid & country_mask

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
                "country": country,
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
            "country": country,
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

    def calculate(self, year: int, country: str = "UK") -> list[dict]:
        baseline, reformed = _create_simulations()
        is_child = np.array(
            baseline.calculate("is_child", year, map_to="person")
        )

        # Country filter at person level
        country_mask = None
        if country and country != "UK":
            person_country = np.array(
                baseline.calculate("country", year, map_to="person")
            )
            country_mask = person_country == country

        results = []

        def _add_metric_set(prefix, baseline_ms, reformed_ms, child_filter=None):
            reformed_aligned = mdf.MicroSeries(
                reformed_ms.values, weights=baseline_ms.weights
            )
            # Combine filters
            filt = None
            if country_mask is not None and child_filter is not None:
                filt = country_mask & child_filter
            elif country_mask is not None:
                filt = country_mask
            elif child_filter is not None:
                filt = child_filter

            if filt is not None:
                b_rate = baseline_ms[filt].mean() * 100
                r_rate = reformed_aligned[filt].mean() * 100
            else:
                b_rate = baseline_ms.mean() * 100
                r_rate = reformed_aligned.mean() * 100

            results.append({"year": year, "country": country, "metric": f"{prefix}_baseline", "value": round(float(b_rate), 6)})
            results.append({"year": year, "country": country, "metric": f"{prefix}_reform", "value": round(float(r_rate), 6)})
            results.append({"year": year, "country": country, "metric": f"{prefix}_change", "value": round(float(r_rate - b_rate), 6)})

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

    def calculate(self, year: int, country: str = "UK") -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)
        country_mask = _get_country_mask(baseline, year, country)
        results = []

        # Compute baseline once (nominal: equiv_household_net_income)
        b_income = baseline.calculate("equiv_household_net_income", year)
        b_vals = np.array(b_income.values.copy())
        b_vals[b_vals < 0] = 0
        b_hh_count = np.array(baseline.calculate("household_count_people", year))
        b_original_weights = np.array(b_income.weights)
        b_person_weights = b_original_weights * b_hh_count

        # Apply country filter
        if country_mask is not None:
            b_vals = b_vals[country_mask]
            b_original_weights = b_original_weights[country_mask]
            b_person_weights = b_person_weights[country_mask]

        b_income_ms = mdf.MicroSeries(b_vals, weights=b_person_weights)
        b_gini = b_income_ms.gini()
        b_in_top_10 = b_income_ms.decile_rank() == 10
        b_in_top_1 = b_income_ms.percentile_rank() == 100
        b_income_hh = mdf.MicroSeries(b_vals, weights=b_original_weights)
        b_total = b_income_hh.sum()
        b_top_10_share = b_income_hh[b_in_top_10].sum() / b_total if b_total > 0 else 0
        b_top_1_share = b_income_hh[b_in_top_1].sum() / b_total if b_total > 0 else 0

        # Reform nominal: equiv_household_net_income
        r_income_nom = reformed.calculate("equiv_household_net_income", year)
        r_hh_count = np.array(reformed.calculate("household_count_people", year))
        r_original_weights = np.array(r_income_nom.weights)
        r_person_weights = r_original_weights * r_hh_count

        # Reform real: deflate equiv_household_net_income to baseline prices
        r_real_equiv_vals = np.array(r_income_nom.values) * deflator

        # Apply country filter to reform
        r_nom_vals = np.array(r_income_nom.values)
        if country_mask is not None:
            r_nom_vals = r_nom_vals[country_mask]
            r_real_equiv_vals = r_real_equiv_vals[country_mask]
            r_original_weights = r_original_weights[country_mask]
            r_person_weights = r_person_weights[country_mask]

        reform_results = {}
        for mode, r_vals_raw in [("nominal", r_nom_vals.copy()), ("real", r_real_equiv_vals.copy())]:
            r_vals = r_vals_raw.copy()
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
                "country": country,
                "metric": metric,
                "baseline": float(baseline_val),
                "reform_nominal": float(reform_results["nominal"][metric]),
                "reform_real": float(reform_results["real"][metric]),
            })

        return merged


class WinnersLosersCalculator:
    """Calculate percentage of households gaining/losing by decile."""

    THRESHOLD = 0.50

    def calculate(self, year: int, country: str = "UK") -> list[dict]:
        baseline, reformed = _create_simulations()
        deflator = get_real_deflator(year)

        baseline_income = baseline.calculate("household_net_income", year)
        reform_income_raw = reformed.calculate("household_net_income", year)
        income_decile = baseline.calculate("household_income_decile", year)

        weights = np.array(baseline_income.weights)
        decile_arr = np.array(income_decile)

        # Real change: deflate reform to baseline prices
        reform_income_real = mdf.MicroSeries(
            reform_income_raw.values * deflator, weights=baseline_income.weights
        )
        change = reform_income_real - baseline_income
        change_arr = np.array(change)

        # Apply country filter
        country_mask = _get_country_mask(baseline, year, country)
        if country_mask is not None:
            weights = weights[country_mask]
            decile_arr = decile_arr[country_mask]
            change_arr = change_arr[country_mask]

        results = []

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
                "country": country,
                "decile": DECILE_LABELS[decile - 1],
                "pct_gaining": round(gaining, 2),
                "pct_losing": round(losing, 2),
                "pct_unchanged": round(unchanged, 2),
            })

        total_w = weights.sum()
        gaining = (weights * (change_arr > self.THRESHOLD)).sum() / total_w * 100
        losing = (weights * (change_arr < -self.THRESHOLD)).sum() / total_w * 100
        unchanged = 100.0 - gaining - losing

        results.append({
            "year": year,
            "country": country,
            "decile": "All",
            "pct_gaining": round(gaining, 2),
            "pct_losing": round(losing, 2),
            "pct_unchanged": round(unchanged, 2),
        })

        return results


