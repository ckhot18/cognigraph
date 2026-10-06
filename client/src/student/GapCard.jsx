import { SEVERITY_LABELS } from '../theme.js';

const SEVERITY_BADGE = {
  SLIP: 'bg-slate-700 text-slate-200',
  PARTIAL_MENTAL_MODEL: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  SYSTEMIC_MISCONCEPTION: 'bg-red-500/20 text-red-300 border border-red-500/40',
};

// Error label, severity badge, failure pips, evidence quote + interpretation,
// match confidence (spec 7.2 item 2). Every string comes from the engine report.
export default function GapCard({ gap }) {
  const total = gap.threshold ?? 3;
  const filled = Math.min(gap.failure_count, total);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{gap.label}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[gap.severity] ?? 'bg-slate-700'}`}>
          {SEVERITY_LABELS[gap.severity] ?? gap.severity}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm" aria-label={`Failure ${gap.failure_count} of ${total}`}>
        <span className="tracking-widest" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < filled ? 'text-red-400' : 'text-slate-600'}>●</span>
          ))}
        </span>
        <span className="text-slate-300">
          Failure {gap.failure_count}/{total}{gap.failure_count >= total ? ' — Threshold Reached' : ''}
        </span>
      </div>

      {gap.suspected_systemic && (
        <p className="mt-2 rounded bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
          Suspected systemic — monitoring ({gap.failure_count}/{total})
        </p>
      )}

      <figure className="mt-3 rounded-lg border-l-4 border-indigo-400 bg-indigo-500/10 p-3">
        <blockquote className="font-mono text-sm text-indigo-100">“{gap.evidence_quote}”</blockquote>
        <figcaption className="mt-1 text-sm text-slate-300">{gap.evidence_interpretation}</figcaption>
      </figure>

      <p className="mt-2 text-xs text-slate-400" title="How strongly the working matched a known distractor pattern — not a calibrated probability.">
        Match confidence {(Math.round(gap.confidence * 100))}% · {gap.selected_option_text ? `picked “${gap.selected_option_text}”` : 'free-text working'}
      </p>
    </div>
  );
}
