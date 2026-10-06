import { useState } from 'react';

const BORDER = {
  red: 'border-red-500/50',
  yellow: 'border-yellow-500/40',
  gold: 'border-amber-300/60',
};

// One misconception cluster with 1-click interventions (spec 7.3).
export default function ClusterCard({ cluster, onIntervene, onOpenDeck, onOpenStudent, busy }) {
  const [expanded, setExpanded] = useState(false);
  const names = cluster.affected_student_names ?? [];
  const shown = expanded ? names : names.slice(0, 4);
  const deployed = cluster.interventions_deployed;

  return (
    <article className={`relative rounded-xl border ${BORDER[cluster.severity_color] ?? 'border-slate-800'} bg-slate-900/70 p-5 backdrop-blur`}>
      {deployed && (
        <p className="absolute right-3 top-3 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          ✓ Intervention deployed
        </p>
      )}
      <h3 className="pr-40 text-base font-semibold">{cluster.cluster_name}</h3>
      <p className="mt-1 text-sm text-slate-300">
        <span className="text-2xl font-bold text-slate-100">{cluster.affected_student_count}</span>{' '}
        {cluster.affected_student_count === 1 ? 'student' : 'students'} · {cluster.root_problem}
      </p>
      {cluster.root_concept_tag && (
        <p className="mt-1 font-mono text-xs text-slate-500">tag: {cluster.root_concept_tag}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {shown.map((n) => (
          <span key={n} className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
            {n}
          </span>
        ))}
        {names.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-full border border-slate-600 px-2.5 py-0.5 text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {expanded ? 'show less' : `+${names.length - 4} more`}
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(cluster.one_click_actions ?? []).map((a) => (
          <button
            key={a.action_type}
            type="button"
            disabled={busy}
            onClick={() => onIntervene(cluster, a)}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-60"
          >
            {busy ? 'Deploying…' : a.label}
          </button>
        ))}
        {cluster.cluster_id === 'cl_sign' && (
          <button
            type="button"
            onClick={() => onOpenDeck(cluster)}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Preview deck
          </button>
        )}
        {names.includes('Alex M.') && (
          <button
            type="button"
            onClick={() => onOpenStudent('case1')}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Open Alex M.'s diagnostic →
          </button>
        )}
      </div>
    </article>
  );
}
