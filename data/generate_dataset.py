import csv
import os
import random
from datetime import datetime, timedelta

# ============================================================
# MARS - Synthetic Railway Dataset V1
# Railway-realistic, fully synthetic data
# ============================================================

random.seed(42)

OUTPUT_DIR = "data/sample"
os.makedirs(OUTPUT_DIR, exist_ok=True)

START_DATE = datetime(2026, 8, 30)

def write_csv(filename, rows):
    if not rows:
        return

    filepath = os.path.join(OUTPUT_DIR, filename)

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Created: {filepath} ({len(rows)} records)")


# ============================================================
# 1. SECTIONS
# ============================================================

sections = [
    {
        "section_id": "S01",
        "section_start": "Pune",
        "section_end": "Lonavala",
        "distance_km": 64,
        "corridor_id": "C01",
        "line_type": "Double",
        "status": "Operational",
    },
    {
        "section_id": "S02",
        "section_start": "Lonavala",
        "section_end": "Karjat",
        "distance_km": 52,
        "corridor_id": "C01",
        "line_type": "Double",
        "status": "Operational",
    },
    {
        "section_id": "S03",
        "section_start": "Karjat",
        "section_end": "Kalyan",
        "distance_km": 67,
        "corridor_id": "C01",
        "line_type": "Double",
        "status": "Operational",
    },
    {
        "section_id": "S04",
        "section_start": "Pune",
        "section_end": "Daund",
        "distance_km": 75,
        "corridor_id": "C02",
        "line_type": "Double",
        "status": "Operational",
    },
    {
        "section_id": "S05",
        "section_start": "Daund",
        "section_end": "Ahmednagar",
        "distance_km": 120,
        "corridor_id": "C02",
        "line_type": "Single",
        "status": "Operational",
    },
    {
        "section_id": "S06",
        "section_start": "Ahmednagar",
        "section_end": "Manmad",
        "distance_km": 160,
        "corridor_id": "C02",
        "line_type": "Single",
        "status": "Operational",
    },
    {
        "section_id": "S07",
        "section_start": "Kalyan",
        "section_end": "Thane",
        "distance_km": 35,
        "corridor_id": "C03",
        "line_type": "Quadruple",
        "status": "Operational",
    },
    {
        "section_id": "S08",
        "section_start": "Thane",
        "section_end": "Mumbai",
        "distance_km": 32,
        "corridor_id": "C03",
        "line_type": "Quadruple",
        "status": "Operational",
    },
    {
        "section_id": "S09",
        "section_start": "Daund",
        "section_end": "Solapur",
        "distance_km": 180,
        "corridor_id": "C02",
        "line_type": "Double",
        "status": "Operational",
    },
    {
        "section_id": "S10",
        "section_start": "Solapur",
        "section_end": "Kalaburagi",
        "distance_km": 120,
        "corridor_id": "C02",
        "line_type": "Double",
        "status": "Operational",
    },
]

write_csv("sections.csv", sections)


# ============================================================
# 2. ASSETS
# ============================================================

asset_types = {
    "Track": 10,
    "Signal": 6,
    "OHE": 5,
    "Point": 4,
}

assets = []

asset_counter = 1

for asset_type, count in asset_types.items():

    for _ in range(count):

        section = random.choice(sections)

        criticality = random.choices(
            ["Low", "Medium", "High", "Critical"],
            weights=[10, 35, 40, 15],
            k=1,
        )[0]

        status = random.choices(
            ["Operational", "Faulty"],
            weights=[90, 10],
            k=1,
        )[0]

        assets.append({
            "asset_id": f"A{asset_counter:03d}",
            "asset_type": asset_type,
            "asset_name": f"{asset_type} Asset {asset_counter:03d}",
            "section_id": section["section_id"],
            "location_km": round(random.uniform(0, section["distance_km"]), 1),
            "criticality": criticality,
            "status": status,
            "installation_date": (
                START_DATE - timedelta(days=random.randint(365, 3650))
            ).strftime("%Y-%m-%d"),
            "last_maintenance_date": (
                START_DATE - timedelta(days=random.randint(20, 300))
            ).strftime("%Y-%m-%d"),
        })

        asset_counter += 1

