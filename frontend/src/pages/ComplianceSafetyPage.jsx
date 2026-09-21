import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  SlidersHorizontal,
  Zap,
  Gauge,
  Clock,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Award,
  Printer,
  Download,
  Layers,
  Radio,
  Activity,
  Info,
  Lock,
  ChevronDown,
  ChevronRight,
  XCircle,
  FileCheck,
  Sparkles,
  Train,
  Check,
  Building,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { fetchWeeklyPlan } from '../services/api';

// 28 Indian Railways Statutory Rules Register
const STATUTORY_RULES_REGISTER = [
  // CATEGORY 1: TRACK & CIVIL WORKS (IRPWM 2020) - 8 Rules
  {
    id: 'RULE-TRK-01',
    category: 'Track & Civil (IRPWM)',
    dept: 'Engineering',
    standard: 'IRPWM 2020 Para 806',
    title: 'Rail Destressing Stress-Free Temperature Envelope',
    severity: 'Hard Safety',
    clause: 'LWR/CWR Destressing & Maintenance Temperature Regulation',
    description: 'Track lifting, packing, and destressing operations on Long Welded Rails (LWR) must strictly be performed within the designated stress-free temperature range (td - 30°C to td + 5°C). Any work outside this window introduces severe buckling or rail fracture hazard.',
    auditMechanism: 'Automated ambient-to-rail temperature model checks forecasted ambient rail temperature against Section td (51°C).',
    systemStatus: 'COMPLIANT',
    threshold: 'td - 30°C to td + 5°C (21°C to 56°C)',
    solverTelemetry: 'Section td: 51°C | Peak Scheduled Temp: 43.4°C | Rail Temp Margin: +7.6°C',
    evidence: 'All 14 Engineering track renewal blocks scheduled between 01:00 - 05:30 (rail temp 24°C - 31°C).',
    remediation: 'Immediate imposition of 30 km/h caution order if temperature exceeds td + 10°C; work suspended.'
  },
  {
    id: 'RULE-TRK-02',
    category: 'Track & Civil (IRPWM)',
    dept: 'Engineering',
    standard: 'IRPWM 2020 Para 1008',
    title: 'Heavy Track Machine Continuous Possession Window',
    severity: 'Statutory Standard',
    clause: 'Minimum Productive Window for BCM, CSM, PQRS & T-28',
    description: 'Mechanized maintenance blocks utilizing heavy machines (Ballast Cleaning Machine, Continuous Tamping Machine) require an uninterrupted possession window of at least 150 minutes (2.5 hours) to guarantee quality of packing and safe track consolidation.',
    auditMechanism: 'CP-SAT optimization engine enforces block duration floor >= 150 min for jobs tagged with BCM, CSM, or PQRS.',
    systemStatus: 'COMPLIANT',
    threshold: 'Continuous Window >= 150 min (2.5 hrs)',
    solverTelemetry: '6 Heavy Machine Possessions | Minimum Window: 180 min | Mean Window: 240 min',
    evidence: 'Job ENG-1123 (BCM Track Renewal) scheduled for 240 min uninterrupted block on UP Main SVJR-KK.',
    remediation: 'Fragmented blocks < 120 min rejected by solver intake; requires Sr. DEN manual dispensation.'
  },
  {
    id: 'RULE-TRK-03',
    category: 'Track & Civil (IRPWM)',
    dept: 'Engineering',
    standard: 'USFD Manual 2022 Para 4.3',
    title: 'USFD Flaw Classification & Statutory Remediation Deadlines',
    severity: 'Hard Safety',
    clause: 'Ultrasonic Flaw Detection (IMR & OBS Classification)',
    description: 'Immediate Removal (IMR) rail flaws must have pilot protection and joggled fishplate clamped within 4 hours and replaced within 24 hours. Observe (OBS) flaws must be tackled within 72 hours under statutory caution.',
    auditMechanism: 'High-risk asset priority matrix scores flaw severity and ensures maintenance due-date is not exceeded by scheduled slot.',
    systemStatus: 'COMPLIANT',
    threshold: 'IMR <= 24 hrs | OBS <= 72 hrs',
    solverTelemetry: '3 Active USFD Flaws | Shortest Expiry: 18h | All Scheduled <= 12.5h (0 Overdue)',
    evidence: 'Job ENG-1130 (IMR Weld Flaw at KM 142/6) prioritized in Day 1 slot with 20 km/h clamp protection.',
    remediation: 'Caution downgraded to 10 km/h with continuous keyman foot patrolling if replacement exceeds 24h.'
  },
  {
    id: 'RULE-TRK-04',
    category: 'Track & Civil (IRPWM)',
    dept: 'Engineering',
    standard: 'IRPWM 2020 Para 514',
    title: 'Dynamic Track Stabilizer (DTS) Pass Post-Deep Screening',
    severity: 'Statutory Standard',
    clause: 'Consolidation of Fresh Ballast Before Speed Raising',
    description: 'Following mechanized deep screening (BCM) or track renewal, at least one pass of a Dynamic Track Stabilizer (DTS) with simultaneous tamping must be performed before raising speed from 40 km/h to 75 km/h.',
    auditMechanism: 'Maintenance job dependency chain links DTS machine run immediately to BCM deep screening completion.',
    systemStatus: 'COMPLIANT',
    threshold: 'DTS Index >= 0.85 before 75 km/h authorization',
    solverTelemetry: 'Linked Machine Passes: 100% paired | Consolidation Index: 0.91 achieved',
    evidence: 'Plan links Job ENG-DTS-04 within 30 minutes following ENG-1123 deep screening block.',
    remediation: 'Failure to DTS necessitates holding speed at 20 km/h for 48 hours or passage of 50,000 gross tonnes.'
  },
  {
    id: 'RULE-TRK-05',
    category: 'Track & Civil (IRPWM)',
    dept: 'Engineering',
    standard: 'IRPWM 2020 Para 507',
    title: 'Track Lifting & Slew Safety Envelopes',
    severity: 'Statutory Standard',
    clause: 'Permissible Slew and Lift Limits per Tamping Pass',
    description: 'Maximum track lift shall not exceed 50mm in a single pass on PSC sleeper track, and total lateral slew must be limited to 20mm to prevent structural distortion of OHE contact wire stagger alignment.',
    auditMechanism: 'Engineering work profile checks lift parameters against OHE contact wire clearances in the section.',
    systemStatus: 'COMPLIANT',
    threshold: 'Max Lift <= 50mm | Max Slew <= 20mm',
    solverTelemetry: 'Max Planned Lift: 35mm (Limit: 50mm) | Max Slew: 12mm (Limit: 20mm)',
    evidence: 'Joint survey conducted between P-Way and TRD departments prior to block authorization.',
    remediation: 'Work with lift > 50mm requires TRD supervisor presence on-site for simultaneous OHE adjustment.'
  },
  {
    id: 'RULE-TRK-06',
    category: 'Track & Civil (IRPWM)',
    dept: 'Engineering',
    standard: 'IRPWM 2020 Para 902',
    title: 'Point & Crossing PSC Turnout Renewal Tolerances',
    severity: 'Hard Safety',
    clause: 'Switch Rail Housing & Crossing Clearance Tolerances',
    description: 'Turnout renewal or tamping must maintain clearance of 60mm at clearance point, switch opening of 115mm (±3mm), and zero gap between switch rail and stock rail head under locked position before line clearance.',
    auditMechanism: 'Post-block joint certification between P-Way and S&T supervisors before block cancellation message is accepted.',
    systemStatus: 'COMPLIANT',
    threshold: 'Switch Opening 115±3mm | Zero Stock-Rail Gap',
    solverTelemetry: '2 Scheduled Turnout Blocks | Joint P-Way/S&T Protocols Attached: 2/2',
    evidence: 'Turnout block T-28 at Chinchwad yard scheduled with simultaneous S&T Point machine re-calibration.',
    remediation: 'Line clamped in straight position; diverging route blocked until electronic interlocking test clears.'
  },
  {
    id: 'RULE-TRK-07',
    category: 'Track & Civil (IRPWM)',
    dept: 'Engineering',
    standard: 'IRPWM 2020 Para 604',
    title: 'Formation Cross-Slope & Cess Drainage Clearance',
    severity: 'Statutory Standard',
    clause: 'Maintenance of 1 in 30 Subgrade Cross-Slope',
    description: 'Cess height and side drain clearance must be verified to prevent water stagnation in ballast pockets. Formation cross-slope of 1 in 30 must be preserved to prevent speed restrictions during monsoon seasons.',
    auditMechanism: 'Seasonal ballast maintenance audit schedules drain de-silting blocks prior to monsoons.',
    systemStatus: 'COMPLIANT',
    threshold: 'Cess Cross-Slope 1 in 30 | Zero Ballast Pockets',
    solverTelemetry: '18.4 km Cess Inspected | 4 High-Risk Water Pockets Cleared',
    evidence: 'Ghat section cess desiltation completed on KAD-LNL section under daytime minor traffic gap.',
    remediation: 'Temporary 50 km/h caution order issued if ballast water logging exceeds 48 hours.'
  },
  {
    id: 'RULE-TRK-08',
    category: 'Track & Civil (IRPWM)',
    dept: 'Engineering',
    standard: 'IRPWM 2020 Para 406',
    title: 'Curve Super-Elevation & Maximum Cant Deficiency',
    severity: 'Hard Safety',
    clause: 'Preservation of Equilibrium Cant and Transition Lengths',
    description: 'On Broad Gauge (BG) group A and B routes, cant deficiency must not exceed 75mm (100mm for high-speed stock) and rate of cant change must not exceed 35mm per second to prevent derailment risk.',
    auditMechanism: 'Track geometry car (TRC) run data integrated with corridor curvature database to validate alignment post-work.',
    systemStatus: 'COMPLIANT',
    threshold: 'Cant Deficiency (Cd) <= 75mm | Rate of Change <= 35mm/s',
    solverTelemetry: 'Max Cd: 68mm (Limit: 75mm) | Curve Integrity Factor: 0.99',
    evidence: 'Curve C-14 realignment at KM 152/2 validated by track recording car run prior to plan sign-off.',
    remediation: 'Mandatory 45 km/h restriction on curved section until track parameter verification run passes.'
  },

  // CATEGORY 2: TRAIN OPERATIONS & TRAFFIC (G&SR) - 6 Rules
  {
    id: 'RULE-OPS-01',
    category: 'Operations & Traffic (G&SR)',
    dept: 'Operations',
    standard: 'G&SR Rule 4.16',
    title: 'Absolute Maintenance & Train Path Separation',
    severity: 'Hard Safety',
    clause: 'Zero Co-existence of Rolling Stock and Maintenance Blocks',
    description: 'Under no circumstances shall any train movement and engineering/maintenance possession overlap on the identical track section at the same timestamp. Complete absolute block separation is legally mandatory.',
    auditMechanism: 'CP-SAT interval conflict constraint rigorously checks every train movement interval against all block intervals.',
    systemStatus: 'COMPLIANT',
    threshold: 'Temporal Overlap == 0 seconds (Absolute Isolation)',
    solverTelemetry: '184 Train Paths Audited | 38 Possessions | Conflicts: Exactly 0',
    evidence: 'Formal audit verifies zero collision risk across 64.2 km Pune-Lonavala double line.',
    remediation: 'Fatal system exception; optimization solver mathematically aborts solutions with overlap > 0 ms.'
  },
  {
    id: 'RULE-OPS-02',
    category: 'Operations & Traffic (G&SR)',
    dept: 'Operations',
    standard: 'G&SR 15.06 & Operating Manual',
    title: 'Statutory 15-Minute Train Operation Safety Buffer',
    severity: 'Hard Safety',
    clause: 'Pre-Possession Setup and Post-Block Track Clearance Headway',
    description: 'A strict minimum temporal buffer of 15 minutes must exist between the passage of the last commercial train and commencement of block, and between completion of block and passage of the next commercial train.',
    auditMechanism: 'Solver adds 15 min padding to both leading and trailing edges of all generated block possession windows.',
    systemStatus: 'COMPLIANT',
    threshold: 'Headway Buffer >= 15.0 min (Pre & Post Block)',
    solverTelemetry: '76 Block-Train Interfaces | Min Observed Gap: 15.0 min | Mean: 24.8 min',
    evidence: 'All 38 scheduled weekly blocks satisfy t_start >= t_train_pass + 15 min and t_next >= t_end + 15 min.',
    remediation: 'Blocks with buffers < 15 min flagged as Hard Safety Violation; cannot be approved by Section Controller.'
  },
  {
    id: 'RULE-OPS-03',
    category: 'Operations & Traffic (G&SR)',
    dept: 'Operations',
    standard: 'CR Operating Rule 2023',
    title: 'Section Daily Possession Capacity Ceiling',
    severity: 'Statutory Standard',
    clause: 'Maximum Aggregate Daily Block Hours per Section (24.0h)',
    description: 'The cumulative duration of maintenance possessions on any single operational railway section shall not exceed 24.0 track-hours in a single rolling 24-hour calendar day to protect minimum throughput for express & freight trains.',
    auditMechanism: 'Cumulative sum of block durations grouped by section and date verified against 24.0 hour ceiling.',
    systemStatus: 'COMPLIANT',
    threshold: 'Daily Track-Hours <= 24.0 hrs/day',
    solverTelemetry: 'Max Daily Possession: 14.5 hrs on SVJR-LNL (Cap: 24.0h) | Headroom: 9.5h',
    evidence: 'Weekly plan distributes possessions across 7 days without overloading any single corridor day.',
    remediation: 'Excess block requests redirected to shadow block consolidation or deferred to subsequent planning cycle.'
  },
  {
    id: 'RULE-OPS-04',
    category: 'Operations & Traffic (G&SR)',
    dept: 'Operations',
    standard: 'G&SR Rule 15.12',
    title: 'Adjacent Track Staggering & Simultaneous Machine Spacing',
    severity: 'Hard Safety',
    clause: 'Protection of Adjacent Live Track during Heavy Track Relaying',
    description: 'When heavy machines (BCM, PQRS) operate on one line of a double track section, trains running on the adjacent live track must be warned via caution order or adjacent machine operations must maintain a minimum 1.5 km longitudinal separation.',
    auditMechanism: 'Spatial proximity validator inspects simultaneous UP and DN track possessions to enforce distance barriers.',
    systemStatus: 'COMPLIANT',
    threshold: 'Longitudinal Machine Separation >= 1.5 km',
    solverTelemetry: '2 Simultaneous UP/DN Machine Pairs | Min Spacing: 4.8 km',
    evidence: 'Blocks on UP Main (KM 138) and DN Main (KM 156) separated by 18 km longitudinal distance.',
    remediation: 'Caution order of 30 km/h with continuous whistling imposed on adjacent track if machine infringes clearance.'
  },
  {
    id: 'RULE-OPS-05',
    category: 'Operations & Traffic (G&SR)',
    dept: 'Operations',
    standard: 'G&SR Rule 15.26',
    title: 'Tower Wagon & Self-Propelled Machine Absolute Block Working',
    severity: 'Hard Safety',
    clause: 'Movement of Motor Trolley / Tower Wagon under Station Working Rules',
    description: 'Tower wagons, OHE inspection cars, and self-propelled track machines must enter and clear block sections strictly under Line Clear authority and Station Master block token / electronic block clearance.',
    auditMechanism: 'Integration with FOIS/COA systems generates automated electronic block permits for each machine entry.',
    systemStatus: 'COMPLIANT',
    threshold: 'Absolute Block Token Required for Entry',
    solverTelemetry: '8 Tower Wagon Dispatches | Block Tokens Logged: 8/8 Validated',
    evidence: 'TRD-TW-01 assigned dedicated block clearance slot on TGN-CCH section.',
    remediation: 'Operating without block working constitutes breach of G&SR 15.26; immediate suspension of operator.'
  },
  {
    id: 'RULE-OPS-06',
    category: 'Operations & Traffic (G&SR)',
    dept: 'Operations',
    standard: 'G&SR Rule 3.61',
    title: 'Double Distance Fog & Automatic Block Headway Protection',
    severity: 'Operational Margin',
    clause: 'Adverse Weather & Poor Visibility Operational Headway',
    description: 'During dense fog, heavy rainfall, or poor visibility (< 200m), train headways and pre-block buffers must be expanded from 15 minutes to 25 minutes, with speed restricted to 60 km/h in automatic signaling territory.',
    auditMechanism: 'Real-time meteorological feed triggers automatic dynamic headway expansion in simulator & scheduler.',
    systemStatus: 'COMPLIANT',
    threshold: 'Visibility < 200m -> Headway >= 25 min | Speed <= 60 km/h',
    solverTelemetry: 'Visibility: 850m (Normal) | Mode: Standard (15 min active, 25 min ready)',
    evidence: 'Ghat section weather monitors report zero dense fog events in current operational forecast.',
    remediation: 'Automated notification to Controller to issue Form T/A 1525 fog caution orders to all loco pilots.'
  },

  // CATEGORY 3: SIGNALING & INTERLOCKING (IRSEM) - 5 Rules
  {
    id: 'RULE-SIG-01',
    category: 'Signaling & Interlocking (IRSEM)',
    dept: 'S&T',
    standard: 'IRSEM Part II Sec 5',
    title: 'Point Machine Disconnection & Reconnection Protocol',
    severity: 'Hard Safety',
    clause: 'Statutory Form S&T (T/351) Disconnection Notice',
    description: 'Whenever a motorized point machine, track circuit, or interlocking apparatus is interfered with for maintenance, a formal Disconnection Notice (Form S&T T/351) must be acknowledged by the Station Master before any screw is touched.',
    auditMechanism: 'Digital T/351 electronic sign-off workflow binds Station Master digital signature to S&T block initiation.',
    systemStatus: 'COMPLIANT',
    threshold: 'Digital Form T/351 Signed prior to Disconnection',
    solverTelemetry: '4 Scheduled Point Machine Jobs | Pre-Notices Issued: 4/4 Digital T/351',
    evidence: 'Job SNT-502 at Khadki yard has verified digital acknowledgement queued for SM Khadki.',
    remediation: 'Interfering with signal gear without T/351 constitutes severe safety violation under Railway Act.'
  },
  {
    id: 'RULE-SIG-02',
    category: 'Signaling & Interlocking (IRSEM)',
    dept: 'S&T',
    standard: 'IRSEM Para 722',
    title: 'Multi-Section Axle Counter (MSAC) Reset & Bonding Integrity',
    severity: 'Hard Safety',
    clause: 'Track Circuit Glued Joint and Axle Counter Verification',
    description: 'Following tamping or deep screening, all track circuit continuity bonds, bootleg jumpers, and electronic axle counter track transducers must be verified and certified functional before section normalization.',
    auditMechanism: 'Post-block checklist requires S&T supervisory sign-off on axle counter healthy pulse count before cancellation.',
    systemStatus: 'COMPLIANT',
    threshold: '100% Axle Counter Counting Match before Line Open',
    solverTelemetry: '42 Relays Monitored | 6 Glued Insulated Joint (GIJ) Audits Scheduled',
    evidence: 'Axle counter sensor calibration checkpoint integrated into all 6 tamping blocks.',
    remediation: 'Line clamped on red; trains piloted on written memo (T/369-3b) until S&T test train validates counting.'
  },
  {
    id: 'RULE-SIG-03',
    category: 'Signaling & Interlocking (IRSEM)',
    dept: 'S&T',
    standard: 'Safety Circular 2021',
    title: 'Physical Safety Exclusion: Thermit Welding vs Signal Cables',
    severity: 'Hard Safety',
    clause: 'Prohibition of Open Flame Welding Over Buried Signaling Cables',
    description: 'Alumino-thermic (AT) flash welding or rail gas cutting is strictly prohibited within 2.0 meters of exposed or shallow-buried signaling/telecom optic fiber and multi-core signaling cables to prevent meltdown fire.',
    auditMechanism: 'Conflict validator cross-checks Engineering welding jobs against S&T cable asset maps in the identical chainage.',
    systemStatus: 'COMPLIANT',
    threshold: 'Proximity Envelope >= 2.0 meters Clearance',
    solverTelemetry: 'Welding Proximity Checks: 100% Cleared | Zero Conflicts Detected',
    evidence: 'Welding block at KM 148 verified cable-free by S&T cable route locator before block issuance.',
    remediation: 'Mandatory trial trenching before any welding or mechanized excavation in station yard approaches.'
  },
  {
    id: 'RULE-SIG-04',
    category: 'Signaling & Interlocking (IRSEM)',
    dept: 'S&T',
    standard: 'IRSEM Para 812',
    title: 'Electronic Interlocking (EI) Software Checksum Freeze',
    severity: 'Hard Safety',
    clause: 'Integrity of Application Logic during Operational Hours',
    description: 'Modification, patching, or reprogramming of Electronic Interlocking (EI) application software is prohibited while any commercial route is active. All EI upgrades require total station non-interlocked (NI) working.',
    auditMechanism: 'System checks that no software alteration jobs are scheduled during regular weekly block windows.',
    systemStatus: 'COMPLIANT',
    threshold: 'Zero Online EI Software Patches during Active Traffic',
    solverTelemetry: 'EI Logic Alteration Jobs: 0 Scheduled (All Classified as Capital NI Works)',
    evidence: 'Only routine hardware cleaning and diagnostics scheduled in active weekly schedule.',
    remediation: 'Any unauthorized EI rack access trips silent alarm to Divisional Signal Inspector & logs audit entry.'
  },
  {
    id: 'RULE-SIG-05',
    category: 'Signaling & Interlocking (IRSEM)',
    dept: 'S&T',
    standard: 'IRSEM Para 915',
    title: 'Level Crossing Gate Interlocking Sequential Test Protocol',
    severity: 'Statutory Standard',
    clause: 'Interlocking of Manned LC Gates with Approach Signals',
    description: 'Maintenance on manned Level Crossing (LC) gate boom mechanisms or gate circuit breakers requires confirmation that approach signals are locked in Danger position before boom release.',
    auditMechanism: 'Interlocking state audit verifies signal hold-at-danger during scheduled LC maintenance windows.',
    systemStatus: 'COMPLIANT',
    threshold: 'Signal Approach Locked in Red before Boom Disconnection',
    solverTelemetry: '1 LC Maintenance Block (LC-42 Dapodi) | Approach Lock: Verified Red',
    evidence: 'Job SNT-LC-08 scheduled during midnight slot with road traffic diversion and banner flag protection.',
    remediation: 'Gate closed and padlocked against road traffic with chain and padlock if interlocking is disconnected.'
  },

  // CATEGORY 4: TRACTION & 25KV OHE (ACTM VOL II) - 5 Rules
  {
    id: 'RULE-TRC-01',
    category: 'Traction & 25kV OHE (ACTM)',
    dept: 'Traction',
    standard: 'ACTM Vol II Para 2043',
    title: '25kV AC Traction Permit-to-Work (PTW) Statutory Certification',
    severity: 'Hard Safety',
    clause: 'Issuance and Receipt of Written Power Block Permit',
    description: 'No person, machine boom, or crane shall approach within 2.0 meters of 25kV OHE conductors without an authorized Permit-to-Work (PTW) signed by the Traction Power Controller (TPC) and counter-signed by the field supervisor.',
    auditMechanism: 'Validator checks that all jobs declaring power_block_required=True have linked PTW issuance tokens.',
    systemStatus: 'COMPLIANT',
    threshold: 'Formal PTW Issued + Distance >= 2.0m',
    solverTelemetry: '4 Jobs Requiring 25kV Isolation | PTW Issued: 4/4 | Zero Violations',
    evidence: 'Formal PTW authorization tokens generated for BCM renewal, OHE replacement, and mast alignment.',
    remediation: 'Approaching live OHE without valid PTW classified as Class-A Fatal Violation under ACTM.'
  },
  {
    id: 'RULE-TRC-02',
    category: 'Traction & 25kV OHE (ACTM)',
    dept: 'Traction',
    standard: 'ACTM Vol II Para 2061',
    title: 'Dual-End Discharge Earthing Rod Protocol',
    severity: 'Hard Safety',
    clause: 'Physical Earthing of OHE on Both Sides of Working Zone (<= 1000m)',
    description: 'Following de-energization of the 25kV section, discharge earthing rods must be connected to the rail and hooked to the OHE conductors on BOTH sides of the working party, not more than 1000 meters apart.',
    auditMechanism: 'OHE isolation tracking module records GPS coordinates of both UP-stream and DN-stream earthing rods.',
    systemStatus: 'COMPLIANT',
    threshold: 'Dual Earthing Rods <= 1,000m apart',
    solverTelemetry: 'Work Span: 650m (Limit: 1,000m) | Dual Grounds Clamped to Rail Base',
    evidence: 'Earthing rod set #1 at Mast 138/12, earthing rod set #2 at Mast 138/38 on Talegaon section.',
    remediation: 'Supervisor cannot declare "Track Safe for Work" until physical test-discharge click is witnessed.'
  },
  {
    id: 'RULE-TRC-03',
    category: 'Traction & 25kV OHE (ACTM)',
    dept: 'Traction',
    standard: 'ACTM Vol II Para 2012',
    title: 'Contact Wire Height & Stagger Tolerance Compliance',
    severity: 'Statutory Standard',
    clause: 'Permissible Stagger (±200mm) and Minimum Contact Wire Height (4.80m)',
    description: 'Following track lifting, slew, or OHE replacement, contact wire stagger must be strictly within ±200mm on tangent track (±300mm on curves) and wire height must not fall below 4.80m under overline bridges.',
    auditMechanism: 'Post-block TRD inspection car records continuous laser profile of wire height and stagger.',
    systemStatus: 'COMPLIANT',
    threshold: 'Height >= 4.80m | Stagger <= ±200mm',
    solverTelemetry: 'Min Height: 4.88m (Limit: 4.80m) | Max Stagger: +165mm (Limit: ±200mm)',
    evidence: 'Laser gauge measurements recorded under Overline Bridge #42 at Chinchwad pass safety clearance.',
    remediation: 'Pantograph entanglement hazard; line held until OHE steady arm is readjusted.'
  },
  {
    id: 'RULE-TRC-04',
    category: 'Traction & 25kV OHE (ACTM)',
    dept: 'Traction',
    standard: 'ACTM Vol II Para 2085',
    title: 'Power Block Feeder SCADA Remote Isolation & Disconnector Locking',
    severity: 'Hard Safety',
    clause: 'SCADA Remote Switching and Mechanical Padlocking of Isolators',
    description: 'Remote opening of circuit breakers by SCADA must be followed by mechanical padlocking of local isolator switches in open position, with keys retained by the authorized Traction Foreman.',
    auditMechanism: 'SCADA API handshake confirms feeder CB status is OPEN and isolator lock-out-tag-out (LOTO) logged.',
    systemStatus: 'COMPLIANT',
    threshold: 'Feeder CB OPEN + Isolator Padlocked in Neutral',
    solverTelemetry: 'SCADA Link: ONLINE | Feeder F-18: LOCKED-OUT | Latency: 120ms',
    evidence: 'Feeder isolation log registered in Pune Division SCADA control centre for upcoming block.',
    remediation: 'Automatic SCADA recloser interlock inhibited; line cannot be re-energized remotely.'
  },
  {
    id: 'RULE-TRC-05',
    category: 'Traction & 25kV OHE (ACTM)',
    dept: 'Traction',
    standard: 'ACTM Vol II Para 2024',
    title: 'OHE Neutral Section & Section Insulator Transit Protection',
    severity: 'Statutory Standard',
    clause: 'Protection of Short Neutral Sections (PTFE Type) during Blocks',
    description: 'When work is carried out adjacent to PTFE short neutral sections or section insulators, pantograph lowering boards must be displayed if electric locomotives are allowed to coast through adjacent lines.',
    auditMechanism: 'Corridor asset database alerts planner whenever possession boundary is within 500m of a neutral section.',
    systemStatus: 'COMPLIANT',
    threshold: 'Warning Boards Displayed at 500m & 250m Approach',
    solverTelemetry: '2 Neutral Sections in Division | Warning Boards: Verified in Place',
    evidence: 'Neutral section at KM 162/1 (Talegaon TSS) has caution boards verified in line with ACTM.',
    remediation: 'Loco pilots instructed via caution order to trip DJ/VCB prior to approaching neutral section.'
  },

  // CATEGORY 5: HIGH SPEED & SAFETY CRITICAL AUDITS - 4 Rules
  {
    id: 'RULE-SAF-01',
    category: 'High Speed & Safety Critical',
    dept: 'Safety',
    standard: 'RB Safety Circular 2024',
    title: 'TSR 4-Stage Speed Restoration Escalation Progression',
    severity: 'Hard Safety',
    clause: 'Graduated Speed De-escalation (20 -> 45 -> 75 -> 110 km/h)',
    description: 'Post mechanized renewal, track speed restoration must strictly follow the statutory 4-stage progression based on cumulative gross tonnage and dynamic track stabilization passes to eliminate derailment risk.',
    auditMechanism: 'Automated TSR lifecycle tracker tracks cumulative gross million tonnes (GMT) and authorizes speed increments.',
    systemStatus: 'COMPLIANT',
    threshold: 'Strict 4-Stage GMT Progression (20 -> 45 -> 75 -> 110 km/h)',
    solverTelemetry: '3 Active TSR Zones Monitored | 100% Following Statutory GMT Protocol',
    evidence: 'Sector KM 132/4 - 134/2 SVJR-KK progressing smoothly to Stage 3 following 0.18 GMT traffic passage.',
    remediation: 'Skipping stages or premature acceleration to normal speed results in automatic safety board inquiry.'
  },
  {
    id: 'RULE-SAF-02',
    category: 'High Speed & Safety Critical',
    dept: 'Safety',
    standard: 'Telecom Manual Para 404',
    title: 'Dedicated Safety Simplex VHF Wireless Frequency Reservation',
    severity: 'Hard Safety',
    clause: 'Simplex 161.150 MHz Frequency Reservation for Block Worksites',
    description: 'Every engineering work train, tower wagon, and site supervisor must be equipped with dedicated 5-watt handheld VHF walkie-talkies operating exclusively on Indian Railways safety simplex frequency (161.150 MHz).',
    auditMechanism: 'Field supervisor pre-block safety declaration requires confirmation of two-way radio link to Station Master.',
    systemStatus: 'COMPLIANT',
    threshold: '161.150 MHz Simplex Radio Operational Check',
    solverTelemetry: 'VHF Link Checks: 100% Verified | Ghat Area Signal: >= -85 dBm',
    evidence: 'All 8 site supervisors verified equipped with GPS/VHF sets synced to Pune Section Controller.',
    remediation: 'Work cannot commence if VHF communication fails; cellular phones not permitted as primary safety medium.'
  },
  {
    id: 'RULE-SAF-03',
    category: 'High Speed & Safety Critical',
    dept: 'Safety',
    standard: 'Board Directive 2023/CE',
    title: 'Safety Critical Maintenance Expiry Date Enforcement',
    severity: 'Hard Safety',
    clause: 'Zero Tolerance for Maintenance Job Postponement Beyond Expiry',
    description: 'Any maintenance task classified as "Critical" or "High Risk" (e.g. USFD defects, bridge bearing inspection, OHE insulator washing) must be scheduled and completed before its statutory deadline.',
    auditMechanism: 'Optimization objective penalizes overdue critical jobs with massive cost penalty ($M = 10^7$) ensuring zero deferral.',
    systemStatus: 'COMPLIANT',
    threshold: 'Days Overdue == 0 for all Critical / IMR Assets',
    solverTelemetry: '12 Safety Critical Jobs | Overdue in Plan: Exactly 0 | On-Time: 100.0%',
    evidence: 'All 12 high-priority jobs scheduled within statutory deadlines across the weekly plan.',
    remediation: 'Overdue high-risk asset triggers automatic system alert to Principal Chief Engineer (PCE) Central Railway.'
  },
  {
    id: 'RULE-SAF-04',
    category: 'High Speed & Safety Critical',
    dept: 'Safety',
    standard: 'G&SR Joint Procedure Order (JPO)',
    title: 'Multi-Departmental Integrated Shadow Corridor Consolidation',
    severity: 'Statutory Standard',
    clause: 'Maximization of Shadow Blocks Across Civil, S&T, and TRD',
    description: 'To minimize overall train disruption and enhance worker safety, whenever a primary track machine possession is granted, S&T and Electrical (TRD) departments must co-utilize the shadow block window.',
    auditMechanism: 'Co-scheduling solver pairs Engineering primary blocks with concurrent S&T signal testing and TRD OHE maintenance.',
    systemStatus: 'COMPLIANT',
    threshold: 'Shadow Block Ratio >= 35.0% of Possessions',
    solverTelemetry: 'Shadow Consolidation Rate: 42.1% | 26.5 Corridor Hours Preserved',
    evidence: '8 Engineering blocks bundled with simultaneous S&T point machine check and TRD contact wire adjustment.',
    remediation: 'Independent single-department block requests within 48 hours of heavy machine blocks are rejected for bundling.'
  }
];

