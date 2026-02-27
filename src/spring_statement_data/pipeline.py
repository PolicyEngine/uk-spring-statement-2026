"""Data generation pipeline for UK Spring Statement 2026 dashboard (DRAFT).

This module provides the main pipeline for generating all dashboard data.
"""

from pathlib import Path
from typing import Optional
import pandas as pd
import h5py

from huggingface_hub import hf_hub_download
from policyengine_uk import Microsimulation

from .calculators import (
    BASELINE_MODIFIERS,
    BudgetaryImpactCalculator,
    LocalAuthorityCalculator,
    DistributionalImpactCalculator,
    MetricsCalculator,
)
from .reforms import ReformDefinition, get_spring_statement_reforms


# HuggingFace repo for data files
HF_REPO = "policyengine/policyengine-uk-data"


# Default paths
DEFAULT_OUTPUT_DIR = Path("public/data")


def get_local_authority_files() -> tuple[str, str]:
    """Download local authority files from HuggingFace.

    Returns:
        Tuple of (weights_path, csv_path) for local authority data.
    """
    weights_path = hf_hub_download(HF_REPO, "local_authority_weights.h5")
    csv_path = hf_hub_download(HF_REPO, "local_authorities_2021.csv")
    return weights_path, csv_path


def save_csv(df: pd.DataFrame, csv_path: Path) -> None:
    """Save DataFrame to CSV, creating parent directories if needed."""
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(csv_path, index=False)
    print(f"Saved: {csv_path}")


def generate_all_data(
    reforms: Optional[list[ReformDefinition]] = None,
    output_dir: Optional[Path] = None,
    years: list[int] = None,
    uk_wide: bool = True,
) -> dict[str, pd.DataFrame]:
    """Generate all dashboard data for the given reforms.

    Args:
        reforms: List of ReformDefinitions to process. Defaults to UK Spring Statement 2026.
        output_dir: Directory for output CSV files.
        years: Years to analyze.
        uk_wide: If True, include all UK local authorities.

    Returns:
        Dict mapping output name to DataFrame.
    """
    reforms = reforms or get_spring_statement_reforms()
    output_dir = output_dir or DEFAULT_OUTPUT_DIR
    years = years or [2026, 2027, 2028, 2029, 2030]

    # Initialize calculators
    budgetary_calc = BudgetaryImpactCalculator(years=years)
    distributional_calc = DistributionalImpactCalculator()
    metrics_calc = MetricsCalculator()
    local_authority_calc = LocalAuthorityCalculator()

    # Download local authority data from HuggingFace
    weights = None
    local_authority_df = None

    try:
        weights_path, csv_path = get_local_authority_files()
        print(f"Downloaded local authority files from HuggingFace")

        with h5py.File(weights_path, "r") as f:
            weights = f["2025"][...]
        local_authority_df = pd.read_csv(csv_path)

        # Include all UK local authorities (no region filter)
        if uk_wide:
            print(f"Including all {len(local_authority_df)} UK local authorities")
    except Exception as e:
        print(f"Warning: Could not load local authority data: {e}")

    # Aggregate results
    all_budgetary = []
    all_distributional = []
    all_metrics = []
    all_local_authorities = []

    for reform in reforms:
        print(f"\nProcessing: {reform.name}")

        # Create simulations using HF dataset (consistent with other calculators)
        baseline = Microsimulation()
        reformed = Microsimulation()

        # Apply baseline modifier if needed (for counterfactual baselines)
        if reform.id in BASELINE_MODIFIERS:
            BASELINE_MODIFIERS[reform.id](baseline)

        reform.apply_fn(reformed)

        # Calculate budgetary impact
        budgetary = budgetary_calc.calculate(reform.id, reform.name)
        all_budgetary.extend(budgetary)

        # Calculate per-year metrics
        for year in years:
            print(f"  Year {year}...")

            # Distributional
            distributional = distributional_calc.calculate(
                reform.id, reform.name, year
            )
            all_distributional.extend(distributional)

            # Summary metrics (poverty)
            metrics = metrics_calc.calculate(
                baseline, reformed, reform.id, reform.name, year
            )
            all_metrics.extend(metrics)

            # Local authority impacts
            if weights is not None and local_authority_df is not None:
                local_authorities = local_authority_calc.calculate(
                    baseline, reformed, reform.id, year, weights, local_authority_df
                )
                all_local_authorities.extend(local_authorities)

        print(f"  Done: {reform.name}")

    # Create DataFrames
    results = {
        "budgetary_impact": pd.DataFrame(all_budgetary),
        "distributional_impact": pd.DataFrame(all_distributional),
        "metrics": pd.DataFrame(all_metrics),
        "local_authorities": pd.DataFrame(all_local_authorities),
    }

    # Save to CSV
    for name, df in results.items():
        if len(df) > 0:
            save_csv(df, output_dir / f"{name}.csv")

    print(f"\nAll data saved to {output_dir}/")

    return results


if __name__ == "__main__":
    generate_all_data()
