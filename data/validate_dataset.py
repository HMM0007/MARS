import csv
import os
from datetime import datetime

# ============================================================
# MARS - Dataset Validation Script
# ============================================================

DATA_DIR = os.path.join(
    os.path.dirname(__file__),
    "sample"
)

FILES = {
    "sections": "sections.csv",
    "assets": "assets.csv",
    "maintenance_jobs": "maintenance_jobs.csv",
    "block_availability": "block_availability.csv",
    "train_schedule": "train_schedule.csv",
    "train_sections": "train_sections.csv",
    "goods_train_forecast": "goods_train_forecast.csv",
}


# ============================================================
# Helpers
# ============================================================

def load_csv(filename):
    path = os.path.join(DATA_DIR, filename)

    if not os.path.exists(path):
        print(f"❌ Missing file: {filename}")
        return []

    with open(path, "r", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def check_columns(data, required_columns, table_name):
    if not data:
        return False

    actual_columns = set(data[0].keys())

    missing = set(required_columns) - actual_columns

    if missing:
        print(
            f"❌ {table_name}: Missing columns → "
            f"{', '.join(sorted(missing))}"
        )
        return False

    print(f"✓ {table_name}: Required columns present")
    return True


def check_unique_ids(data, column, table_name):
    ids = [row[column] for row in data]

    duplicates = {
        value for value in ids
        if ids.count(value) > 1
    }

    if duplicates:
        print(
            f"❌ {table_name}: Duplicate {column} → "
            f"{', '.join(duplicates)}"
        )
        return False

    print(f"✓ {table_name}: {column} values are unique")
    return True


# ============================================================
# Load datasets
# ============================================================

print("=" * 65)
print("MARS DATASET VALIDATION")
print("=" * 65)

sections = load_csv(FILES["sections"])
assets = load_csv(FILES["assets"])
jobs = load_csv(FILES["maintenance_jobs"])
blocks = load_csv(FILES["block_availability"])
trains = load_csv(FILES["train_schedule"])
train_sections = load_csv(FILES["train_sections"])
forecasts = load_csv(FILES["goods_train_forecast"])


# ============================================================
# File existence
# ============================================================

print("\n[1] FILE CHECK")
print("-" * 65)

all_files_exist = True

for key, filename in FILES.items():
    path = os.path.join(DATA_DIR, filename)

    if os.path.exists(path):
        print(f"✓ {filename}")
    else:
        print(f"❌ {filename}")
        all_files_exist = False


if not all_files_exist:
    print("\n❌ Validation stopped because files are missing.")
    exit(1)


# ============================================================
# Required columns
# ============================================================

print("\n[2] COLUMN CHECK")
print("-" * 65)

check_columns(
    sections,
    [
        "section_id",
        "section_start",
        "section_end",
        "distance_km",
        "corridor_id",
    ],
    "Sections",
)

check_columns(
    assets,
    [
        "asset_id",
        "asset_type",
        "section_id",
        "criticality",
        "status",
    ],
    "Assets",
)

check_columns(
    jobs,
    [
        "job_id",
        "asset_id",
        "department",
        "duration_min",
        "priority",
        "deadline",
    ],
    "Maintenance Jobs",
)

check_columns(
    blocks,
    [
        "block_id",
        "section_id",
        "block_date",
        "start_time",
        "end_time",
        "duration_min",
    ],
    "Blocks",
)

check_columns(
    trains,
    [
        "train_id",
        "train_number",
        "train_type",
        "schedule_date",
    ],
    "Train Schedule",
)

check_columns(
    train_sections,
    [
        "train_section_id",
        "train_id",
        "section_id",
        "sequence",
        "arrival_time",
        "departure_time",
    ],
    "Train Sections",
)

check_columns(
    forecasts,
    [
        "forecast_id",
        "section_id",
        "forecast_date",
        "start_time",
        "end_time",
        "expected_trains",
        "traffic_level",
        "confidence",
    ],
    "Goods Forecast",
)


# ============================================================
# Duplicate ID checks
# ============================================================

print("\n[3] DUPLICATE ID CHECK")
print("-" * 65)

check_unique_ids(
    sections,
    "section_id",
    "Sections",
)

check_unique_ids(
    assets,
    "asset_id",
    "Assets",
)

check_unique_ids(
    jobs,
    "job_id",
    "Maintenance Jobs",
)

check_unique_ids(
    blocks,
    "block_id",
    "Blocks",
)

check_unique_ids(
    trains,
    "train_id",
    "Train Schedule",
)

check_unique_ids(
    train_sections,
    "train_section_id",
    "Train Sections",
)

check_unique_ids(
    forecasts,
    "forecast_id",
    "Goods Forecast",
)


# ============================================================
# Foreign-key / relationship checks
# ============================================================

print("\n[4] RELATIONSHIP CHECK")
print("-" * 65)

section_ids = {
    row["section_id"]
    for row in sections
}

asset_ids = {
    row["asset_id"]
    for row in assets
}

train_ids = {
    row["train_id"]
    for row in trains
}


# Assets → Sections

invalid_assets = [
    row["asset_id"]
    for row in assets
    if row["section_id"] not in section_ids
]

if invalid_assets:
    print(
        f"❌ Assets → Sections broken: "
        f"{', '.join(invalid_assets)}"
    )
else:
    print("✓ Assets → Sections")


# Jobs → Assets

invalid_jobs = [
    row["job_id"]
    for row in jobs
    if row["asset_id"] not in asset_ids
]

if invalid_jobs:
    print(
        f"❌ Jobs → Assets broken: "
        f"{', '.join(invalid_jobs)}"
    )
else:
    print("✓ Maintenance Jobs → Assets")


# Blocks → Sections

invalid_blocks = [
    row["block_id"]
    for row in blocks
    if row["section_id"] not in section_ids
]

if invalid_blocks:
    print(
        f"❌ Blocks → Sections broken: "
        f"{', '.join(invalid_blocks)}"
    )
else:
    print("✓ Blocks → Sections")


# Train Sections → Trains

invalid_train_refs = [
    row["train_section_id"]
    for row in train_sections
    if row["train_id"] not in train_ids
]

if invalid_train_refs:
    print(
        f"❌ Train Sections → Trains broken: "
        f"{', '.join(invalid_train_refs)}"
    )
else:
    print("✓ Train Sections → Trains")


# Train Sections → Sections

invalid_train_sections = [
    row["train_section_id"]
    for row in train_sections
    if row["section_id"] not in section_ids
]

if invalid_train_sections:
    print(
        f"❌ Train Sections → Sections broken: "
        f"{', '.join(invalid_train_sections)}"
    )
else:
    print("✓ Train Sections → Sections")


# Forecasts → Sections

invalid_forecasts = [
    row["forecast_id"]
    for row in forecasts
    if row["section_id"] not in section_ids
]

if invalid_forecasts:
    print(
        f"❌ Forecasts → Sections broken: "
        f"{', '.join(invalid_forecasts)}"
    )
else:
    print("✓ Goods Forecasts → Sections")


# ============================================================
# Value validation
# ============================================================

print("\n[5] VALUE CHECK")
print("-" * 65)

value_errors = False


# Distance

for row in sections:
    try:
        distance = float(row["distance_km"])

        if distance <= 0:
            print(
                f"❌ Invalid distance in {row['section_id']}"
            )
            value_errors = True

    except ValueError:
        print(
            f"❌ Invalid distance in {row['section_id']}"
        )
        value_errors = True


# Job duration

for row in jobs:
    try:
        duration = int(row["duration_min"])

        if duration <= 0:
            print(
                f"❌ Invalid duration in {row['job_id']}"
            )
            value_errors = True

    except ValueError:
        print(
            f"❌ Invalid duration in {row['job_id']}"
        )
        value_errors = True


# Block duration

for row in blocks:
    try:
        duration = int(row["duration_min"])

        if duration <= 0:
            print(
                f"❌ Invalid block duration in {row['block_id']}"
            )
            value_errors = True

    except ValueError:
        print(
            f"❌ Invalid block duration in {row['block_id']}"
        )
        value_errors = True


# Forecast values

for row in forecasts:

    try:
        trains_count = int(row["expected_trains"])

        if trains_count < 0:
            print(
                f"❌ Invalid expected train count "
                f"in {row['forecast_id']}"
            )
            value_errors = True

    except ValueError:
        print(
            f"❌ Invalid expected train count "
            f"in {row['forecast_id']}"
        )
        value_errors = True

    try:
        confidence = float(row["confidence"])

        if not 0 <= confidence <= 1:
            print(
                f"❌ Invalid confidence "
                f"in {row['forecast_id']}"
            )
            value_errors = True

    except ValueError:
        print(
            f"❌ Invalid confidence "
            f"in {row['forecast_id']}"
        )
        value_errors = True


if not value_errors:
    print("✓ Numeric values are valid")


# ============================================================
# Time validation
# ============================================================

print("\n[6] TIME FORMAT CHECK")
print("-" * 65)

time_errors = False


def validate_time(value, field_name, record_id):

    global time_errors

    try:
        datetime.strptime(value, "%H:%M")
    except ValueError:
        print(
            f"❌ Invalid time '{value}' "
            f"in {field_name} ({record_id})"
        )
        time_errors = True


for row in blocks:
    validate_time(
        row["start_time"],
        "start_time",
        row["block_id"],
    )

    validate_time(
        row["end_time"],
        "end_time",
        row["block_id"],
    )


for row in train_sections:
    validate_time(
        row["arrival_time"],
        "arrival_time",
        row["train_section_id"],
    )

    validate_time(
        row["departure_time"],
        "departure_time",
        row["train_section_id"],
    )


for row in forecasts:
    validate_time(
        row["start_time"],
        "start_time",
        row["forecast_id"],
    )

    validate_time(
        row["end_time"],
        "end_time",
        row["forecast_id"],
    )


if not time_errors:
    print("✓ Time formats are valid")


# ============================================================
# Job → Potential Block Check
# ============================================================

print("\n[7] JOB / BLOCK FEASIBILITY CHECK")
print("-" * 65)

asset_to_section = {
    row["asset_id"]: row["section_id"]
    for row in assets
}

section_blocks = {}

for block in blocks:

    section_blocks.setdefault(
        block["section_id"],
        []
    ).append(block)


jobs_without_blocks = []

for job in jobs:

    section_id = asset_to_section.get(
        job["asset_id"]
    )

    possible_blocks = section_blocks.get(
        section_id,
        []
    )

    job_duration = int(
        job["duration_min"]
    )

    has_suitable_block = any(
        int(block["duration_min"]) >= job_duration
        for block in possible_blocks
    )

    if not has_suitable_block:
        jobs_without_blocks.append(
            job["job_id"]
        )


if jobs_without_blocks:

    print(
        "⚠ Jobs currently have no block large enough:"
    )

    print(
        ", ".join(jobs_without_blocks)
    )

    print(
        "This is not necessarily an error; "
        "these jobs may require rescheduling."
    )

else:

    print(
        "✓ Every job has at least one "
        "potentially suitable block"
    )


# ============================================================
# Dataset Summary
# ============================================================

print("\n[8] DATASET SUMMARY")
print("-" * 65)

print(f"Sections:              {len(sections)}")
print(f"Assets:                {len(assets)}")
print(f"Maintenance Jobs:      {len(jobs)}")
print(f"Blocks:                {len(blocks)}")
print(f"Trains:                {len(trains)}")
print(f"Train-Section records: {len(train_sections)}")
print(f"Goods Forecasts:       {len(forecasts)}")


# ============================================================
# Final result
# ============================================================

print("\n" + "=" * 65)

if not value_errors and not time_errors:
    print("✅ DATASET VALIDATION COMPLETED")
    print("MARS Dataset V1 is structurally ready.")
else:
    print("⚠ DATASET VALIDATION FOUND ISSUES")
    print("Review the messages above.")

print("=" * 65)