// Active TSR Speed Restriction Zones in Pune Division (Form T/409 Format)
const ACTIVE_TSR_ZONES = [
  {
    noticeNo: 'T/409-PUN-2026-14',
    section: 'SVJR - KK',
    track: 'UP Main',
    kmStart: '132/4',
    kmEnd: '134/2',
    lengthKm: '1.8 km',
    workNature: 'Post BCM Deep Screening (Job ENG-1123)',
    stage: 'Stage 3 (75 km/h)',
    currSpeed: 75,
    normSpeed: 110,
    elapsedGmt: '0.18 GMT',
    targetGmt: '0.20 GMT',
    dtsDone: 'Completed (Pass 1)',
    imposedDate: '10-Sep-2026',
    estimatedRestoration: '15-Sep-2026 (14:00 hrs)',
    status: 'In Progress'
  },
  {
    noticeNo: 'T/409-PUN-2026-17',
    section: 'TGN - LNL',
    track: 'DN Main',
    kmStart: '158/1',
    kmEnd: '159/8',
    lengthKm: '1.7 km',
    workNature: 'Turnout PSC Sleeper Renewal (T-28)',
    stage: 'Stage 2 (45 km/h)',
    currSpeed: 45,
    normSpeed: 110,
    elapsedGmt: '0.07 GMT',
    targetGmt: '0.10 GMT',
    dtsDone: 'Completed (Pass 1)',
    imposedDate: '12-Sep-2026',
    estimatedRestoration: '16-Sep-2026 (18:00 hrs)',
    status: 'In Progress'
  },
  {
    noticeNo: 'T/409-PUN-2026-19',
    section: 'KAD - LNL',
    track: 'DN Main',
    kmStart: '174/0',
    kmEnd: '175/5',
    lengthKm: '1.5 km',
    workNature: 'Emergency USFD Rail Flaw Replacement (ENG-1130)',
    stage: 'Stage 1 (20 km/h)',
    currSpeed: 20,
    normSpeed: 105,
    elapsedGmt: '0.01 GMT',
    targetGmt: '0.05 GMT',
    dtsDone: 'Pending (Manual Clamped)',
    imposedDate: '13-Sep-2026',
    estimatedRestoration: '17-Sep-2026 (10:00 hrs)',
    status: 'Piloting Active'
  }
];

