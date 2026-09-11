import json
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

# Fixed seed keeps the SIH demo dataset reproducible. A different dataset can
# still be generated deliberately by changing MARS_DATA_SEED.
RANDOM_SEED = int(os.getenv("MARS_DATA_SEED", "26027"))

SECTIONS = [
    {"section_id": "PUNE-LNL", "section_name": "Pune-Lonavala", "from_station": "PUNE", "to_station": "LNL", "length_km": 63.84, "traffic_density": "HIGH"},
    {"section_id": "PUNE-DD", "section_name": "Pune-Daund", "from_station": "PUNE", "to_station": "DD", "length_km": 75.0, "traffic_density": "HIGH"},
    {"section_id": "PUNE-MRJ", "section_name": "Pune-Miraj", "from_station": "PUNE", "to_station": "MRJ", "length_km": 280.0, "traffic_density": "MEDIUM"},
    {"section_id": "LNL-KJT", "section_name": "Lonavala-Karjat", "from_station": "LNL", "to_station": "KJT", "length_km": 28.0, "traffic_density": "HIGH"},
    {"section_id": "CWD-YARD", "section_name": "Chinchwad Yard", "from_station": "CWD", "to_station": "CWD", "length_km": 5.0, "traffic_density": "MEDIUM"},
]

STATIONS_PUNE_LNL = [
    ("PUNE", "Pune Junction", 191.0),
    ("SVJR", "Shivajinagar", 193.5),
    ("KK", "Khadki", 197.2),
    ("DAPD", "Dapodi", 201.0),
    ("KSWD", "Kasarwadi", 204.1),
    ("PMP", "Pimpri", 207.3),
    ("CWD", "Chinchwad", 210.6),
    ("AKRD", "Akurdi", 214.2),
    ("DEHR", "Dehu Road", 219.8),
    ("BGWI", "Begdewadi", 223.1),
    ("TGN", "Talegaon", 227.4),
    ("VDN", "Vadgaon", 233.2),
    ("KMST", "Kamshet", 240.0),
    ("MVL", "Malavli", 248.5),
    ("LNL", "Lonavala", 254.84),
]

ENG_DEFECTS = [
    ("RAIL_CRACK_USFD", "CRITICAL", 2.5, "THERMIT_WELDING", True),
    ("TRACK_GEOMETRY_TGI", "HIGH", 3.5, "HEAVY_MACHINE_TAMPING_CSM", False),
    ("BALLAST_DEEP_SCREENING", "HIGH", 4.0, "BALLAST_CLEANING_BCM", True),
    ("TURNOUT_RENEWAL", "MEDIUM", 3.0, "TURNOUT_RENEWAL_PQRS", False),
    ("BRIDGE_BEARING_INSP", "LOW", 2.0, "MANUAL_INSPECTION", False),
]

SNT_DEFECTS = [
    ("POINT_MACHINE_53A_CALIBRATION", "HIGH", 1.5, "LOCAL_POINT_ISOLATION", False),
    ("DIGITAL_AXLE_COUNTER_RESET", "MEDIUM", 1.0, "NONE", False),
    ("TRACK_CIRCUIT_BOND_FAILURE", "HIGH", 2.0, "LOCAL_TRACK_CIRCUIT", False),
    ("LED_SIGNAL_HEAD_REPLACEMENT", "LOW", 1.0, "SIGNAL_ISOLATION", False),
]

TRC_DEFECTS = [
    ("CONTACT_WIRE_STAGGER_ADJUST", "HIGH", 2.0, "POWER_BLOCK_TOWER_WAGON", True),
    ("NEUTRAL_SECTION_INSULATOR", "CRITICAL", 2.5, "SUBSTATION_SHUTDOWN", True),
    ("OHE_CANTILEVER_OVERHAUL", "MEDIUM", 2.0, "POWER_BLOCK_OHE_GANG", True),
]


def save_json(name, data):
    path = RAW / name
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"Created: {path}")


def generate_sections():
    return SECTIONS


def generate_stations():
    return [
        {
            "station_id": f"STN-{code}",
            "station_code": code,
            "station_name": name,
            "section_id": "PUNE-LNL",
            "location_km": km,
        }
        for code, name, km in STATIONS_PUNE_LNL
    ]


def generate_tracks():
    tracks = []
    for section in SECTIONS:
        sid = section["section_id"]
        tracks.append({"track_id": f"{sid}-UP", "section_id": sid, "track_name": "TRACK_1_UP", "is_electrified": True})
        tracks.append({"track_id": f"{sid}-DN", "section_id": sid, "track_name": "TRACK_2_DN", "is_electrified": True})
        if sid in ["PUNE-LNL", "CWD-YARD", "LNL-KJT"]:
            tracks.append({"track_id": f"{sid}-LOOP", "section_id": sid, "track_name": "LOOP_LINE", "is_electrified": True})
    return tracks


