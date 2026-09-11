from app.data_loader import dataset_status
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.adapters.coa_adapter import COAAdapter


def test_dataset_is_accessible_and_valid():
    result = dataset_status()
    assert result["status"] == "ok", result["errors"]
    assert result["counts"]["jobs"] == 150
    assert result["counts"]["trains"] > 0
    assert result["counts"]["freight_forecast"] > 0


def test_all_department_adapters_read_the_same_job_pool():
    engineering = TMSAdapter.fetch_engineering_jobs()
    snt = SMMSAdapter.fetch_snt_jobs()
    traction = TDMSAdapter.fetch_traction_jobs()

    assert len(engineering) + len(snt) + len(traction) == 150
    assert all(job.department == "Engineering" for job in engineering)
    assert all(job.department == "S&T" for job in snt)
    assert all(job.department == "Traction" for job in traction)


def test_coa_adapters_read_timetable_and_freight_data():
    trains = COAAdapter.fetch_passenger_timetable()
    forecasts = COAAdapter.fetch_freight_forecast()

    assert len(trains) > 0
    assert len(forecasts) > 0
