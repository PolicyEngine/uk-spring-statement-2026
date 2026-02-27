"""UK Spring Statement 2026 reform definitions (DRAFT).

This module defines the policy reforms for the UK Spring Statement analysis.
Uses function-based parameter modification for compatibility with Microsimulation.

TODO: Implement actual UK Spring Statement 2026 reforms.
"""

from dataclasses import dataclass
from typing import Callable

from policyengine_uk import Microsimulation


# Default years for microsim analysis
DEFAULT_YEARS = [2026, 2027, 2028, 2029, 2030]


# =============================================================================
# Helper Functions
# =============================================================================


def get_cpi_uprated_value(sim: Microsimulation, base_value: float, base_year: int, target_year: int) -> float:
    """Calculate CPI-uprated value using PE UK's CPI index.

    Args:
        sim: Microsimulation instance to read CPI from
        base_value: The value in the base year
        base_year: The year of the base value
        target_year: The year to uprate to

    Returns:
        The CPI-uprated value for the target year
    """
    if target_year <= base_year:
        return base_value

    cpi = sim.tax_benefit_system.parameters.gov.economic_assumptions.indices.obr.consumer_price_index

    # Get CPI index values for base and target years
    base_period = f"{base_year}-01-01"
    target_period = f"{target_year}-01-01"

    cpi_base = cpi(base_period)
    cpi_target = cpi(target_period)

    # Calculate uprated value
    uprating_factor = cpi_target / cpi_base
    return round(base_value * uprating_factor)


# =============================================================================
# Reform Application Functions (stubs)
# =============================================================================


def apply_benefit_inflation_reform(sim: Microsimulation) -> None:
    """Apply benefit inflation adjustment to a simulation (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def apply_basic_rate_uplift_reform(sim: Microsimulation) -> None:
    """Apply basic rate threshold uplift (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def apply_intermediate_rate_uplift_reform(sim: Microsimulation) -> None:
    """Apply intermediate rate threshold uplift (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def apply_higher_rate_freeze_reform(sim: Microsimulation) -> None:
    """Apply higher rate threshold freeze for 2027-28 and 2028-29 (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def apply_advanced_rate_freeze_reform(sim: Microsimulation) -> None:
    """Apply advanced rate threshold freeze for 2027-28 and 2028-29 (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def apply_top_rate_freeze_reform(sim: Microsimulation) -> None:
    """Apply top rate threshold freeze for 2027-28 and 2028-29 (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def disable_benefit_baby_boost(sim: Microsimulation) -> None:
    """Disable benefit baby boost to create counterfactual baseline (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def disable_benefit_inflation(sim: Microsimulation) -> None:
    """Disable benefit inflation to create counterfactual baseline (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def disable_benefit_combined(sim: Microsimulation) -> None:
    """Disable both benefit inflation and baby boost for combined reform baseline (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def apply_benefit_baby_boost_reform(sim: Microsimulation) -> None:
    """Apply benefit baby boost reform to a simulation (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


def apply_combined_reform(sim: Microsimulation) -> None:
    """Apply all UK Spring Statement 2026 reforms to a simulation (DRAFT)."""
    pass  # TODO: Implement UK Spring Statement reform


# =============================================================================
# Reform Definition (for dashboard use)
# =============================================================================


@dataclass
class ReformDefinition:
    """A policy reform definition for the dashboard."""

    id: str
    name: str
    description: str
    apply_fn: Callable[[Microsimulation], None]
    explanation: str = ""


def get_spring_statement_reforms() -> list[ReformDefinition]:
    """Get list of UK Spring Statement 2026 reforms (DRAFT).

    Returns:
        List of ReformDefinition objects.
    """
    return []  # TODO: Populate with UK Spring Statement reforms


def get_policies_metadata() -> list[dict]:
    """Get policy metadata for dashboard UI, derived from reform definitions."""
    return [
        {
            "id": reform.id,
            "name": reform.name,
            "description": reform.description,
            "explanation": reform.explanation,
        }
        for reform in get_spring_statement_reforms()
    ]


# For backwards compatibility
POLICIES = get_policies_metadata()

PRESETS = [
    {
        "id": "uk-spring-statement-2026",
        "name": "UK Spring Statement 2026",
        "policies": [],  # TODO: Populate with UK Spring Statement policy IDs
    },
]
