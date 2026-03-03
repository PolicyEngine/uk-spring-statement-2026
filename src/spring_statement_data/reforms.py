"""UK Spring Statement 2026 reform definitions.

The Spring Statement has NO policy changes -- only updated OBR economic
forecasts.  policyengine-uk's baseline now uses the March 2026 EFO values.
To measure the Spring Statement's impact, we construct a "pre-statement"
reform that reverts to the November 2025 EFO values, applied as the baseline.

Comparison:
  - Baseline = pre-statement reform (November 2025 OBR forecasts)
  - Reform = no reform (March 2026 OBR forecasts, the policyengine-uk default)
  - Impact = March 2026 minus November 2025
"""

import json
from pathlib import Path

from policyengine_uk.utils.scenario import Scenario

# Default years for analysis
DEFAULT_YEARS = [2026, 2027, 2028, 2029, 2030]


# =============================================================================
# Load OBR parameters from JSON (single source of truth)
# =============================================================================

_OBR_JSON_PATH = Path(__file__).parent / "obr_parameters.json"
with open(_OBR_JSON_PATH) as _f:
    _OBR_DATA = json.load(_f)

_NOVEMBER_2025 = _OBR_DATA["november_2025"]
_MARCH_2026 = _OBR_DATA["march_2026"]


# =============================================================================
# Pre-statement parameters: November 2025 OBR EFO values
# These are applied as a reform to CREATE the baseline (pre-Spring Statement).
# policyengine-uk's default parameters already have March 2026 values.
# =============================================================================

PRE_STATEMENT_PARAMS = _NOVEMBER_2025

# Legacy alias — the old name pointed to the March 2026 values applied as
# a reform.  Now policyengine-uk already has March 2026, so the reform is
# the pre-statement (November 2025) values.
SPRING_STATEMENT_PARAMS = PRE_STATEMENT_PARAMS


# =============================================================================
# Economic forecast data (old vs new OBR values, for the forecast tab)
#
# Built dynamically from the JSON.  Each entry maps a friendly key used by
# the frontend to a parameter path.  Values are converted from raw decimals
# (e.g. 0.0333) to display percentages (e.g. 3.3) rounded to 1 decimal.
# =============================================================================

# Mapping: frontend key -> (label, parameter path)
_FORECAST_SERIES = {
    "earnings_growth": (
        "Earnings growth",
        "gov.economic_assumptions.yoy_growth.obr.average_earnings",
    ),
    "cpi_inflation": (
        "CPI inflation",
        "gov.economic_assumptions.yoy_growth.obr.consumer_price_index",
    ),
    "rpi_inflation": (
        "RPI inflation",
        "gov.economic_assumptions.yoy_growth.obr.rpi",
    ),
    "house_prices": (
        "House prices",
        "gov.economic_assumptions.yoy_growth.obr.house_prices",
    ),
    "per_capita_gdp": (
        "Per capita GDP growth",
        "gov.economic_assumptions.yoy_growth.obr.per_capita.gdp",
    ),
    "social_rent": (
        "Social rent",
        "gov.economic_assumptions.yoy_growth.obr.social_rent",
    ),
}


def _build_economic_forecast() -> dict:
    """Build the ECONOMIC_FORECAST dict from the loaded JSON data."""
    forecast = {}
    for key, (label, param_path) in _FORECAST_SERIES.items():
        nov_values = _NOVEMBER_2025.get(param_path)
        mar_values = _MARCH_2026.get(param_path)
        if nov_values is None or mar_values is None:
            # Parameter not available in JSON for both forecasts — skip
            continue
        # Convert date-keyed dicts to year-keyed percentage dicts
        # Only include DEFAULT_YEARS (skip 2025 which is a base year)
        previous = {}
        updated = {}
        for date_str, val in nov_values.items():
            year = int(date_str[:4])
            if year in DEFAULT_YEARS:
                previous[year] = round(val * 100, 1)
        for date_str, val in mar_values.items():
            year = int(date_str[:4])
            if year in DEFAULT_YEARS:
                updated[year] = round(val * 100, 1)
        forecast[key] = {
            "label": label,
            "parameter": param_path,
            "previous": previous,
            "updated": updated,
        }
    return forecast


ECONOMIC_FORECAST = _build_economic_forecast()


def get_pre_statement_scenario() -> Scenario:
    """Return a Scenario that reverts to November 2025 OBR forecasts.

    This is used as the BASELINE in the comparison. The ``reform`` (no
    Scenario) uses policyengine-uk's default March 2026 values.

    The ``applied_before_data_load=True`` flag ensures the old forecast
    values feed into the uprating pipeline before household data is loaded.
    """
    return Scenario(
        parameter_changes=PRE_STATEMENT_PARAMS,
        applied_before_data_load=True,
    )


# Legacy alias
get_reform_scenario = get_pre_statement_scenario


# =============================================================================
# Real-terms deflator: convert reform (March 2026) nominal £ to baseline
# (November 2025) price levels.
#
# For year Y the cumulative price index from 2025 base is:
#   P(Y) = product of (1 + cpi[t]) for t in 2025..Y
# The deflator to express reform income in baseline prices is:
#   deflator(Y) = P_baseline(Y) / P_reform(Y)
# =============================================================================

_CPI_PATH = "gov.economic_assumptions.yoy_growth.obr.consumer_price_index"
_NOV_CPI = {int(k[:4]): v for k, v in _NOVEMBER_2025[_CPI_PATH].items()}
_MAR_CPI = {int(k[:4]): v for k, v in _MARCH_2026[_CPI_PATH].items()}


def get_real_deflator(year: int) -> float:
    """Return the deflator to convert reform nominal £ to baseline prices.

    Multiplying reform income by this deflator expresses it in the same
    price level as the baseline, enabling a real-terms comparison.
    """
    baseline_cumulative = 1.0
    reform_cumulative = 1.0
    for y in range(2025, year + 1):
        baseline_cumulative *= 1 + _NOV_CPI.get(y, 0)
        reform_cumulative *= 1 + _MAR_CPI.get(y, 0)
    return baseline_cumulative / reform_cumulative


def generate_economic_forecast_json() -> dict:
    """Generate the JSON data structure for the economic forecast tab.

    Returns a dict keyed by forecast variable with lists of
    ``{year, previous, updated, change}`` entries.
    """
    result = {}
    for key, data in ECONOMIC_FORECAST.items():
        entries = []
        for year in sorted(data["previous"].keys()):
            prev = data["previous"][year]
            upd = data["updated"].get(year, prev)
            entries.append(
                {
                    "year": year,
                    "previous": prev,
                    "updated": upd,
                    "change": round(upd - prev, 1),
                }
            )
        result[key] = entries
    return result


def save_economic_forecast_json(output_path: Path = None) -> None:
    """Write economic_forecast.json to disk."""
    if output_path is None:
        output_path = Path("public/data/economic_forecast.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = generate_economic_forecast_json()
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Saved: {output_path}")
