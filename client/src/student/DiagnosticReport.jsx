import { useEffect, useState } from 'react';
import { api } from '../api.js';
import MasteryHeader from './MasteryHeader.jsx';
import GapCard from './GapCard.jsx';
import DagMap from './DagMap.jsx';
import TraversalTrace from './TraversalTrace.jsx';
import BridgeWidget from './BridgeWidget.jsx';
import AccelerationPanel from './AccelerationPanel.jsx';

// Right panel: header, gap, banner, DAG, trace, bridge, roadmap (spec 7.2).
export default function DiagnosticReport({ report, preset, restored, onBridge }) {
  const [dag, setDag] = useState(null);

  useEffect(() => {
    api.dag().then(setDag).catch(() => {});
  }, []);

  const titles = Object.fromEntries((dag?.nodes ?? []).map((n) => [n.id, n.title]));

  if (!report) {
    return (
      <section aria-label="Diagnostic report" aria-live="polite" className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400 backdrop-blur">
          Pick a preset and run the diagnostic.
        </div>
        <DagMap report={null} mastery={preset?.node_mastery} />
      </section>
    );
  }

  const gap = report.detected_gaps?.[0];
  const states = report.node_states ?? {};
  const frozenEntry = Object.entries(states).find(([, s]) => s.state === 'LOCKED');
  const rootTitle = titles[report.root_prerequisite_blocked] ?? report.root_prerequisite_blocked;
  const frozenTitle = frozenEntry ? (titles[frozenEntry[0]] ?? frozenEntry[0]) : null;

  return (
    <section aria-label="Diagnostic report" aria-live="polite" className="space-y-4">
      <div className="animate-fade-up rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
        <MasteryHeader report={report} />
      </div>

      {gap && (
        <div className="animate-fade-up rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
          <GapCard gap={gap} />
          {report.hint && (
            <div className="mt-3 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-200">
              <span className="font-semibold">Hint: </span>{report.hint}
            </div>
          )}
        </div>
      )}

      {!gap && report.match_status === 'UNCLASSIFIED' && (
        <div className="animate-fade-up rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-5 text-sm text-yellow-200 backdrop-blur">
          Working did not match a known distractor pattern, so no misconception is claimed.
          A targeted drill on this topic is assigned instead. {report.hint}
        </div>
      )}

      {report.roadmap_action === 'PREREQUISITE_REDIRECT' && !restored && (
        <div className="animate-fade-up rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur" role="alert">
          ⚠ Prerequisite Lock: {frozenTitle} frozen. Redirecting to <strong>{rootTitle}</strong>.
        </div>
      )}
      {restored && (
        <div className="animate-fade-up rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm text-emerald-200 backdrop-blur">
          ✓ Prerequisite restored — roadmap resumed.
        </div>
      )}

      <div className="animate-fade-up rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
        <DagMap report={report} mastery={preset?.node_mastery} />
      </div>

      <TraversalTrace report={report} />

      {report.recommended_drill && (
        <BridgeWidget
          drill={report.recommended_drill}
          studentId={report.student_id}
          onResult={onBridge}
        />
      )}

      {report.acceleration && <AccelerationPanel acceleration={report.acceleration} />}

      <nav aria-label="Roadmap" className="flex flex-wrap items-center gap-2">
        {(report.roadmap ?? []).map((s, i) => (
          <div key={s.step} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-600" aria-hidden="true">→</span>}
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs backdrop-blur">
              <span className="mr-1.5 rounded-full bg-indigo-500/20 px-1.5 py-0.5 font-semibold text-indigo-300">{s.step}</span>
              <span className="font-medium text-slate-200">{s.action}</span>
              <span className="text-slate-400"> · {s.title}</span>
            </div>
          </div>
        ))}
      </nav>
    </section>
  );
}
