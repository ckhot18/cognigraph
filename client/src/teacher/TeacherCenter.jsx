import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import SummaryBar from './SummaryBar.jsx';
import ClusterCard from './ClusterCard.jsx';
import MasteryMatrix from './MasteryMatrix.jsx';
import DeckModal from './DeckModal.jsx';

// Teacher Command Center: clusters, 1-click interventions, matrix (spec 7.3).
export default function TeacherCenter({ onOpenStudent }) {
  const [cohort, setCohort] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [deck, setDeck] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setCohort(await api.cohort());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const intervene = async (cluster, action) => {
    const key = `${cluster.cluster_id}:${action.action_type}`;
    setBusy(key);
    try {
      const r = await api.intervene({ cluster_id: cluster.cluster_id, action_type: action.action_type });
      await refresh();
      if (action.action_type === 'DEPLOY_REMEDIATION_DECK' && r.payload?.slides) {
        setDeck(r.payload);
      }
      setToast({ clusterId: cluster.cluster_id, message: `✓ Deployed to ${r.affected_student_count} students — ${r.message}` });
    } catch (e) {
      setToast({ message: `Deploy failed: ${e.message}` });
    } finally {
      setBusy(null);
    }
  };

  const undo = async (clusterId) => {
    await fetch('/api/teacher-intervention', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cluster_id: clusterId }),
    });
    await refresh();
    setToast({ message: 'Intervention undone.' });
  };

  if (error && !cohort) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200" role="alert">
        Could not reach the API. ({error})
      </div>
    );
  }
  if (!cohort) return <p className="text-sm text-slate-400">Loading cohort…</p>;

  return (
    <div className="space-y-4">
      <p>
        <span className="rounded bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">
          Synthetic demo data
        </span>
        <span className="ml-2 text-xs text-slate-500">Simulated 30-student cohort — not real classroom results.</span>
      </p>
      <SummaryBar cohort={cohort} />
      <div className="grid gap-4 md:grid-cols-2">
        {(cohort.misconception_clusters ?? []).map((c) => (
          <ClusterCard
            key={c.cluster_id}
            cluster={c}
            busy={busy && busy.startsWith(c.cluster_id)}
            onIntervene={intervene}
            onOpenDeck={(cl) => {
              const act = cl.one_click_actions.find((a) => a.action_type === 'DEPLOY_REMEDIATION_DECK');
              if (act) intervene(cl, act);
              else setDeck(null);
            }}
            onOpenStudent={onOpenStudent}
          />
        ))}
      </div>
      <MasteryMatrix cohort={cohort} />

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-500/40 bg-slate-900 px-4 py-2.5 text-sm text-emerald-200 shadow-xl" role="status">
          {toast.message}
          {toast.clusterId && (
            <button type="button" onClick={() => undo(toast.clusterId)} className="ml-3 underline">
              Undo
            </button>
          )}
        </div>
      )}
      <DeckModal deck={deck} onClose={() => setDeck(null)} />
    </div>
  );
}
