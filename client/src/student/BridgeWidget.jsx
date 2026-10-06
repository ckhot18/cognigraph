import { useState } from 'react';
import { api } from '../api.js';

const CONFETTI_COLORS = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171'];

// Bridge-the-gap drill (spec 7.2 item 6). Correct → celebration + parent refresh;
// wrong → shake + per-option feedback + hint; 2+ wrong → worked explanation.
export default function BridgeWidget({ drill, studentId, onResult }) {
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [error, setError] = useState(null);

  const done = result?.correct === true;

  const answer = async (id) => {
    if (busy || done) return;
    setPicked(id);
    setBusy(true);
    setError(null);
    try {
      const r = await api.bridge({ student_id: studentId, drill_id: drill.drill_id, answer_option_id: id });
      setResult(r);
      if (r.correct) {
        if (onResult) onResult(r);
      } else {
        setShake((s) => s + 1);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div key={shake} className={`animate-fade-up relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur ${shake ? 'animate-shake' : ''}`}>
      {done && (
        <div aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="confetti-bit"
              style={{ left: `${4 + i * 7}%`, background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], animationDelay: `${(i % 5) * 0.08}s` }}
            />
          ))}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-100">
        Bridge-the-gap drill <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">{drill.drill_id}</span>
      </h3>
      <p className="mt-2 text-sm text-slate-200">{drill.prompt}</p>

      <div className="mt-3 grid gap-2">
        {drill.options.map((o) => {
          const isPicked = picked === o.id;
          const isRight = done && isPicked;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => answer(o.id)}
              disabled={busy || done}
              className={`rounded-lg border px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-default ${
                isRight
                  ? 'border-emerald-400 bg-emerald-500/15 text-white'
                  : isPicked && result && !result.correct
                    ? 'border-red-400 bg-red-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-600'
              }`}
            >
              <span className="mr-2 font-mono text-xs text-slate-400">{o.id}</span>{o.text}
            </button>
          );
        })}
      </div>

      {result && (
        <div className={`mt-3 rounded-lg border p-3 text-sm ${result.correct ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`} role="status">
          {result.correct ? '✓ ' : '✗ '}{result.feedback}
          {!result.correct && result.hint && <p className="mt-1 text-sky-200">Hint: {result.hint}</p>}
          {!result.correct && result.worked_explanation && <p className="mt-1 text-slate-200">{result.worked_explanation}</p>}
          {!result.correct && <p className="mt-1 text-xs text-slate-400">Attempt {result.attempts} — try again.</p>}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
    </div>
  );
}
