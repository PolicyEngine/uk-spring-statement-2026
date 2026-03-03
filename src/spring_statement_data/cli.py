"""Command-line interface for UK Spring Statement 2026 data generation."""

import argparse
import sys


def main():
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description="Generate Spring Statement 2026 data"
    )
    parser.add_argument(
        "command",
        choices=["generate", "serve"],
        help="'generate' to build dashboard data, 'serve' to start the API",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5002,
        help="Port for the API server (default: 5002)",
    )
    args = parser.parse_args()

    if args.command == "generate":
        from .pipeline import generate_all_data

        generate_all_data()
    elif args.command == "serve":
        from .api import main as serve

        serve()


if __name__ == "__main__":
    main()
