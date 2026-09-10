from typing import Dict, Any, Optional

TSR_PROFILES = {
    "RAIL_CRACK_USFD": {
        "profile_name": "TSR_RAIL_REPLACEMENT",
        "recovery_stages": [
            {"stage": 1, "duration_hours": 2, "max_speed_kmh": 20, "train_padding_mins": 12},
            {"stage": 2, "duration_hours": 4, "max_speed_kmh": 45, "train_padding_mins": 5},
            {"stage": 3, "duration_hours": 18, "max_speed_kmh": 75, "train_padding_mins": 2}
        ],
        "description": "IRPWM Ch.9: Post Rail Replacement Speed Recovery (20 -> 45 -> 75 -> 110 km/h)"
    },
    "BALLAST_DEEP_SCREENING": {
        "profile_name": "TSR_DEEP_SCREENING",
        "recovery_stages": [
            {"stage": 1, "duration_hours": 4, "max_speed_kmh": 20, "train_padding_mins": 15},
            {"stage": 2, "duration_hours": 8, "max_speed_kmh": 45, "train_padding_mins": 6}
        ],
        "description": "IRPWM Ch.8: Ballast Cleaning Machine (BCM) Track Settling Profile"
    },
    "TRACK_GEOMETRY_TGI": {
        "profile_name": "TSR_TAMPING_LIGHT",
        "recovery_stages": [
            {"stage": 1, "duration_hours": 2, "max_speed_kmh": 45, "train_padding_mins": 4}
        ],
        "description": "IRPWM Ch.3: CSM Tamping Light Speed Restriction"
    }
}


class TSRCalculator:
    """
    Calculates post-block Temporary Speed Restriction (TSR) recovery zones 
    following heavy track maintenance.
    """

    @staticmethod
    def get_tsr_profile(defect_type: str) -> Optional[Dict[str, Any]]:
        return TSR_PROFILES.get(defect_type, None)