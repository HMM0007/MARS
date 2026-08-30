import { useEffect, useMemo, useState } from 'react'
import { clearSession, type MarsSession } from './auth'
import { checkAllocation, fetchConflicts, fetchJobs, fetchNotifications, fetchPlanBlocks, fetchPlanJobs, fetchPlanSummary, fetchTrains, generateOptimizationPlan, triggerReplanning } from './services/api'
import PlannerGantt from './PlannerGantt'

type Props = { session: MarsSession; onLogout: () => void }
type Job = Record<string, any>
type Block = Record<string, any>
const departments = ['All', 'Engineering', 'S&T', 'Traction']
const views = ['Control Centre', 'Requests', 'Block Allocation', 'Calendar / Gantt', 'Proposed Plan', 'Re-planning', 'Alerts']
const fmt = (v: any, fallback = '—') => v === undefined || v === null || v === '' ? fallback : String(v)
const tone = (v: any) => { const s = String(v || '').toUpperCase(); return s.includes('CRITICAL') || s.includes('CONFLICT') || s.includes('REJECT') ? 'danger' : s.includes('HIGH') || s.includes('UNSCHEDULED') || s.includes('WARNING') ? 'warn' : s.includes('SCHEDULED') || s.includes('AVAILABLE') || s.includes('APPROVED') ? 'ok' : 'info' }

