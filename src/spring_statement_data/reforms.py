"""UK Spring Statement 2026 reform definitions.

The Spring Statement has NO policy changes -- only updated OBR economic
forecasts.  The "reform" is replacing the November 2025 OBR forecast values
with March 2026 values, which changes uprating and therefore household
incomes.
"""

import json
from pathlib import Path

from policyengine_uk.utils.scenario import Scenario


# Default years for analysis
DEFAULT_YEARS = [2026, 2027, 2028, 2029, 2030]


# =============================================================================
# Spring Statement parameter changes (OBR March 2026 vs November 2025)
# =============================================================================

SPRING_STATEMENT_PARAMS = {
    "gov.economic_assumptions.yoy_growth.obr.average_earnings": {
        "2026-01-01": 0.034,
        "2027-01-01": 0.024,
        "2028-01-01": 0.021,
        "2029-01-01": 0.022,
    },
    "gov.economic_assumptions.yoy_growth.obr.consumer_price_index": {
        "2026-01-01": 0.023,
        "2027-01-01": 0.020,
        "2028-01-01": 0.020,
        "2029-01-01": 0.020,
    },
    "gov.economic_assumptions.yoy_growth.obr.rpi": {
        "2026-01-01": 0.031,
        "2027-01-01": 0.030,
        "2028-01-01": 0.028,
        "2029-01-01": 0.029,
    },
    "gov.economic_assumptions.yoy_growth.obr.house_prices": {
        "2026-01-01": 0.024,
        "2027-01-01": 0.029,
        "2028-01-01": 0.027,
        "2029-01-01": 0.026,
    },
    "gov.economic_assumptions.yoy_growth.obr.per_capita.gdp": {
        "2026-01-01": 0.0292,
        "2027-01-01": 0.0323,
        "2028-01-01": 0.0310,
        "2029-01-01": 0.0296,
    },
    "gov.economic_assumptions.yoy_growth.obr.social_rent": {
        "2026-01-01": 0.044,
        "2027-01-01": 0.033,
        "2028-01-01": 0.030,
        "2029-01-01": 0.030,
    },
}


# =============================================================================
# Economic forecast data (old vs new OBR values, for the forecast tab)
# =============================================================================

ECONOMIC_FORECAST = {
    "earnings_growth": {
        "label": "Earnings growth",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.average_earnings",
        "previous": {2026: 3.3, 2027: 2.3, 2028: 2.1, 2029: 2.2},
        "updated": {2026: 3.4, 2027: 2.4, 2028: 2.1, 2029: 2.2},
    },
    "cpi_inflation": {
        "label": "CPI inflation",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.consumer_price_index",
        "previous": {2026: 2.5, 2027: 2.0, 2028: 2.0, 2029: 2.0},
        "updated": {2026: 2.3, 2027: 2.0, 2028: 2.0, 2029: 2.0},
    },
    "rpi_inflation": {
        "label": "RPI inflation",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.rpi",
        "previous": {2026: 3.7, 2027: 3.1, 2028: 2.9, 2029: 2.9},
        "updated": {2026: 3.1, 2027: 3.0, 2028: 2.8, 2029: 2.9},
    },
    "house_prices": {
        "label": "House prices",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.house_prices",
        "previous": {2026: 2.2, 2027: 2.8, 2028: 2.7, 2029: 2.6},
        "updated": {2026: 2.4, 2027: 2.9, 2028: 2.7, 2029: 2.6},
    },
    "per_capita_gdp": {
        "label": "Per capita GDP growth",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.per_capita.gdp",
        "previous": {2026: 3.3, 2027: 3.3, 2028: 3.0, 2029: 2.9},
        "updated": {2026: 2.9, 2027: 3.2, 2028: 3.1, 2029: 3.0},
    },
    "social_rent": {
        "label": "Social rent",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.social_rent",
        "previous": {2026: 4.5, 2027: 3.5, 2028: 3.0, 2029: 3.0},
        "updated": {2026: 4.4, 2027: 3.3, 2028: 3.0, 2029: 3.0},
    },
}


def get_reform_scenario() -> Scenario:
    """Return a Scenario that applies the Spring Statement OBR updates.

    The ``applied_before_data_load=True`` flag ensures the new forecast
    values feed into the uprating pipeline before household data is loaded.
    """
    return Scenario(
        parameter_changes=SPRING_STATEMENT_PARAMS,
        applied_before_data_load=True,
    )


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
            upd = data["updated"][year]
            entries.append({
                "year": year,
                "previous": prev,
                "updated": upd,
                "change": round(upd - prev, 1),
            })
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
