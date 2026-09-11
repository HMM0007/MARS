"""Smoke-test the MARS backend data boundary and core adapters.

Run from the backend directory:
    python scripts/verify_backend.py
"""

from app.data_loader import dataset_status
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.adapters.coa_adapter import COAAdapter


def main() -> None:
    status = dataset_status()
    print(f"Dataset directory: {status['data_dir']}")
    print(f"Dataset status:    {status['status']}")

    if status["status"] != "ok":
        for error in status["errors"]:
            print(f"ERROR: {error}")
        raise SystemExit(1)

    engineering = TMSAdapter.fetch_engineering_jobs()
    snt = SMMSAdapter.fetch_snt_jobs()
    traction = TDMSAdapter.fetch_traction_jobs()
    trains = COAAdapter.fetch_passenger_timetable()
    freight = COAAdapter.fetch_freight_forecast()

    print(f"Engineering jobs:   {len(engineering)}")
    print(f"S&T jobs:           {len(snt)}")
    print(f"Traction jobs:      {len(traction)}")
    print(f"Unified jobs:       {len(engineering) + len(snt) + len(traction)}")
    print(f"Train movements:    {len(trains)}")
    print(f"Freight forecasts:  {len(freight)}")
    print("Backend dataset smoke test: PASS")


if __name__ == "__main__":
    main()
