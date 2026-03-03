"""Data generation pipeline for UK Spring Statement 2026 dashboard.

Runs all calculators for each year and saves output to public/data/.
"""

import json
from pathlib import Path

import h5py
import numpy as np
import pandas as pd
from huggingface_hub import hf_hub_download

from .calculators import (
    ConstituencyCalculator,
    DistributionalImpactCalculator,
    HouseholdScatterCalculator,
    MetricsCalculator,
    WinnersLosersCalculator,
)
from .reforms import (
    DEFAULT_YEARS,
    generate_economic_forecast_json,
    save_economic_forecast_json,
)

# HuggingFace repo for data files
HF_REPO = "policyengine/policyengine-uk-data"

# Default output directory
DEFAULT_OUTPUT_DIR = Path("public/data")


def _get_constituency_files() -> tuple[str, str]:
    """Download parliamentary constituency files from HuggingFace.

    Returns:
        Tuple of (weights_path, csv_path).
    """
    weights_path = hf_hub_download(
        HF_REPO, "parliamentary_constituency_weights.h5"
    )
    csv_path = hf_hub_download(
        HF_REPO, "parliamentary_constituencies_2025.csv"
    )
    return weights_path, csv_path


def _save_csv(df: pd.DataFrame, path: Path) -> None:
    """Save DataFrame to CSV, creating parent directories if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    print(f"Saved: {path}")


def generate_all_data(
    output_dir: Path = None,
    years: list[int] = None,
) -> dict[str, pd.DataFrame]:
    """Generate all dashboard data.

    1. Creates baseline and reformed Microsimulations.
    2. Runs all calculators for each year in DEFAULT_YEARS.
    3. Generates economic_forecast.json.
    4. Saves all output to ``public/data/``.

    Args:
        output_dir: Directory for output files.
        years: Years to analyse.

    Returns:
        Dict mapping output name to DataFrame.
    """
    output_dir = output_dir or DEFAULT_OUTPUT_DIR
    years = years or DEFAULT_YEARS

    # ── Economic forecast JSON ──────────────────────────────────────────
    save_economic_forecast_json(output_dir / "economic_forecast.json")

    # ── Calculators ─────────────────────────────────────────────────────
    distributional_calc = DistributionalImpactCalculator()
    metrics_calc = MetricsCalculator()
    winners_losers_calc = WinnersLosersCalculator()
    scatter_calc = HouseholdScatterCalculator()
    constituency_calc = ConstituencyCalculator()

    # ── Download constituency data ──────────────────────────────────────
    constituency_weights = None
    constituency_df = None

    try:
        weights_path, csv_path = _get_constituency_files()
        print("Downloaded constituency files from HuggingFace")

        with h5py.File(weights_path, "r") as f:
            # Use the latest available key
            keys = sorted(f.keys())
            constituency_weights = f[keys[-1]][...]
        constituency_df = pd.read_csv(csv_path)
        print(f"Loaded {len(constituency_df)} constituencies")
    except Exception as e:
        print(f"Warning: Could not load constituency data: {e}")

    # ── Aggregate results ───────────────────────────────────────────────
    all_distributional = []
    all_metrics = []
    all_winners_losers = []
    all_constituency = []
    scatter_df = None

    for year in years:
        print(f"\nYear {year}...")

        # Distributional impact
        distributional = distributional_calc.calculate(year)
        all_distributional.extend(distributional)

        # Summary metrics
        metrics = metrics_calc.calculate(year)
        all_metrics.extend(metrics)

        # Winners and losers
        winners_losers = winners_losers_calc.calculate(year)
        all_winners_losers.extend(winners_losers)

        # Household scatter (only for first year to keep file small)
        if scatter_df is None:
            scatter_df = scatter_calc.calculate(year)

        # Constituency impacts
        if constituency_weights is not None and constituency_df is not None:
            constituency = constituency_calc.calculate(
                year, constituency_weights, constituency_df
            )
            all_constituency.extend(constituency)

        print(f"  Done: {year}")

    # ── Build DataFrames ────────────────────────────────────────────────
    results = {
        "distributional_impact": pd.DataFrame(all_distributional),
        "metrics": pd.DataFrame(all_metrics),
        "winners_losers": pd.DataFrame(all_winners_losers),
        "household_scatter": (
            scatter_df if scatter_df is not None else pd.DataFrame()
        ),
        "constituency": pd.DataFrame(all_constituency),
    }

    # ── Save to CSV ─────────────────────────────────────────────────────
    for name, df in results.items():
        if len(df) > 0:
            _save_csv(df, output_dir / f"{name}.csv")

    print(f"\nAll data saved to {output_dir}/")
    return results


if __name__ == "__main__":
    generate_all_data()