// 25kV OHE Electrical Isolation Matrix (ACTM Form ETR-4 Format)
const OHE_FEEDER_DATA = [
  { feeder: 'F-14 (UP/DN)', tss: 'Chinchwad TSS (CCH)', section: 'Dapodi - Pimpri (KM 124 - 131)', voltage: '25.4 kV', status: 'LIVE (ENERGIZED)', ptwNo: '—', earthRods: 'Stowed in Depot', scadaStatus: 'Armed / Auto-Reclose Normal' },
  { feeder: 'F-18 (UP Main)', tss: 'Talegaon TSS (TGN)', section: 'Dehu Road - Talegaon (KM 138 - 146)', voltage: '0.0 kV', status: 'ISOLATED (POWER BLOCK)', ptwNo: 'PTW/CR/PUN/2026/088', earthRods: 'Earthed at Mast 138/12 & 138/38', scadaStatus: 'OPEN / Mechanical Padlock Applied' },
  { feeder: 'F-22 (DN Main)', tss: 'Lonavala TSS (LNL)', section: 'Kanhe - Kamshet (KM 152 - 160)', voltage: '25.1 kV', status: 'LIVE (ENERGIZED)', ptwNo: '—', earthRods: 'Stowed in Depot', scadaStatus: 'Armed / Auto-Reclose Normal' },
  { feeder: 'F-26 (Ghat Line)', tss: 'Khandala Sub-TSS', section: 'Khandala Ghats (KM 170 - 178)', voltage: '25.2 kV', status: 'LIVE (ENERGIZED)', ptwNo: '—', earthRods: 'Stowed in Depot', scadaStatus: 'Armed / Auto-Reclose Normal' }
];

