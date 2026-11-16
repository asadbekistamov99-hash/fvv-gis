"""Vercel build step for the test deployment: apply migrations and load synthetic demo data.

Runs only on Vercel (VERCEL=1). Seeding needs APP_ENV=development and DEMO_SEED=1,
so a production deployment never receives synthetic records.
"""
import os
import subprocess
import sys


def run(*args: str) -> None:
    print("+", " ".join(args), flush=True)
    subprocess.run([sys.executable, *args], check=True)


def main() -> None:
    if os.environ.get("VERCEL") != "1":
        print("Not on Vercel; skipping migrations and seeding.")
        return
    if not os.environ.get("DATABASE_URL"):
        sys.exit("DATABASE_URL is not set for this deployment.")
    run("-m", "alembic", "upgrade", "head")
    if os.environ.get("APP_ENV") == "development" and os.environ.get("DEMO_SEED") == "1":
        run("-m", "app.cli", "seed-demo")


if __name__ == "__main__":
    main()