def _location_km(rng, section_id):
    if section_id == "PUNE-LNL":
        # Keep maintenance locations close to recognizable station/yard
        # reference points instead of generating arbitrary kilometre values.
        station_kms = [km for _, _, km in STATIONS_PUNE_LNL]
        anchor = rng.choice(station_kms)
        return round(anchor + rng.uniform(-0.25, 0.25), 3)
    if section_id == "CWD-YARD":
        return round(rng.uniform(0.5, 4.8), 3)
    return round(rng.uniform(0.5, 50.0), 3)


def generate_jobs(count=150):
    rng = random.Random(RANDOM_SEED)
    jobs = []
    base = datetime.now().date()
    hero_tracks = ["PUNE-LNL-UP", "PUNE-LNL-DN", "PUNE-LNL-LOOP"]

    for i in range(1, count + 1):
        dept = rng.choices(["Engineering", "S&T", "Traction"], weights=[45, 30, 25])[0]
        section = rng.choice(SECTIONS)["section_id"]

        if dept == "Engineering":
            defect, crit, dur, work, pblock = rng.choice(ENG_DEFECTS)
            job_id = f"ENG-{1000 + i}"
        elif dept == "S&T":
            defect, crit, dur, work, pblock = rng.choice(SNT_DEFECTS)
            job_id = f"SNT-{800 + i}"
        else:
            defect, crit, dur, work, pblock = rng.choice(TRC_DEFECTS)
            job_id = f"TRC-{300 + i}"

        # Keep the hero corridor dense enough for the SIH operational demo.
        if i <= 45:
            section = "PUNE-LNL"
            track = rng.choice(hero_tracks)
        else:
            track = rng.choice([f"{section}-UP", f"{section}-DN"])

        km = _location_km(rng, section)
        due_offset = rng.randint(3, 20)
        created_offset = rng.randint(0, min(12, due_offset))

        jobs.append({
            "job_id": job_id,
            "department": dept,
            "asset_id": f"AST-{section}-{int(round(km * 10))}",
            "asset_type": dept,
            "section_id": section,
            "track_id": track,
            "location_km": km,
            "defect_type": defect,
            "criticality_level": crit,
            "estimated_duration_hours": dur,
            "due_date": str(base + timedelta(days=due_offset)),
            "preferred_window": "NIGHT" if dur >= 2.5 else rng.choice(["NIGHT", "ANY", "DAY"]),
            "machine_required": work if any(token in work for token in ["MACHINE", "BCM", "PQRS", "TAMPING"]) else None,
            "power_block_required": pblock,
            "dependency_job_id": None,
            "work_type": work,
            "safety_conflict_tag": "WELDING" if "WELDING" in work else ("SIGNAL_SENSITIVE" if dept == "S&T" else "NORMAL"),
            "created_date": str(base - timedelta(days=created_offset)),
            "status": "PENDING",
            "deferral_count": rng.choice([0, 0, 0, 1, 2]),
        })

    # Realistic cross-department consolidation case. These are normal
    # maintenance identifiers, not "DEMO" records, while their fixed location
    # and compatibility make the Purple Block scenario reproducible.
    if count >= 45:
        pair_track = "PUNE-LNL-UP"
        pair_location = 227.4  # TGN reference location
        pair_due = str(base + timedelta(days=14))

        jobs[43].update({
            "job_id": "ENG-PLN-044",
            "department": "Engineering",
            "asset_id": "PWAY-PUNE-LNL-TGN-01",
            "asset_type": "Permanent Way",
            "section_id": "PUNE-LNL",
            "track_id": pair_track,
            "location_km": pair_location,
            "defect_type": "TRACK_GEOMETRY_TGI",
            "criticality_level": "HIGH",
            "estimated_duration_hours": 2.0,
            "due_date": pair_due,
            "preferred_window": "NIGHT",
            "machine_required": None,
            "power_block_required": False,
            "dependency_job_id": None,
            "work_type": "TRACK_GEOMETRY_INSPECTION",
            "safety_conflict_tag": "NORMAL",
            "created_date": str(base - timedelta(days=5)),
            "status": "PENDING",
            "deferral_count": 0,
        })
        jobs[44].update({
            "job_id": "SNT-PLN-044",
            "department": "S&T",
            "asset_id": "SNT-PUNE-LNL-TGN-01",
            "asset_type": "Signalling",
            "section_id": "PUNE-LNL",
            "track_id": pair_track,
            "location_km": pair_location,
            "defect_type": "TRACK_CIRCUIT_BOND_FAILURE",
            "criticality_level": "HIGH",
            "estimated_duration_hours": 2.0,
            "due_date": pair_due,
            "preferred_window": "NIGHT",
            "machine_required": None,
            "power_block_required": False,
            "dependency_job_id": None,
            "work_type": "TRACK_CIRCUIT_BOND_MAINTENANCE",
            "safety_conflict_tag": "NORMAL",
            "created_date": str(base - timedelta(days=4)),
            "status": "PENDING",
            "deferral_count": 0,
        })

    return jobs