export default function PlannerControlCentreV2({ session, onLogout }: Props) {
  const [view, setView] = useState('Control Centre')
  const [department, setDepartment] = useState('All')
  const [jobs, setJobs] = useState<Job[]>([])
  const [planJobs, setPlanJobs] = useState<Job[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [trains, setTrains] = useState<any[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [review, setReview] = useState<any>({ status: 'PENDING_REVIEW' })
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null)
  const [allocation, setAllocation] = useState<any>(null)
  const [disruption, setDisruption] = useState('')
  const [message, setMessage] = useState<{type:'success'|'error'|'info', text:string}|null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const dept = department === 'All' ? undefined : department
      const [jr, pj, br, tr, cr, nr, sr] = await Promise.all([
        fetchJobs({ department: dept }), fetchPlanJobs({ department: dept || '' }), fetchPlanBlocks(), fetchTrains(), fetchConflicts(), fetchNotifications('Divisional Planner'), fetchPlanSummary(),
      ])
      setJobs(jr?.jobs || []); setPlanJobs(pj?.jobs || []); setBlocks(br?.blocks || []); setTrains(tr?.trains || []); setConflicts(cr?.conflicts || []); setNotifications(nr?.notifications || []); setSummary(sr || {})
    } catch (e) { setMessage({ type:'error', text:e instanceof Error ? e.message : 'Unable to load planner data.' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [department])

  const filteredJobs = useMemo(() => jobs.filter(j => (department === 'All' || j.department === department) && (!query || [j.job_id,j.work_type,j.section,j.block,j.department].some(v => String(v||'').toLowerCase().includes(query.toLowerCase())))), [jobs, department, query])
  const scheduled = planJobs.filter(j => String(j.plan_status).toUpperCase() === 'SCHEDULED')
  const unscheduled = planJobs.filter(j => String(j.plan_status).toUpperCase() !== 'SCHEDULED')
  const departmentsCount = departments.slice(1).map(d => ({ d, n: jobs.filter(j => j.department === d).length }))

  const optimize = async () => {
    setBusy(true); setMessage({type:'info', text:'Running the existing CP-SAT optimizer. No optimizer code is being changed.'})
    try { const r = await generateOptimizationPlan(); setMessage({type:'success', text:`Optimization ${fmt(r?.status,'completed')}. The new plan is now the Current Active Plan.`}); await load(); setView('Proposed Plan') }
    catch (e) { setMessage({type:'error', text:e instanceof Error ? e.message : 'Optimization failed.'}) }
    finally { setBusy(false) }
  }
  const check = async () => {
    if (!selectedJob || !selectedBlock) return
    setBusy(true); setAllocation(null)
    try { setAllocation(await checkAllocation(String(selectedJob.job_id), String(selectedBlock.block_id))) }
    catch (e) { setAllocation({ feasible:false, reason:e instanceof Error ? e.message : 'Allocation check failed.' }) }
    finally { setBusy(false) }
  }
  const replan = async () => {
    if (!disruption) { setMessage({type:'error',text:'Select an affected block first.'}); return }
    setBusy(true)
    try { const r = await triggerReplanning({ event_type:'BLOCK_UNAVAILABLE', block_id:disruption }); const s=r?.summary||{}; setMessage({type:'success',text:`Re-planning completed: ${s.affected_jobs??0} affected, ${s.rescheduled_jobs??0} rescheduled, ${s.unchanged_jobs??0} unchanged.`}); await load() }
    catch (e) { setMessage({type:'error',text:e instanceof Error ? e.message : 'Re-planning failed.'}) }
    finally { setBusy(false) }
  }
  const reviewPlan = async (action:'APPROVE'|'REJECT') => {
    setBusy(true)
    try { const r=await fetch('/api/plan-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reviewer:session.displayName})}); const data=await r.json(); if(!r.ok) throw new Error(data?.detail||'Review failed'); setReview(data); setMessage({type:'success',text:`Plan ${action.toLowerCase()}d successfully.`}) }
    catch(e){setMessage({type:'error',text:e instanceof Error?e.message:'Plan review failed.'})}
    finally{setBusy(false)}
  }
  const logout=()=>{clearSession();onLogout()}

  return <div className="pc2-shell">
    <aside className="pc2-sidebar"><div className="pc2-brand"><div className="pc2-rail">रेल</div><div><strong>MARS</strong><small>Maintenance Allocation &amp; Routing System</small></div></div><div className="pc2-role">DIVISIONAL PLANNER<strong>{session.displayName}</strong></div><nav className="pc2-nav">{views.map(v=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>{v}</button>)}</nav><button className="pc2-logout" onClick={logout}>Logout session</button></aside>
    <main className="pc2-main"><header className="pc2-top"><div><h1>{view}</h1><p>Planner control centre · Live operational data</p></div><div className="pc2-actions"><select value={department} onChange={e=>setDepartment(e.target.value)}>{departments.map(d=><option key={d}>{d}</option>)}</select><button onClick={load}>Refresh</button><button className="primary" disabled={busy} onClick={optimize}>{busy?'Optimizing…':'Run Optimizer'}</button></div></header>
      <div className="pc2-content">
        {message&&<div className={`pc2-message ${message.type}`}>{message.text}</div>}
        {view==='Control Centre'&&<>
          <section className="pc2-banner"><div><h2>Divisional Planning Control Centre</h2><p>See requests → blocks → trains → conflicts → optimization → approved plan in one workflow.</p></div><div className="score"><b>{fmt(summary.schedule_rate, '0')}%</b><span>current schedule rate</span></div></section>
          <section className="pc2-kpis"><div className="pc2-kpi"><span>Maintenance Requests</span><b>{fmt(summary.total_jobs,jobs.length)}</b><small>{fmt(summary.unscheduled_jobs,unscheduled.length)} still need allocation</small></div><div className="pc2-kpi"><span>Scheduled Jobs</span><b>{fmt(summary.scheduled_jobs,scheduled.length)}</b><small>{fmt(summary.schedule_rate,'0')}% of current plan</small></div><div className="pc2-kpi"><span>Available Blocks</span><b>{fmt(summary.available_blocks,blocks.length)}</b><small>{fmt(summary.used_blocks,0)} used by plan</small></div><div className="pc2-kpi"><span>Active Conflicts</span><b>{conflicts.length}</b><small>data-driven train / job conflicts</small></div><div className="pc2-kpi"><span>Block Utilization</span><b>{fmt(summary.block_utilization,'0')}%</b><small>scheduled minutes / capacity</small></div></section>
          <section className="pc2-flow"><div className="pc2-step"><b>1</b><div><strong>Requests</strong><span>{jobs.length} loaded</span></div></div><div className="pc2-step"><b>2</b><div><strong>Blocks</strong><span>{blocks.length} slots</span></div></div><div className="pc2-step"><b>3</b><div><strong>Train constraints</strong><span>{trains.length} movements</span></div></div><div className="pc2-step"><b>4</b><div><strong>Plan review</strong><span>{fmt(review.status,'PENDING_REVIEW')}</span></div></div></section>
          <div className="pc2-grid"><section className="pc2-card"><div className="pc2-cardhead"><div><h3>Requests needing planning</h3><p className="sub">All departments are visible to the divisional planner.</p></div><button onClick={()=>setView('Requests')}>View all →</button></div><div className="pc2-depts"><button className={department==='All'?'active':''} onClick={()=>setDepartment('All')}>All · {jobs.length}</button>{departmentsCount.map(x=><button key={x.d} className={department===x.d?'active':''} onClick={()=>setDepartment(x.d)}>{x.d} · {x.n}</button>)}</div><div className="pc2-table"><table><thead><tr><th>Job</th><th>Department</th><th>Section</th><th>Block</th><th>Priority</th></tr></thead><tbody>{filteredJobs.slice(0,8).map(j=><tr className="clickable" key={j.job_id} onClick={()=>setSelectedJob(j)}><td><strong>{fmt(j.job_id)}</strong></td><td>{fmt(j.department)}</td><td>{fmt(j.section)}</td><td>{fmt(j.block)}</td><td><span className={`pc2-tag ${tone(j.priority)}`}>{fmt(j.priority)}</span></td></tr>)}</tbody></table></div></section><section className="pc2-card"><div className="pc2-cardhead"><div><h3>Operational attention</h3><p className="sub">Only backend-detected issues are shown here.</p></div><button onClick={()=>setView('Alerts')}>View all →</button></div>{conflicts.slice(0,5).map((c,i)=><div className="pc2-risk" key={c.conflict_id||i}><span className="pc2-risk-dot"/><div><strong>{fmt(c.description,c.type)}</strong><small>Job: {fmt(c.job_ids?.join(', '))} · Section: {fmt(c.section_id)} · Block: {fmt(c.block_id)} · {fmt(c.severity,'INFO')}</small></div></div>)}{!conflicts.length&&<div className="pc2-empty">No active conflicts detected.</div>}</section></div>
        </>}
        {view==='Requests'&&<section className="pc2-card"><div className="pc2-cardhead"><div><h3>Maintenance request catalogue</h3><p className="sub">Every request includes its asset-derived section and current-plan allocation.</p></div></div><div className="pc2-toolbar"><input placeholder="Search job, department, section, block…" value={query} onChange={e=>setQuery(e.target.value)}/><select value={department} onChange={e=>setDepartment(e.target.value)}>{departments.map(d=><option key={d}>{d}</option>)}</select></div><div className="pc2-table"><table><thead><tr><th>Job</th><th>Work</th><th>Department</th><th>Section</th><th>Block</th><th>Duration</th><th>Priority</th><th>Plan</th></tr></thead><tbody>{filteredJobs.map(j=><tr className="clickable" key={j.job_id} onClick={()=>setSelectedJob(j)}><td><strong>{fmt(j.job_id)}</strong></td><td>{fmt(j.work_type||j.description)}</td><td>{fmt(j.department)}</td><td>{fmt(j.section)}</td><td>{fmt(j.block)}</td><td>{fmt(j.duration_min)} min</td><td><span className={`pc2-tag ${tone(j.priority)}`}>{fmt(j.priority)}</span></td><td><span className={`pc2-tag ${tone(j.plan_status)}`}>{fmt(j.plan_status,'UNPLANNED')}</span></td></tr>)}</tbody></table></div></section>}
        {view==='Block Allocation'&&<><section className="pc2-card"><div className="pc2-cardhead"><div><h3>Block allocation &amp; safety slot management</h3><p className="sub">Select a maintenance job and a block. MARS checks section, restriction, isolation and train-free feasibility before any plan change.</p></div></div><div className="pc2-toolbar"><select value={selectedJob?.job_id||''} onChange={e=>setSelectedJob(jobs.find(j=>String(j.job_id)===e.target.value)||null)}><option value="">Select maintenance job…</option>{filteredJobs.map(j=><option key={j.job_id} value={j.job_id}>{j.job_id} · {j.department} · {j.section||'—'}</option>)}</select><button className="pc2-primary" disabled={!selectedJob||!selectedBlock||busy} onClick={check}>{busy?'Checking…':'Check selected allocation'}</button></div><div className="pc2-blockgrid">{blocks.map(b=><button key={b.block_id} className={`pc2-block ${selectedBlock?.block_id===b.block_id?'selected':''} ${conflicts.some(c=>String(c.block_id)===String(b.block_id))?'conflict':''}`} onClick={()=>{setSelectedBlock(b);setAllocation(null)}}><h4>{b.block_id}</h4><p>{fmt(b.section_id)} · {fmt(b.status)}</p><p className="window">{fmt(b.block_date)} · {fmt(b.start_time)}–{fmt(b.end_time)}</p><p>{fmt(b.block_type)} · {fmt(b.restrictions,'No restriction')}</p><div className="util"><span>{fmt(b.assigned_job_count,0)} assigned</span><strong>{fmt(b.utilization,0)}%</strong></div></button>)}</div>{allocation&&<div className={`pc2-check ${allocation.feasible?'ok':'bad'}`}><strong>{allocation.feasible?'✓ Feasible allocation':'✕ Allocation blocked'}</strong><div>{fmt(allocation.reason)}</div>{allocation.slots?.length>0&&<small>Candidate windows: {allocation.slots.map((s:any)=>`${new Date(s.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}–${new Date(s.end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`).join(', ')}</small>}</div>}</section></>}
        {view==='Calendar / Gantt'&&<PlannerGantt jobs={planJobs} trains={trains} onBack={()=>setView('Proposed Plan')} />}
        {view==='Proposed Plan'&&<section className="pc2-card"><div className="pc2-cardhead"><div><h3>Current active plan</h3><p className="sub">Generated by the existing optimizer. Review the result before operational approval.</p></div><button className="pc2-primary" disabled={busy} onClick={optimize}>Generate new plan</button></div><div className="pc2-planbar"><span><b>{scheduled.length}</b> scheduled</span><span><b>{unscheduled.length}</b> unscheduled</span><span><b>{fmt(summary.block_utilization,'0')}%</b> utilization</span><span><b>{fmt(review.status,'PENDING_REVIEW')}</b> review</span></div><div className="pc2-table"><table><thead><tr><th>Job</th><th>Department</th><th>Section</th><th>Block</th><th>Window</th><th>Status</th><th>Reason</th></tr></thead><tbody>{planJobs.map(j=><tr key={j.job_id}><td><strong>{fmt(j.job_id)}</strong></td><td>{fmt(j.department)}</td><td>{fmt(j.section_id)}</td><td>{fmt(j.block_id)}</td><td>{j.scheduled_start?`${j.scheduled_start} → ${j.scheduled_end}`:'Not scheduled'}</td><td><span className={`pc2-tag ${tone(j.plan_status)}`}>{fmt(j.plan_status)}</span></td><td>{fmt(j.optimizer_reason_detail||j.optimizer_reason_code)}</td></tr>)}</tbody></table></div><div className="pc2-modal-actions"><button className="approve" disabled={busy} onClick={()=>reviewPlan('APPROVE')}>Approve current plan</button><button className="reject" disabled={busy} onClick={()=>reviewPlan('REJECT')}>Reject plan</button></div></section>}
        {view==='Re-planning'&&<div className="pc2-grid"><section className="pc2-card"><h3>Dynamic re-planning</h3><p className="sub">Select a block disruption. MARS will identify affected jobs and return before/after changes.</p><div className="pc2-toolbar"><select value={disruption} onChange={e=>setDisruption(e.target.value)}><option value="">Select unavailable block…</option>{blocks.map(b=><option key={b.block_id} value={b.block_id}>{b.block_id} · {b.section_id} · {b.block_date} {b.start_time}–{b.end_time}</option>)}</select><button className="pc2-primary" disabled={busy||!disruption} onClick={replan}>{busy?'Re-planning…':'Execute re-plan'}</button></div></section><section className="pc2-card"><h3>Current impact</h3><p className="sub">Live context before the disruption is applied.</p><div className="pc2-planbar"><span><b>{scheduled.length}</b> scheduled</span><span><b>{trains.length}</b> train legs</span><span><b>{conflicts.length}</b> conflicts</span></div>{conflicts.slice(0,6).map((c,i)=><div className="pc2-risk" key={i}><span className="pc2-risk-dot"/><div><strong>{fmt(c.description)}</strong><small>{fmt(c.section_id)} · {fmt(c.block_id)} · {fmt(c.time_window)}</small></div></div>)}</section></div>}
        {view==='Alerts'&&<section className="pc2-card"><div className="pc2-cardhead"><div><h3>Alerts &amp; operational notifications</h3><p className="sub">Each item is tied to a backend conflict, request or planning event.</p></div></div>{[...conflicts,...notifications].map((x,i)=><div className="pc2-alert" key={x.conflict_id||x.id||i}><span className="icon">!</span><div><strong>{fmt(x.description||x.message||x.title)}</strong><small>Job: {fmt(x.job_ids?.join(', ')||x.job_id)} · Section: {fmt(x.section_id||x.section)} · Block: {fmt(x.block_id||x.block)} · Severity: {fmt(x.severity,'INFO')}</small></div></div>)}{!conflicts.length&&!notifications.length&&<div className="pc2-empty">No alerts.</div>}</section>}
        {loading&&<div className="pc2-empty">Refreshing operational data…</div>}
      </div>
    </main>
    {selectedJob&&<div className="pc2-modal-backdrop" onClick={()=>setSelectedJob(null)}><div className="pc2-modal" onClick={e=>e.stopPropagation()}><h3>{fmt(selectedJob.job_id)}</h3><p>{fmt(selectedJob.work_type||selectedJob.description)}</p><div className="pc2-planbar"><span>Department <b>{fmt(selectedJob.department)}</b></span><span>Section <b>{fmt(selectedJob.section)}</b></span><span>Block <b>{fmt(selectedJob.block)}</b></span><span>Priority <b>{fmt(selectedJob.priority)}</b></span></div><div className="pc2-modal-actions"><button onClick={()=>setSelectedJob(null)}>Close</button></div></div></div>}
  </div>
}
