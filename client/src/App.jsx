import { useState } from 'react';

// Phase 0 app shell. Full Student Hub (Phase 4) and Teacher Center (Phase 5)
// build on this mode switcher and dark visual language.
const MODES = [
  { id: 'student', label: 'Student Diagnostic Hub' },
  { id: 'teacher', label: 'Teacher Command Center' },
];

export default function App() {
  const [mode, setMode] = useState('student');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">
              CogniGraph <span className="text-indigo-400">AI</span>
            </p>
            <p className="text-xs text-slate-400">
              Deterministic misconception diagnostics · synthetic demo data
            </p>
          </div>
          <nav className="ml-auto flex gap-2" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  mode === m.id
                    ? 'border-indigo-400 bg-indigo-500/20 text-white'
                    : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {mode === 'student' ? (
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur">
            <h1 className="text-xl font-semibold">Student Diagnostic Hub</h1>
            <p className="mt-2 text-sm text-slate-400">
              Phase 0 shell — the diagnostic engine (Phase 2), API (Phase 3) and
              full hub UI (Phase 4) plug in here.
            </p>
          </section>
        ) : (
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur">
            <h1 className="text-xl font-semibold">Teacher Command Center</h1>
            <p className="mt-2 text-sm text-slate-400">
              <span className="mr-2 rounded bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                Synthetic demo data
              </span>
              Cohort clustering and interventions land in Phase 5.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
