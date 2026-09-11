from fastapi import APIRouter, HTTPException

from app.data_loader import dataset_status

router = APIRouter(prefix="/api/v1/dataset", tags=["Dataset Diagnostics"])


@router.get("/status")
def get_dataset_status():
    """Verify that the committed MARS datasets are accessible and valid."""
    result = dataset_status()
    if result["status"] != "ok":
        raise HTTPException(status_code=503, detail=result)
    return result
