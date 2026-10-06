import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Badge, Skeleton } from '../components/ui.jsx';
import { TShell, tLogout } from './Overview.jsx';

const MINUTES = [30, 45, 60, 90];

// Revision-lecture planner: controls, timeline, evidence blocks, copy/print/assign.
export default function LecturePlanner() {
  const params = new URLSearchParams(window.location.search);
  const [tests, setTests] = useState(null);
  const [testId, setTestId] = useState(params.get('test') ?? 'ALL');
  const [minutes, setMinutes] = useState(60);
  const [challenge, setChallenge] = useState(true);
  const [plan, setPlan] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.tests('').then((t) => setTests([{ test_id: 'ALL', title: 'All tests' }, ...t.tests.filter((x) => x.type === 'DEEP')])).catch(() => {});
  }, []);
  useEffect(() => {
    setPlan(null);
    api.lecturePlan(testId, minutes, challenge).then(setPlan).catch(() => {});
  }, [testId, minutes, challenge]);

  if (!plan) return <TShell user={{ name: '' }} onLogout={tLogout}><Skeleton className="h-64" /></TShell>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plan.summary + '\n\n' + plan.blocks.map((b) => `${b.minutes} min — ${b.title} (${b.type}): ${b.why}`).join('\n'));
      setToast('Plan copied');
    } catch {
      setToast('Copy not available here');
    }
    setTimeout(() => setToast(null), 3000);
  };

  const assignAll = async () => {
    const ids = new Set();
    // resolve affected names to ids via roster lookup
    const roster = await api.tStudents();
    const byName = Object.fromEntries(roster.students.map((s) => [s.name, s.student_id]));
    for (const b of plan.blocks) {
      for (const n of b.students_affected ?? []) if (byName[n]) ids.add(byName[n]);
    }
    if (ids.size === 0) {
      setToast('No affected students in this plan');
    } else {
      const r = await api.assign({ kind: 'PRACTICE', focus: {}, note: `Lecture follow-up (${plan.minutes} min plan)`, student_ids: [...ids] });
      setToast(`Assigned to ${r.student_ids.length} students`);
    }
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <TShell user={{ name: '' }} onLogout={tLogout}>
      <h1 className="text-xl font-bold text-stone-900">Revision-lecture planner</h1>
      <Card>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>Scope
            <select value={testId} onChange={(e) => setTestId(e.target.value)} className="ml-2 rounded-lg border border-stone-300 bg-white px-2 py-1.5">
              {(tests ?? []).map((t) => <option key={t.test_id} value={t.test_id}>{t.title}</option>)}
            </select>
          </label>
          <fieldset className="flex items-center gap-1.5">
            <legend className="sr-only">Length</legend>
            {MINUTES.map((m) => (
              <button key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m} className={`rounded-lg border px-2.5 py-1.5 ${minutes === m ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}>{m}</button>
            ))}
          </fieldset>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={challenge} onChange={(e) => setChallenge(e.target.checked)} />
            Challenge block
          </label>
          <span className="ml-auto text-stone-600">Total: <strong className="font-tabular">{plan.total}</strong> min</span>
        </div>
        <div className="mt-3 flex h-9 overflow-hidden rounded-xl border border-stone-200" role="img" aria-label="Lecture timeline">
          {plan.blocks.map((b, i) => (
            <span key={b.key} title={`${b.title}: ${b.minutes} min`} className="flex items-center justify-center overflow-hidden text-[10px] font-medium text-stone-700" style={{ width: `${(b.minutes / plan.total) * 100}%`, background: ['#fde68a', '#bfdbfe', '#bbf7d0', '#fed7aa', '#e7e5e4', '#ddd6fe'][i % 6] }}>
              {b.minutes >= 8 ? `${b.minutes}'` : ''}
            </span>
          ))}
        </div>
        <p className="mt-2 text-sm text-stone-700">{plan.summary}</p>
        <p className="text-xs text-stone-500">{plan.why_order}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {plan.blocks.filter((b) => !b.fixed).map((b) => (
          <Card key={b.key}>
            <div className="flex items-center gap-2">
              <Badge tone="amber">{b.type}</Badge>
              <span className="font-tabular ml-auto text-sm font-semibold">{b.minutes} min</span>
            </div>
            <p className="mt-1 font-semibold text-stone-900">{b.title}</p>
            <p className="text-sm text-stone-600">{b.why}</p>
            {b.teaching_moves?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-stone-700">
                {b.teaching_moves.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}
            {b.example_questions?.length > 0 && <p className="mt-2 text-xs text-stone-500">Project: {b.example_questions.join(', ')}</p>}
            {b.checkpoint_question && <p className="text-xs text-stone-500">Checkpoint: {b.checkpoint_question}</p>}
            {b.grouping?.length > 0 && <p className="mt-1 text-xs text-stone-600">{b.grouping[0]}</p>}
          </Card>
        ))}
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <button onClick={copy} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm">Copy plan</button>
        <button onClick={() => window.print()} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm">Print plan</button>
        <button onClick={assignAll} className="rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Assign matching bridge practice</button>
      </div>
      {toast && <div className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm text-white" role="status">{toast}</div>}
    </TShell>
  );
}