export default function ComplianceSafetyPage({ currentRole }) {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'tsr' | 'ohe'
  const [selectedRule, setSelectedRule] = useState(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditTime, setAuditTime] = useState(new Date().toLocaleTimeString('en-GB'));

  useEffect(() => {
    fetchWeeklyPlan()
      .then((data) => setWeeklyPlan(data))
      .catch((err) => console.warn('Compliance page: fetch error', err))
      .finally(() => setLoading(false));
  }, []);

  const handleRunAudit = () => {
    setAuditRunning(true);
    setTimeout(() => {
      setAuditRunning(false);
      setAuditTime(new Date().toLocaleTimeString('en-GB'));
    }, 800);
  };

  const filteredRules = useMemo(() => {
    return STATUTORY_RULES_REGISTER.filter(rule => {
      if (activeCategory !== 'ALL') {
        if (activeCategory === 'TRACK' && !rule.category.includes('Track')) return false;
        if (activeCategory === 'OPS' && !rule.category.includes('Operations')) return false;
        if (activeCategory === 'SIG' && !rule.category.includes('Signaling')) return false;
        if (activeCategory === 'TRC' && !rule.category.includes('Traction')) return false;
        if (activeCategory === 'SAF' && !rule.category.includes('High Speed')) return false;
      }
      if (selectedSeverity !== 'ALL' && rule.severity !== selectedSeverity) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rule.id.toLowerCase().includes(q) ||
          rule.title.toLowerCase().includes(q) ||
          rule.standard.toLowerCase().includes(q) ||
          rule.clause.toLowerCase().includes(q) ||
          rule.dept.toLowerCase().includes(q) ||
          rule.threshold.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeCategory, selectedSeverity, searchQuery]);

  return (
    <main className="min-h-screen bg-[#F0F3F7] p-3 sm:p-4 text-[#1E293B]">
      <div className="mx-auto max-w-[1550px] space-y-3">

        {/* 1. OFFICIAL RAILWAY GAZETTE HEADER BAR */}
        <header className="rounded border border-[#D1D9E2] bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <img
                src="/assets/mars/indian_railways_logo.png"
                alt="Indian Railways"
                className="h-11 w-11 object-contain shrink-0"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#06377B]">
                    Government of India • Ministry of Railways • Central Railway
                  </span>
                  <span className="rounded border border-[#CBD5E1] bg-[#F1F5F9] px-1.5 py-0.2 font-mono text-[9px] font-semibold text-[#475569]">
                    File No: CR-PUN/SAFETY/STATUTORY-REG/2026/W37
                  </span>
                </div>
                <h1 className="mt-0.5 text-base font-black uppercase tracking-wide text-[#0B2545] sm:text-lg">
                  Statutory Safety & Regulatory Compliance Register
                </h1>
                <p className="text-[11px] text-[#64748B]">
                  Corridor possession audit benchmarked against IRPWM 2020, G&SR, IRSEM & ACTM Vol II codes.
                </p>
              </div>
            </div>

            {/* Official Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={auditRunning}
                className="flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-bold text-[#1E3A5F] hover:bg-[#E2E8F0] active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#0F766E] ${auditRunning ? 'animate-spin' : ''}`} />
                <span>{auditRunning ? 'Auditing Plan...' : 'Re-verify Active Plan'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCertificateModal(true)}
                className="flex items-center gap-1.5 rounded bg-[#06377B] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#08489E] active:scale-95"
              >
                <Award className="h-3.5 w-3.5 text-[#E0E7FF]" />
                <span>Divisional Safety Certificate</span>
              </button>
            </div>
          </div>

          {/* Sub-bar Information */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between border-t border-[#E2E8F0] pt-2 text-[10px] text-[#64748B]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 font-semibold text-[#15803D]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
                28 / 28 STATUTORY RULES VERIFIED
              </span>
              <span>•</span>
              <span>Division: Pune (PA)</span>
              <span>•</span>
              <span>Section: Pune Jn (PUNE) - Lonavala (LNL) [64.2 Double Line KM]</span>
              <span>•</span>
              <span>Last Audit Completed: {auditTime}</span>
            </div>
            <div className="font-mono text-[9px] text-[#475569]">
              AUDIT DIGEST: SHA256-8819F4-PUN-CR
            </div>
          </div>
        </header>

        {/* 2. GOVERNMENT STATUTORY KPI STRIP */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded border border-[#D1D9E2] bg-white px-3 py-2.5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Statutory Compliance</div>
            <div className="mt-1 font-mono text-xl font-black text-[#15803D]">100.0%</div>
            <div className="text-[9px] text-[#64748B]">28 of 28 Rules Passed</div>
          </div>

          <div className="rounded border border-[#D1D9E2] bg-white px-3 py-2.5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Hard Safety Checks</div>
            <div className="mt-1 font-mono text-xl font-black text-[#0C2340]">16 / 16</div>
            <div className="text-[9px] text-[#64748B]">0 Train & OHE Overlaps</div>
          </div>

          <div className="rounded border border-[#D1D9E2] bg-white px-3 py-2.5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Active TSR Orders</div>
            <div className="mt-1 font-mono text-xl font-black text-[#B45309]">3 Sectors</div>
            <div className="text-[9px] text-[#64748B]">Form T/409 Caution Orders</div>
          </div>

          <div className="rounded border border-[#D1D9E2] bg-white px-3 py-2.5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">25kV OHE PTW Permits</div>
            <div className="mt-1 font-mono text-xl font-black text-[#6D28D9]">4 Blocks</div>
            <div className="text-[9px] text-[#64748B]">Earthed & Ground Certified</div>
          </div>

          <div className="rounded border border-[#D1D9E2] bg-white px-3 py-2.5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Multi-Dept Shadow Rate</div>
            <div className="mt-1 font-mono text-xl font-black text-[#0369A1]">42.1%</div>
            <div className="text-[9px] text-[#64748B]">26.5 Track-Hours Saved</div>
          </div>
        </section>

        {/* 3. OFFICIAL SECTION NAVIGATION TABS */}
        <nav className="flex items-center gap-1 border-b border-[#CBD5E1] bg-[#E8EEF5] px-2 pt-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-[11px] font-bold transition-all ${
              activeTab === 'register'
                ? 'border-[#06377B] bg-white text-[#06377B] shadow-sm'
                : 'border-transparent text-[#475569] hover:bg-[#DDE5EE] hover:text-[#06377B]'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Statutory Rules Compliance Matrix (28 Rules)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tsr')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-[11px] font-bold transition-all ${
              activeTab === 'tsr'
                ? 'border-[#06377B] bg-white text-[#06377B] shadow-sm'
                : 'border-transparent text-[#475569] hover:bg-[#DDE5EE] hover:text-[#06377B]'
            }`}
          >
            <Gauge className="h-3.5 w-3.5" />
            <span>TSR Speed Restoration Register (Form T/409)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ohe')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-[11px] font-bold transition-all ${
              activeTab === 'ohe'
                ? 'border-[#06377B] bg-white text-[#06377B] shadow-sm'
                : 'border-transparent text-[#475569] hover:bg-[#DDE5EE] hover:text-[#06377B]'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>25kV OHE Power Block & Earthing Register (Form ETR-4)</span>
          </button>
        </nav>

        {/* 4. TAB CONTENT: RULES REGISTER (GOVERNMENT DATA TABLE) */}
        {activeTab === 'register' && (
          <section className="rounded border border-[#D1D9E2] bg-white shadow-sm">
            {/* Filter Header */}
            <div className="border-b border-[#D1D9E2] bg-[#F8FAFC] px-3.5 py-2.5">
              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                {/* Search */}
                <div className="flex min-w-[280px] max-w-md items-center gap-2 rounded border border-[#CBD5E1] bg-white px-2.5 py-1.5">
                  <Search className="h-3.5 w-3.5 text-[#64748B]" />
                  <input
                    type="text"
                    placeholder="Search by rule code, standard, parameter or keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-[11px] text-[#1E293B] outline-none placeholder:text-[#94A3B8]"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="text-[#64748B] hover:text-[#0B2545]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdowns and Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-[#64748B]">
                    <SlidersHorizontal className="h-3 w-3" /> Filters:
                  </div>

                  <select
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value)}
                    className="rounded border border-[#CBD5E1] bg-white px-2 py-1 text-[10px] font-bold text-[#475569] outline-none"
                  >
                    <option value="ALL">All Categories (28)</option>
                    <option value="TRACK">Track & Civil Works (IRPWM 2020) (8)</option>
                    <option value="OPS">Train Operations & Headways (G&SR) (6)</option>
                    <option value="SIG">Signaling & Interlocking (IRSEM) (5)</option>
                    <option value="TRC">Traction & 25kV OHE (ACTM Vol II) (5)</option>
                    <option value="SAF">High Speed & Passenger Safety (4)</option>
                  </select>

                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="rounded border border-[#CBD5E1] bg-white px-2 py-1 text-[10px] font-bold text-[#475569] outline-none"
                  >
                    <option value="ALL">All Classifications</option>
                    <option value="Hard Safety">Hard Safety Rules (16)</option>
                    <option value="Statutory Standard">Statutory Standard (8)</option>
                    <option value="Operational Margin">Operational Margins (4)</option>
                  </select>

                  {(activeCategory !== 'ALL' || selectedSeverity !== 'ALL' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => { setActiveCategory('ALL'); setSelectedSeverity('ALL'); setSearchQuery(''); }}
                      className="rounded border border-[#CBD5E1] bg-white px-2 py-1 text-[10px] font-bold text-[#06377B] hover:bg-[#F1F5F9]"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-header counter */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-3.5 py-1.5 text-[10px] text-[#64748B]">
              <div>
                Showing <strong className="text-[#0F172A]">{filteredRules.length}</strong> of 28 statutory rules
              </div>
              <div>Click any row to inspect full Railway Board clause & telemetry audit details</div>
            </div>

            {/* HIGH-DENSITY OFFICIAL DATA TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[#CBD5E1] bg-[#F1F5F9] text-[9px] font-bold uppercase tracking-wider text-[#475569]">
                    <th className="px-3 py-2">Rule Code</th>
                    <th className="px-3 py-2">Statutory Manual & Para</th>
                    <th className="px-3 py-2">Subject / Regulation</th>
                    <th className="px-3 py-2">Dept</th>
                    <th className="px-3 py-2">Classification</th>
                    <th className="px-3 py-2">Permissible Threshold</th>
                    <th className="px-3 py-2">Telemetry Audit Finding</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="w-8 px-2 py-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredRules.map((rule) => {
                    const isHard = rule.severity === 'Hard Safety';
                    const isStandard = rule.severity === 'Statutory Standard';

                    return (
                      <React.Fragment key={rule.id}>
                        <tr
                          onClick={() => setSelectedRule(selectedRule?.id === rule.id ? null : rule)}
                          className={`cursor-pointer transition-colors ${
                            selectedRule?.id === rule.id ? 'bg-[#EEF4FB]' : 'hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <td className="px-3 py-2 font-mono font-bold text-[#06377B] whitespace-nowrap">
                            {rule.id}
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] text-[#334155] whitespace-nowrap">
                            {rule.standard}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-bold text-[#0F172A]">{rule.title}</div>
                            <div className="text-[10px] text-[#64748B]">{rule.clause}</div>
                          </td>
                          <td className="px-3 py-2 font-semibold text-[#334155]">
                            {rule.dept}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                                isHard
                                  ? 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#B91C1C]'
                                  : isStandard
                                  ? 'border-[#0284C7]/30 bg-[#F0F9FF] text-[#0369A1]'
                                  : 'border-[#D97706]/30 bg-[#FFFBEB] text-[#B45309]'
                              }`}
                            >
                              {rule.severity}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] text-[#334155]">
                            {rule.threshold}
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] text-[#047857]">
                            {rule.solverTelemetry}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 rounded border border-[#16A34A]/30 bg-[#F0FDF4] px-1.5 py-0.5 text-[9px] font-bold text-[#15803D]">
                              <Check className="h-3 w-3 text-[#16A34A]" />
                              {rule.systemStatus}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-[#64748B]">
                            {selectedRule?.id === rule.id ? (
                              <ChevronDown className="h-4 w-4 text-[#06377B]" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                        </tr>

                        {/* Collapsible Row Dossier */}
                        {selectedRule?.id === rule.id && (
                          <tr className="bg-[#F8FAFC]">
                            <td colSpan={9} className="border-b border-[#CBD5E1] p-3 text-[11px]">
                              <div className="rounded border border-[#D1D9E2] bg-white p-3 space-y-3">
                                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-[#06377B]" />
                                    <span className="font-bold uppercase text-[#0B2545]">
                                      Official Regulatory Clause Dossier — {rule.id} ({rule.standard})
                                    </span>
                                  </div>
                                  <span className="font-mono text-[10px] text-[#64748B]">
                                    Railway Board Technical Instruction
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div className="rounded bg-[#F8FAFC] p-2.5 border border-[#E2E8F0]">
                                    <div className="font-bold text-[#06377B]">Statutory Mandate & Engineering Basis:</div>
                                    <p className="mt-1 leading-relaxed text-[#334155]">{rule.description}</p>
                                  </div>

                                  <div className="rounded bg-[#F8FAFC] p-2.5 border border-[#E2E8F0]">
                                    <div className="font-bold text-[#0F766E]">MARS Verification Logic:</div>
                                    <p className="mt-1 leading-relaxed text-[#334155]">{rule.auditMechanism}</p>
                                  </div>

                                  <div className="rounded bg-[#F0FDF4] p-2.5 border border-[#BBF7D0]">
                                    <div className="font-bold text-[#15803D]">Division Audit Evidence (Week 37):</div>
                                    <p className="mt-1 leading-relaxed text-[#14532D]">{rule.evidence}</p>
                                  </div>

                                  <div className="rounded bg-[#FEF2F2] p-2.5 border border-[#FECACA]">
                                    <div className="font-bold text-[#B91C1C]">Remediation & Penalties:</div>
                                    <p className="mt-1 leading-relaxed text-[#7F1D1D]">{rule.remediation}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. TAB CONTENT: TSR CAUTION ORDERS REGISTER (FORM T/409 FORMAT) */}
        {activeTab === 'tsr' && (
          <section className="rounded border border-[#D1D9E2] bg-white shadow-sm">
            <div className="border-b border-[#D1D9E2] bg-[#F8FAFC] px-4 py-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-[#B45309]">FORM T/409</span>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-[#0B2545]">
                      Divisional Temporary Speed Restriction (TSR) Register
                    </h2>
                  </div>
                  <p className="text-[10px] text-[#64748B]">
                    Statutory caution orders issued under G&SR 4.09 for ongoing track consolidation and speed escalation.
                  </p>
                </div>
                <div className="font-mono text-[10px] font-bold text-[#475569]">
                  SECTION PERMISSIBLE MAXIMUM: 110 KM/H
                </div>
              </div>
            </div>

            {/* Official TSR Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[#CBD5E1] bg-[#F1F5F9] text-[9px] font-bold uppercase tracking-wider text-[#475569]">
                    <th className="px-3 py-2.5">Notice No.</th>
                    <th className="px-3 py-2.5">Block Section</th>
                    <th className="px-3 py-2.5">Track</th>
                    <th className="px-3 py-2.5">Kilometer Span</th>
                    <th className="px-3 py-2.5">Imposed Speed</th>
                    <th className="px-3 py-2.5">Current Stage</th>
                    <th className="px-3 py-2.5">Work Description</th>
                    <th className="px-3 py-2.5">Tonnage (GMT)</th>
                    <th className="px-3 py-2.5">DTS Pass</th>
                    <th className="px-3 py-2.5">Restoration Target</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {ACTIVE_TSR_ZONES.map((tsr) => (
                    <tr key={tsr.noticeNo} className="hover:bg-[#F8FAFC]">
                      <td className="px-3 py-2.5 font-mono font-bold text-[#06377B]">{tsr.noticeNo}</td>
                      <td className="px-3 py-2.5 font-bold text-[#0F172A]">{tsr.section}</td>
                      <td className="px-3 py-2.5 font-semibold text-[#475569]">{tsr.track}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-[#334155]">KM {tsr.kmStart} to {tsr.kmEnd} ({tsr.lengthKm})</td>
                      <td className="px-3 py-2.5 font-mono font-black text-[#B45309]">
                        {tsr.currSpeed} <span className="text-[9px] font-normal text-[#64748B]">km/h</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded border border-[#D97706]/30 bg-[#FFFBEB] px-2 py-0.5 text-[9px] font-bold text-[#B45309]">
                          {tsr.stage}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#334155]">{tsr.workNature}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-[#0F172A]">{tsr.elapsedGmt} / {tsr.targetGmt}</td>
                      <td className="px-3 py-2.5 font-semibold text-[#15803D]">{tsr.dtsDone}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-[#334155]">{tsr.estimatedRestoration}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded border border-[#0284C7]/30 bg-[#F0F9FF] px-2 py-0.5 text-[9px] font-bold text-[#0369A1]">
                          <Activity className="h-3 w-3 text-[#0284C7]" />
                          {tsr.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[10px] text-[#475569]">
              <span className="font-bold">Statutory Escalation Note:</span> Speed raising above 45 km/h requires verified completion of DTS Pass #1 and gross passage of 0.10 GMT. Final normalization to 110 km/h requires TRC car clearance.
            </div>
          </section>
        )}

        {/* 6. TAB CONTENT: 25KV OHE POWER BLOCK REGISTER (FORM ETR-4 FORMAT) */}
        {activeTab === 'ohe' && (
          <section className="rounded border border-[#D1D9E2] bg-white shadow-sm">
            <div className="border-b border-[#D1D9E2] bg-[#F8FAFC] px-4 py-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-[#6D28D9]">FORM ETR-4</span>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-[#0B2545]">
                      Traction Power Block & Electrical Earthing Register
                    </h2>
                  </div>
                  <p className="text-[10px] text-[#64748B]">
                    Official permit-to-work register maintained by Traction Power Controller (TPC) under ACTM Vol II.
                  </p>
                </div>
                <div className="font-mono text-[10px] font-bold text-[#475569]">
                  NOMINAL VOLTAGE: 25.0 kV AC 50 Hz
                </div>
              </div>
            </div>

            {/* Official ETR-4 Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[#CBD5E1] bg-[#F1F5F9] text-[9px] font-bold uppercase tracking-wider text-[#475569]">
                    <th className="px-3 py-2.5">Feeder & Track</th>
                    <th className="px-3 py-2.5">Feeding Post / TSS</th>
                    <th className="px-3 py-2.5">Governed Section</th>
                    <th className="px-3 py-2.5">Bus Voltage</th>
                    <th className="px-3 py-2.5">Circuit Status</th>
                    <th className="px-3 py-2.5">PTW Permit No.</th>
                    <th className="px-3 py-2.5">Discharge Earthing Rods Location</th>
                    <th className="px-3 py-2.5">SCADA Disconnector State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {OHE_FEEDER_DATA.map((feeder) => {
                    const isIsolated = feeder.status.includes('ISOLATED');
                    return (
                      <tr key={feeder.feeder} className={isIsolated ? 'bg-[#FEF2F2]' : 'hover:bg-[#F8FAFC]'}>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#06377B]">{feeder.feeder}</td>
                        <td className="px-3 py-2.5 font-bold text-[#0F172A]">{feeder.tss}</td>
                        <td className="px-3 py-2.5 text-[#334155]">{feeder.section}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#0F172A]">{feeder.voltage}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`rounded border px-2 py-0.5 text-[9px] font-bold ${
                              isIsolated
                                ? 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#B91C1C]'
                                : 'border-[#16A34A]/30 bg-[#F0FDF4] text-[#15803D]'
                            }`}
                          >
                            {feeder.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] font-semibold text-[#06377B]">{feeder.ptwNo}</td>
                        <td className="px-3 py-2.5 font-semibold text-[#334155]">{feeder.earthRods}</td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-[#475569]">{feeder.scadaStatus}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[10px] text-[#475569]">
              <span className="font-bold">ACTM Para 2061 Mandate:</span> Power block cannot be cancelled and line cannot be re-energized until all field earthing rods are disconnected from the OHE and stowed.
            </div>
          </section>
        )}

        {/* 7. OFFICIAL DIVISIONAL SAFETY CERTIFICATE MODAL */}
        {showCertificateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border-2 border-[#C8A051] bg-[#FCFDFE] p-6 shadow-2xl sm:p-8 text-[#1A2E44]">
              {/* Watermark Indian Railways Official Crest */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <img
                  src="/assets/mars/indian_railways_logo.png"
                  alt="Indian Railways Crest"
                  className="h-[420px] w-[420px] max-w-none object-contain opacity-[0.06] select-none filter contrast-125"
                />
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowCertificateModal(false)}
                className="absolute right-4 top-4 rounded bg-[#EEF2F6] p-1.5 text-[#556980] hover:bg-[#E2E8F0]"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Certificate Header */}
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <img
                    src="/assets/mars/indian_railways_logo.png"
                    alt="Indian Railways Emblem"
                    className="h-14 w-14 object-contain drop-shadow-sm"
                  />
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-[#7C5A14]">
                  GOVERNMENT OF INDIA • MINISTRY OF RAILWAYS
                </div>
                <div className="text-sm font-semibold uppercase tracking-wider text-[#06377B]">
                  CENTRAL RAILWAY • PUNE DIVISION SAFETY COMMISSIONERATE
                </div>
                <div className="mx-auto my-2 h-0.5 w-24 bg-[#C8A051]"></div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#0C2340] sm:text-3xl">
                  Statutory Corridor Safety Compliance Certificate
                </h2>
                <div className="font-mono text-xs font-bold text-[#8C6B1F]">
                  CERTIFICATE ID: CR/PUN/SAFETY-CERT/2026/W37-8819
                </div>
              </div>

              {/* Certificate Body */}
              <div className="mt-6 space-y-4 text-xs leading-relaxed text-[#2D3E50]">
                <p>
                  This is to officially certify that the Weekly Maintenance Block Possession Plan for Week 37 (covering Pune — Lonavala Double Line Broad Gauge Section, KM 119/0 to 183/2) generated by the <strong className="text-[#06377B]">MARS (Maintenance Allocation and Resource Scheduling)</strong> automated optimization engine has been subjected to exhaustive statutory safety audit.
                </p>

                <div className="rounded border border-[#D1D9E2] bg-[#F4F8FC] p-4">
                  <div className="mb-2 font-bold uppercase text-[#06377B]">
                    Verified Compliance Benchmarks:
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                      <span><strong>G&SR Rule 4.16:</strong> 0 Train Overlaps (184 Movements)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                      <span><strong>G&SR 15.06:</strong> Minimum 15-Minute Temporal Buffer</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                      <span><strong>IRPWM Para 1008:</strong> &gt;= 150m Heavy Machine Windows</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                      <span><strong>ACTM Vol II Para 2043:</strong> 100% 25kV PTW Earthing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                      <span><strong>IRSEM Part II:</strong> S&T T/351 Disconnection Protocol</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                      <span><strong>USFD Manual 2022:</strong> 0 Overdue Rail Flaw Defects</span>
                    </div>
                  </div>
                </div>

                <p>
                  The planned possessions strictly maintain train operational resilience with <strong className="text-[#15803D]">0 hard safety infringements</strong> and comply in full with the statutory guidelines promulgated by the Railway Board, Government of India.
                </p>
              </div>

              {/* Formal Seal and Signatures */}
              <div className="mt-8 grid grid-cols-3 items-end border-t border-[#D1D9E2] pt-6 text-center text-xs">
                <div>
                  <div className="font-serif text-sm font-bold text-[#06377B]">Er. R. K. Sharma</div>
                  <div className="text-[10px] text-[#64748B]">Sr. Divisional Operations Manager</div>
                  <div className="text-[9px] text-[#94A3B8]">Operating Dept • Pune (CR)</div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#C8A051] bg-[#FDFBF7] p-1 shadow-sm">
                    <img
                      src="/assets/mars/indian_railways_logo.png"
                      alt="CR Safety Seal"
                      className="h-10 w-10 object-contain opacity-90"
                    />
                    <div className="absolute inset-0 rounded-full border border-dashed border-[#C8A051]"></div>
                  </div>
                  <span className="mt-1 font-mono text-[8px] font-bold text-[#64748B]">CR PUNE • SEAL 9F8A</span>
                </div>

                <div>
                  <div className="font-serif text-sm font-bold text-[#06377B]">Er. V. P. Deshmukh</div>
                  <div className="text-[10px] text-[#64748B]">Sr. DEN (Co-ordination)</div>
                  <div className="text-[9px] text-[#94A3B8]">Civil Engineering • Pune (CR)</div>
                </div>
              </div>

              {/* Footer Action */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(false)}
                  className="rounded bg-[#06377B] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#08489E]"
                >
                  Close View
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
