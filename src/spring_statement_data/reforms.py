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
# Pre-statement parameters: November 2025 OBR EFO values
# These are applied as a reform to CREATE the baseline (pre-Spring Statement).
# policyengine-uk's default parameters already have March 2026 values.
# =============================================================================

PRE_STATEMENT_PARAMS = {
    "gov.economic_assumptions.yoy_growth.obr.average_earnings": {
        "2025-01-01": 0.0517,
        "2026-01-01": 0.0333,
        "2027-01-01": 0.0225,
        "2028-01-01": 0.021,
        "2029-01-01": 0.0221,
        "2030-01-01": 0.0232,
    },
    "gov.economic_assumptions.yoy_growth.obr.consumer_price_index": {
        "2025-01-01": 0.0345,
        "2026-01-01": 0.0248,
        "2027-01-01": 0.0202,
        "2028-01-01": 0.0204,
        "2029-01-01": 0.0204,
        "2030-01-01": 0.02,
    },
    "gov.economic_assumptions.yoy_growth.obr.consumer_price_index_ahc": {
        "2025-01-01": 0.027,
        "2026-01-01": 0.017,
        "2027-01-01": 0.019,
        "2028-01-01": 0.019,
        "2029-01-01": 0.019,
    },
    "gov.economic_assumptions.yoy_growth.obr.cpih": {
        "2025-01-01": 0.0393,
        "2026-01-01": 0.0267,
        "2027-01-01": 0.0215,
        "2028-01-01": 0.0208,
        "2029-01-01": 0.0211,
        "2030-01-01": 0.0213,
    },
    "gov.economic_assumptions.yoy_growth.obr.rpi": {
        "2025-01-01": 0.0433,
        "2026-01-01": 0.0371,
        "2027-01-01": 0.0313,
        "2028-01-01": 0.0287,
        "2029-01-01": 0.0291,
        "2030-01-01": 0.0231,
    },
    "gov.economic_assumptions.yoy_growth.obr.house_prices": {
        "2025-01-01": 0.0294,
        "2026-01-01": 0.0222,
        "2027-01-01": 0.0279,
        "2028-01-01": 0.0272,
        "2029-01-01": 0.0257,
        "2030-01-01": 0.0242,
    },
    "gov.economic_assumptions.yoy_growth.obr.per_capita.gdp": {
        "2025-01-01": 0.0418,
        "2026-01-01": 0.0327,
        "2027-01-01": 0.0326,
        "2028-01-01": 0.0302,
        "2029-01-01": 0.0294,
        "2030-01-01": 0.0306,
    },
    "gov.economic_assumptions.yoy_growth.obr.social_rent": {
        "2025-01-01": 0.035,
        "2026-01-01": 0.045,
        "2027-01-01": 0.035,
        "2028-01-01": 0.03,
        "2029-01-01": 0.03,
        "2030-01-01": 0.03,
    },
    "gov.economic_assumptions.yoy_growth.obr.mortgage_interest": {
        "2025-01-01": 0.1098,
        "2026-01-01": 0.1435,
        "2027-01-01": 0.1032,
        "2028-01-01": 0.047,
        "2029-01-01": 0.0466,
        "2030-01-01": 0.0553,
    },
    "gov.economic_assumptions.yoy_growth.obr.non_labour_income": {
        "2025-01-01": 0.0519,
        "2026-01-01": 0.0565,
        "2027-01-01": 0.0474,
        "2028-01-01": 0.0364,
        "2029-01-01": 0.0302,
        "2030-01-01": 0.0292,
    },
    "gov.economic_assumptions.yoy_growth.obr.rent": {
        "2025-01-01": 0.0546,
        "2026-01-01": 0.0334,
        "2027-01-01": 0.0311,
        "2028-01-01": 0.0243,
        "2029-01-01": 0.0234,
        "2030-01-01": 0.0254,
    },
    "gov.economic_assumptions.yoy_growth.obr.council_tax.england": {
        "2025-01-01": 0.0781,
        "2026-01-01": 0.053,
        "2027-01-01": 0.0579,
        "2028-01-01": 0.0565,
        "2029-01-01": 0.0547,
        "2030-01-01": 0.0542,
    },
    "gov.economic_assumptions.yoy_growth.obr.council_tax.wales": {
        "2025-01-01": 0.0581,
        "2026-01-01": 0.0581,
        "2027-01-01": 0.0581,
        "2028-01-01": 0.0581,
        "2029-01-01": 0.0581,
        "2030-01-01": 0.0581,
    },
    "gov.economic_assumptions.yoy_growth.obr.per_capita.mixed_income": {
        "2025-01-01": 0.0024,
        "2026-01-01": 0.0362,
        "2027-01-01": 0.0374,
        "2028-01-01": 0.0351,
        "2029-01-01": 0.0358,
        "2030-01-01": 0.0364,
    },
    "gov.economic_assumptions.yoy_growth.obr.per_capita.non_labour_income": {
        "2025-01-01": 0.0447,
        "2026-01-01": 0.0527,
        "2027-01-01": 0.0437,
        "2028-01-01": 0.0324,
        "2029-01-01": 0.0258,
        "2030-01-01": 0.0247,
    },
    "gov.economic_assumptions.yoy_growth.ons.household_interest_income": {
        "2025-01-01": 0.0519,
        "2026-01-01": 0.0565,
        "2027-01-01": 0.0474,
        "2028-01-01": 0.0364,
        "2029-01-01": 0.0302,
        "2030-01-01": 0.0292,
    },
}