write_csv("assets.csv", assets)


# ============================================================
# 3. MAINTENANCE JOBS
# ============================================================

departments = [
    "Engineering",
    "Traction",
    "S&T",
]

work_types = {
    "Engineering": [
        "Track Inspection",
        "Track Repair",
        "Rail Replacement",
        "Ballast Maintenance",
    ],
    "Traction": [
        "OHE Inspection",
        "OHE Repair",
        "Pantograph Clearance Check",
    ],
    "S&T": [
        "Signal Inspection",
        "Signal Repair",
        "Point Machine Maintenance",
    ],
}

maintenance_jobs = []

for i in range(1, 41):

    asset = random.choice(assets)

    department = {
        "Track": "Engineering",
        "Signal": "S&T",
        "OHE": "Traction",
        "Point": "S&T",
    }[asset["asset_type"]]

    priority = random.choices(
        ["Low", "Medium", "High", "Critical"],
        weights=[15, 35, 35, 15],
        k=1,
    )[0]

    duration = random.choice([
        30,
        45,
        60,
        75,
        90,
        120,
    ])

    deadline_days = {
        "Critical": random.randint(0, 2),
        "High": random.randint(1, 4),
        "Medium": random.randint(3, 7),
        "Low": random.randint(5, 10),
    }[priority]

    created_date = START_DATE - timedelta(
        days=random.randint(1, 30)
    )

    deadline = START_DATE + timedelta(days=deadline_days)

    maintenance_jobs.append({
        "job_id": f"J{i:03d}",
        "asset_id": asset["asset_id"],
        "department": department,
        "work_type": random.choice(work_types[department]),
        "description": f"Maintenance required for {asset['asset_id']}",
        "duration_min": duration,
        "priority": priority,
        "deadline": deadline.strftime("%Y-%m-%d"),
        "status": "Pending",
        "block_required": "Yes",
        "isolation_required": random.choice(["Yes", "No"]),
        "created_date": created_date.strftime("%Y-%m-%d"),
    })

write_csv("maintenance_jobs.csv", maintenance_jobs)


# ============================================================
# 4. BLOCK AVAILABILITY
# ============================================================

block_availability = []

block_id = 1

block_windows = [
    ("06:00", "08:00"),
    ("09:00", "11:00"),
    ("12:00", "14:00"),
    ("14:00", "16:00"),
    ("22:00", "00:00"),
]

for section in sections:

    # Create 2 blocks for most sections
    selected_windows = random.sample(
        block_windows,
        k=2
    )

    for start_time, end_time in selected_windows:

        if end_time == "00:00":
            duration = 120
        else:
            start_hour = int(start_time.split(":")[0])
            end_hour = int(end_time.split(":")[0])
            duration = (end_hour - start_hour) * 60

        block_availability.append({
            "block_id": f"B{block_id:03d}",
            "section_id": section["section_id"],
            "block_date": START_DATE.strftime("%Y-%m-%d"),
            "start_time": start_time,
            "end_time": end_time,
            "duration_min": duration,
            "status": "Available",
            "block_type": random.choice([
                "Planned",
                "Planned",
                "Emergency",
            ]),
            "restrictions": random.choice([
                "None",
                "Limited speed",
                "Engineering work only",
                "OHE work only",
            ]),
            "isolation_required": random.choice([
                "Yes",
                "No",
            ]),
        })

        block_id += 1

write_csv("block_availability.csv", block_availability)


# ============================================================
# 5. TRAIN SCHEDULE
# ============================================================

train_schedule = []

train_types = [
    "Passenger",
    "Passenger",
    "Passenger",
    "Express",
    "Goods",
]