def generate_trains():
    base_day = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    trains = [
        {"train_id": "T-12128", "train_number": "12128", "train_name": "Deccan Queen Express", "train_type": "SUPERFAST_EXPRESS", "section_id": "PUNE-LNL", "track_id": "PUNE-LNL-UP", "entry": "07:15", "exit": "08:12", "priority": 1, "direction": "UP"},
        {"train_id": "T-12127", "train_number": "12127", "train_name": "Mumbai-Pune Intercity Express", "train_type": "SUPERFAST_EXPRESS", "section_id": "PUNE-LNL", "track_id": "PUNE-LNL-DN", "entry": "08:48", "exit": "09:57", "priority": 1, "direction": "DN"},
        {"train_id": "T-11010", "train_number": "11010", "train_name": "Sinhagad Express", "train_type": "EXPRESS", "section_id": "PUNE-LNL", "track_id": "PUNE-LNL-UP", "entry": "06:05", "exit": "07:08", "priority": 2, "direction": "UP"},
        {"train_id": "T-22106", "train_number": "22106", "train_name": "Indrayani Express", "train_type": "SUPERFAST_EXPRESS", "section_id": "PUNE-LNL", "track_id": "PUNE-LNL-UP", "entry": "18:35", "exit": "19:33", "priority": 1, "direction": "UP"},
        {"train_id": "T-12124", "train_number": "12124", "train_name": "Deccan Express", "train_type": "EXPRESS", "section_id": "PUNE-LNL", "track_id": "PUNE-LNL-UP", "entry": "15:15", "exit": "16:23", "priority": 2, "direction": "UP"},
        {"train_id": "T-99902", "train_number": "99902", "train_name": "Pune-Lonavala Local", "train_type": "MEMU", "section_id": "PUNE-LNL", "track_id": "PUNE-LNL-UP", "entry": "05:45", "exit": "07:05", "priority": 3, "direction": "UP"},
        {"train_id": "T-99928", "train_number": "99928", "train_name": "Pune-Lonavala Local", "train_type": "MEMU", "section_id": "PUNE-LNL", "track_id": "PUNE-LNL-UP", "entry": "21:00", "exit": "22:20", "priority": 3, "direction": "UP"},
    ]

    output = []
    for d in range(7):
        day = base_day + timedelta(days=d)
        for t in trains:
            entry_h, entry_m = map(int, t["entry"].split(":"))
            exit_h, exit_m = map(int, t["exit"].split(":"))
            output.append({
                "train_id": f"{t['train_id']}-D{d + 1}",
                "train_number": t["train_number"],
                "train_name": t["train_name"],
                "train_type": t["train_type"],
                "section_id": t["section_id"],
                "track_id": t["track_id"],
                "entry_time": datetime(day.year, day.month, day.day, entry_h, entry_m).isoformat(),
                "exit_time": datetime(day.year, day.month, day.day, exit_h, exit_m).isoformat(),
                "priority": t["priority"],
                "direction": t["direction"],
                "is_fixed": True,
            })
    return output


def generate_freight():
    base = datetime.now().date()
    levels = ["NORMAL", "NORMAL", "NORMAL", "HIGH", "NORMAL", "SURGE", "NORMAL"]
    return [
        {
            "forecast_id": f"FGT-{i + 1}",
            "section_id": "PUNE-LNL",
            "date": str(base + timedelta(days=i)),
            "freight_level": level,
            "expected_trains_count": {"NORMAL": 8, "HIGH": 12, "SURGE": 16}[level],
            "busy_window_start": f"{base + timedelta(days=i)}T01:30:00",
            "busy_window_end": f"{base + timedelta(days=i)}T03:30:00",
            "confidence": 0.85,
        }
        for i, level in enumerate(levels)
    ]


def generate_users():
    return [
        {"user_id": "U-PLANNER-01", "name": "Sr. DOM Pune", "role": "Planner", "department": "Operations", "division": "Pune", "login_id": "planner"},
        {"user_id": "U-ENG-01", "name": "SSE P.Way", "role": "Engineering", "department": "Engineering", "division": "Pune", "login_id": "engg"},
        {"user_id": "U-SNT-01", "name": "SSE Signal", "role": "S&T", "department": "S&T", "division": "Pune", "login_id": "snt"},
        {"user_id": "U-TRC-01", "name": "SSE OHE", "role": "Traction", "department": "Traction", "division": "Pune", "login_id": "trac"},
    ]


def main():
    save_json("sections.json", generate_sections())
    save_json("stations.json", generate_stations())
    save_json("tracks.json", generate_tracks())
    save_json("jobs.json", generate_jobs(150))
    save_json("trains.json", generate_trains())
    save_json("freight_forecast.json", generate_freight())
    save_json("users.json", generate_users())
    print("\nPhase 1 mock data generated successfully.")


if __name__ == "__main__":
    main()
