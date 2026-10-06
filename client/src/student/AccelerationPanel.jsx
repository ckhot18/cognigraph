import { useState } from 'react';

// Gold "What's Next?" panel for high performers (spec 7.2).
export default function AccelerationPanel({ acceleration }) {
  const [launched, setLaunched] = useState(null);
  const modules = acceleration.modules ?? [];

  return (
    <div className="animate-fade-up animate-glow-gold rounded-xl border border-amber-300/60 bg-slate-900/70 p-5 backdrop-blur">
      <h3 className="font-semibold text-amber-300">🌟 Advanced Physics Track Unlocked</h3>
      <p className="mt-1 text-sm text-slate-300">
        Avg {acceleration.avg_time_sec} s / question (target ≤ 45 s) · flawless session
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {modules.map((m) => (
          <div key={m.module_id} className="rounded-lg border border-amber-300/30 bg-slate-950/60 p-3">
            <p className="text-sm font-semibold text-slate-100">{m.title}</p>
            <p className="mt-1 text-xs text-slate-400">{m.description}</p>
            <button
              type="button"
              onClick={() => setLaunched(m.title)}
              className="mt-2 rounded-lg border border-amber-300/50 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Launch Module
            </button>
          </div>
        ))}
      </div>
      {launched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Module launch">
          <div className="max-w-sm rounded-xl border border-amber-300/40 bg-slate-900 p-5 text-sm">
            <p className="font-semibold text-amber-200">{launched}</p>
            <p className="mt-2 text-slate-300">Module launched — in the full product this opens the simulation.</p>
            <button
              type="button"
              onClick={() => setLaunched(null)}
              autoFocus
              className="mt-3 rounded-lg bg-amber-400 px-3 py-1.5 font-medium text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
