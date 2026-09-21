# MARS
### Maintenance Allocation and Resource Scheduling

**SIH 2026 | Problem Statement ID: 26027**  
**Ministry of Railways — AI-Powered Automatic Block Planning**

MARS is an AI-powered decision-support system that automatically coordinates multi-department railway maintenance blocks (Engineering, S&T, Traction) with train and corridor availability to maximize fixed-asset availability while minimizing operational disruption.

## Core Capabilities
- Unified multi-department CP-SAT optimization (conflict-free by construction)
- AI/ML priority scoring (XGBoost) with dynamic risk escalation
- Weekly + Monthly planning horizons
- Satellite corridor map + interactive Gantt timeline
- Railway-rule compliance certificate (IRPWM / G&SR)
- REST adapter architecture for TMS, SMMS, TDMS, COA, BDMS

## Tech Stack
- **Backend:** Python, FastAPI, Pydantic, Google OR-Tools (CP-SAT), XGBoost
- **Frontend:** React, Tailwind CSS, Mapbox GL JS, react-calendar-timeline
- **Database:** PostgreSQL / SQLite
- **Deployment:** Docker

## Project Structure
```text
MARS/
├── backend/          # FastAPI + AI/Optimization engine
├── frontend/         # React dashboard (Planner + Departments)
├── data/             # Synthetic datasets + GeoJSON
└── docs/             # Architecture + references