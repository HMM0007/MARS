export default function App() {
  return (
    <div className="min-h-screen bg-railway-bg text-railway-text">
      <header className="bg-railway-blue text-white px-6 py-4 shadow">
        <h1 className="text-xl font-semibold">MARS 2.0</h1>
        <p className="text-sm text-slate-200">
          Automatic Block Planning System | Pune Division (CR)
        </p>
      </header>

      <main className="p-6">
        <div className="bg-white border border-railway-border rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">System Bootstrap Successful</h2>
          <p className="text-railway-muted text-sm">
            Phase 1 frontend skeleton is ready. Next: wire APIs, Gantt, and Mapbox corridor view.
          </p>
        </div>
      </main>
    </div>
  )
}