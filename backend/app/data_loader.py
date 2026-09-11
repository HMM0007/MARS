"""Centralized access to the MARS synthetic dataset.

All adapters use this module so dataset paths do not depend on the process
working directory.  Production adapters can later replace this boundary
without changing the core planning engines.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


DATASET_FILES = (
    "jobs.json",
    "trains.json",
    "freight_forecast.json",
    "sections.json",
    "stations.json",
    "tracks.json",
    "users.json",
)


def _find_default_data_dir() -> Path:
    """Find the repository data/raw directory independent of cwd."""
    this_file = Path(__file__).resolve()

    # Normal source checkout: repo/backend/app/data_loader.py -> repo/data/raw
    candidates = [this_file.parents[3] / "data" / "raw"]
    # Also support running from a packaged/container layout where data/raw is
    # mounted next to the backend application.
    candidates.extend(parent / "data" / "raw" for parent in this_file.parents)

    for candidate in candidates:
        if (candidate / "jobs.json").is_file():
            return candidate

    # Keep a deterministic path for useful error messages if data is missing.
    return this_file.parents[3] / "data" / "raw"


@lru_cache(maxsize=1)
def get_data_dir() -> Path:
    """Return the configured MARS dataset directory.

    Set MARS_DATA_DIR to override the repository dataset location in Docker or
    production. Relative values are resolved against the current working dir.
    """
    configured = os.getenv("MARS_DATA_DIR")
    if configured:
        path = Path(configured).expanduser()
        if not path.is_absolute():
            path = Path.cwd() / path
        return path.resolve()
    return _find_default_data_dir()


def dataset_path(filename: str) -> Path:
    if filename not in DATASET_FILES:
        raise ValueError(f"Unsupported MARS dataset file: {filename}")
    return get_data_dir() / filename


@lru_cache(maxsize=32)
def load_json(filename: str) -> Any:
    """Load one dataset file and fail loudly when it cannot be accessed."""
    path = dataset_path(filename)
    if not path.is_file():
        raise FileNotFoundError(
            f"MARS dataset file not found: {path}. "
            "Set MARS_DATA_DIR if the dataset is mounted elsewhere."
        )

    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in MARS dataset file: {path}: {exc}") from exc


def clear_dataset_cache() -> None:
    """Clear cached dataset data after regeneration or replacement."""
    load_json.cache_clear()
    get_data_dir.cache_clear()


def dataset_status() -> dict[str, Any]:
    """Validate dataset presence and return useful backend diagnostics."""
    data_dir = get_data_dir()
    result: dict[str, Any] = {
        "data_dir": str(data_dir),
        "accessible": data_dir.is_dir(),
        "files": {},
        "counts": {},
        "errors": [],
    }

    for filename in DATASET_FILES:
        path = data_dir / filename
        file_info: dict[str, Any] = {"exists": path.is_file()}
        if path.is_file():
            try:
                payload = load_json(filename)
                file_info["valid_json"] = True
                file_info["records"] = len(payload) if isinstance(payload, list) else 1
                result["counts"][filename.removesuffix(".json")] = file_info["records"]
            except Exception as exc:  # diagnostics endpoint must report the problem
                file_info["valid_json"] = False
                file_info["error"] = str(exc)
                result["errors"].append(f"{filename}: {exc}")
        else:
            file_info["valid_json"] = False
            result["errors"].append(f"{filename}: file not found at {path}")
        result["files"][filename] = file_info

    # Validate the records that are consumed directly by the planning engine.
    if not result["errors"]:
        from app.models.job import MaintenanceJob
        from app.models.train import FreightForecast, TrainMovement

        try:
            jobs = [MaintenanceJob(**item) for item in load_json("jobs.json")]
            trains = [TrainMovement(**item) for item in load_json("trains.json")]
            forecasts = [FreightForecast(**item) for item in load_json("freight_forecast.json")]
            result["validation"] = {
                "jobs": "PASS",
                "trains": "PASS",
                "freight_forecast": "PASS",
                "departments": {
                    department: sum(job.department == department for job in jobs)
                    for department in ("Engineering", "S&T", "Traction")
                },
            }
        except Exception as exc:
            result["validation"] = {"status": "FAIL", "error": str(exc)}
            result["errors"].append(f"model validation: {exc}")

    result["status"] = "ok" if not result["errors"] else "error"
    return result