for i in range(1, 31):

    train_type = random.choice(train_types)

    train_schedule.append({
        "train_id": f"T{i:03d}",
        "train_number": str(10000 + i),
        "train_type": train_type,
        "schedule_date": START_DATE.strftime("%Y-%m-%d"),
        "status": "Scheduled",
    })

write_csv("train_schedule.csv", train_schedule)


# ============================================================
# 6. TRAIN SECTIONS
# ============================================================

# Define realistic routes using section sequences.

routes = [
    ["S01", "S02", "S03", "S07", "S08"],
    ["S04", "S05", "S06"],
    ["S04", "S09", "S10"],
    ["S03", "S07", "S08"],
    ["S01", "S02"],
    ["S05", "S06"],
]

train_sections = []

for train in train_schedule:

    route = random.choice(routes)

    # Different starting times
    start_hour = random.randint(5, 20)
    start_minute = random.choice([0, 15, 30, 45])

    current_time = START_DATE.replace(
        hour=start_hour,
        minute=start_minute,
        second=0,
        microsecond=0,
    )

    for sequence, section_id in enumerate(route, start=1):

        # Travel time per section
        section = next(
            s for s in sections
            if s["section_id"] == section_id
        )

        # Approximate travel time
        travel_minutes = max(
            20,
            int(section["distance_km"] / 1.2)
        )

        arrival = current_time
        departure = current_time + timedelta(
            minutes=travel_minutes
        )

        train_sections.append({
            "train_section_id": f"TS{len(train_sections)+1:04d}",
            "train_id": train["train_id"],
            "section_id": section_id,
            "sequence": sequence,
            "arrival_time": arrival.strftime("%H:%M"),
            "departure_time": departure.strftime("%H:%M"),
        })

        # Add buffer between sections
        current_time = departure + timedelta(minutes=5)

write_csv("train_sections.csv", train_sections)


# ============================================================
# 7. GOODS TRAIN FORECAST
# ============================================================

goods_train_forecast = []

forecast_id = 1

forecast_windows = [
    ("06:00", "08:00"),
    ("09:00", "11:00"),
    ("12:00", "14:00"),
    ("14:00", "16:00"),
    ("18:00", "20:00"),
    ("22:00", "00:00"),
]

for section in sections:

    for start_time, end_time in random.sample(
        forecast_windows,
        k=3
    ):

        expected_trains = random.randint(0, 6)

        if expected_trains <= 1:
            traffic_level = "Low"
        elif expected_trains <= 3:
            traffic_level = "Medium"
        else:
            traffic_level = "High"

        confidence = round(
            random.uniform(0.70, 0.97),
            2
        )

        goods_train_forecast.append({
            "forecast_id": f"F{forecast_id:03d}",
            "section_id": section["section_id"],
            "forecast_date": START_DATE.strftime("%Y-%m-%d"),
            "start_time": start_time,
            "end_time": end_time,
            "expected_trains": expected_trains,
            "traffic_level": traffic_level,
            "confidence": confidence,
        })

        forecast_id += 1

write_csv(
    "goods_train_forecast.csv",
    goods_train_forecast
)


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 60)
print("MARS DATASET V1 CREATED")
print("=" * 60)

print(f"Sections:              {len(sections)}")
print(f"Assets:                {len(assets)}")
print(f"Maintenance Jobs:      {len(maintenance_jobs)}")
print(f"Blocks:                {len(block_availability)}")
print(f"Trains:                {len(train_schedule)}")
print(f"Train-Section records: {len(train_sections)}")
print(f"Goods forecasts:       {len(goods_train_forecast)}")

print("\nDataset location:")
print(os.path.abspath(OUTPUT_DIR))

print("\nFiles:")
for filename in sorted(os.listdir(OUTPUT_DIR)):
    print(f"  - {filename}")

print("\nDataset generation complete.")