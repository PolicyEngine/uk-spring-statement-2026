"""Spring Statement data generation package."""

# Lazy imports to avoid loading policyengine_uk on module import
__all__ = ["generate_all_data", "get_spring_statement_reforms"]


def get_spring_statement_reforms():
    """Get Spring Statement reforms (lazy import)."""
    from spring_statement_data.reforms import get_spring_statement_reforms
    return get_spring_statement_reforms()


def generate_all_data():
    """Generate all data (lazy import)."""
    from spring_statement_data.pipeline import generate_all_data
    return generate_all_data()