# Legacy alias — the old name pointed to the March 2026 values applied as
# a reform.  Now policyengine-uk already has March 2026, so the reform is
# the pre-statement (November 2025) values.
SPRING_STATEMENT_PARAMS = PRE_STATEMENT_PARAMS


# =============================================================================
# Economic forecast data (old vs new OBR values, for the forecast tab)
# =============================================================================

ECONOMIC_FORECAST = {
    "earnings_growth": {
        "label": "Earnings growth",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.average_earnings",
        "previous": {2026: 3.3, 2027: 2.2, 2028: 2.1, 2029: 2.2, 2030: 2.3},
        "updated": {2026: 3.4, 2027: 2.4, 2028: 2.1, 2029: 2.2, 2030: 2.4},
    },
    "cpi_inflation": {
        "label": "CPI inflation",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.consumer_price_index",
        "previous": {2026: 2.5, 2027: 2.0, 2028: 2.0, 2029: 2.0, 2030: 2.0},
        "updated": {2026: 2.3, 2027: 2.0, 2028: 2.0, 2029: 2.0, 2030: 2.0},
    },
    "rpi_inflation": {
        "label": "RPI inflation",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.rpi",
        "previous": {2026: 3.7, 2027: 3.1, 2028: 2.9, 2029: 2.9, 2030: 2.3},
        "updated": {2026: 3.1, 2027: 3.0, 2028: 2.8, 2029: 2.9, 2030: 2.3},
    },
    "house_prices": {
        "label": "House prices",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.house_prices",
        "previous": {2026: 2.2, 2027: 2.8, 2028: 2.7, 2029: 2.6, 2030: 2.4},
        "updated": {2026: 2.4, 2027: 2.9, 2028: 2.7, 2029: 2.6, 2030: 2.4},
    },
    "per_capita_gdp": {
        "label": "Per capita GDP growth",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.per_capita.gdp",
        "previous": {2026: 3.3, 2027: 3.3, 2028: 3.0, 2029: 2.9, 2030: 3.1},
        "updated": {2026: 2.9, 2027: 3.2, 2028: 3.1, 2029: 3.0, 2030: 3.1},
    },
    "social_rent": {
        "label": "Social rent",
        "parameter": "gov.economic_assumptions.yoy_growth.obr.social_rent",
        "previous": {2026: 4.5, 2027: 3.5, 2028: 3.0, 2029: 3.0, 2030: 3.0},
        "updated": {2026: 4.4, 2027: 3.3, 2028: 3.0, 2029: 3.0, 2030: 3.0},
    },
}


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
