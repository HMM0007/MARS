from typing import List

from app.data_loader import load_json
from app.models.train import FreightForecast, TrainMovement


class COAAdapter:
    """COA boundary for fixed train timetable and freight forecast data.

    The prototype reads the committed synthetic dataset. In production this
    class is the swap point for the CRIS COA REST/JSON client.
    """

    @staticmethod
    def fetch_passenger_timetable() -> List[TrainMovement]:
        return [TrainMovement(**item) for item in load_json("trains.json")]

    @staticmethod
    def fetch_freight_forecast() -> List[FreightForecast]:
        return [FreightForecast(**item) for item in load_json("freight_forecast.json")]
