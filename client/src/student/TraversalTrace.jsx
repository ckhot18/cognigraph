import { useState } from 'react';

// Collapsible audit trail: traversal trace + applied threshold rule (spec 7.2 item 5).
export default function TraversalTrace({ report }) {
  const [open, setOpen] = useState(true);
  const trace = report.traversal_trace ?? [];
  const gap = report.detected_gaps?.[0];
  if (trace.length === 0 && !gap) return null;

  const rule = gap
    ? report.roadmap_action === 'PREREQUISITE_REDIRECT'
      ? `count ${gap.failure_count} ≥ ${gap.threshold} → PREREQUISITE_REDIRECT`
      : `count ${gap.failure_count} < ${gap.threshold} → ${report.roadmap_action}`
    : null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> How the engine decided
      </button>
      {open && (
        <div className="border-t border-slate-800 px-4 py-3">
          <ol className="space-y-1.5 font-mono text-xs text-slate-300">
            {trace.map((t, i) => (
              <li key={i}>
                <span className="text-indigo-300">{t.node}</span>
                {t.check ? <span className="text-slate-400"> · {t.check}</span> : null}
                {' → '}
                <span className={String(t.result).includes('ROOT CAUSE') ? 'font-semibold text-red-300' : 'text-slate-200'}>{t.result}</span>
              </li>
            ))}
          </ol>
          {rule && <p className="mt-2 font-mono text-xs text-emerald-300">rule: {rule}</p>}
        </div>
      )}
    </div>
  );
}
