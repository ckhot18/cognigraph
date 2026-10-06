import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';
import { Card, Badge, Donut, Skeleton } from '../components/ui.jsx';
import { TShell, tLogout } from './Overview.jsx';

// Teacher-direct drill-down: full EDA + segment reasons + assign + note (in-memory).
export default function TeacherStudent({ studentId }) {
  const [data, setData] = useState(null);
  const [kind, setKind] = useState('PRACTICE');
  const [focus, setFocus] = useState('');
  const [note, setNote] = useState(() => {
    try {
      return localStorage.getItem(`cg_note_${studentId}`) ?? '';
    } catch {
      return '';
    }
  });
  const [toast, setToast] = useState(null);
  useEffect(() => {
    api.tStudent(studentId).then(setData).catch(() => {});
  }, [studentId]);

  if (!data) return <TShell user={{ name: '' }} onLogout={tLogout}><Skeleton className="h-64" /></TShell>;
  const p = data.profile;

  const assign = async () => {
    const focusObj = kind === 'LESSON' ? { concept_id: focus || undefined } : { tag: focus || undefined };
    const r = await api.assign({ kind, focus: focusObj, note: 'Teacher-assigned bridge', student_ids: [studentId] });
    setToast(`Assigned (${r.assignment_id})`);
    setTimeout(() => setToast(null), 4000);
  };
  const saveNote = () => {
    try {
      localStorage.setItem(`cg_note_${studentId}`, note);
    } catch {
      /* private mode */
    }
    setToast('Note kept on this device');
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <TShell user={{ name: '' }} onLogout={tLogout}>
      <button onClick={() => go('/teacher/students')} className="text-sm text-stone-600 underline">← Roster</button>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-stone-900">{data.name ?? `Student ${studentId}`}</h1>
        <Badge tone={data.segment === 'ACCELERATE' ? 'green' : data.segment === 'NEEDS_STRONG_SUPPORT' ? 'red' : 'amber'}>{data.segment.replace(/_/g, ' ')}</Badge>
        <span className="text-sm text-stone-600">{p.overall.toFixed(1)}% overall · {p.trend.toLowerCase()} ({p.trend_slope} pts/test)</span>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-stone-900">Error mix</h2>
          <Donut slices={Object.entries(p.error_mix).filter(([k]) => k !== 'none').map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v, color: k === 'concept' ? '#1e40af' : k === 'edge_case' ? '#b45309' : k === 'calculation' ? '#0284c7' : '#a8a29e' }))} />
          <p className="mt-2 text-xs text-stone-500">Median pace {p.median_ratio}× · answer changes {p.answer_changes.total} ({p.answer_changes.wrong_to_right} wrong→right)</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-stone-900">Tag table (teacher view)</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(p.tag_table ?? []).slice(0, 8).map((t) => (
              <li key={t.tag} className="flex flex-wrap gap-2">
                <Badge tone={t.severity === 'SYSTEMIC_MISCONCEPTION' ? 'red' : 'slate'}>{t.tag.replace(/_/g, ' ')}</Badge>
                <span className="text-stone-600">{t.count} · {t.severity.replace(/_/g, ' ')}{t.cross_topic ? ' · cross-topic' : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
      <Card>
        <h2 className="font-semibold text-stone-900">Assign bridge</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind" className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm">
            <option value="PRACTICE">Practice</option>
            <option value="LESSON">Lesson</option>
          </select>
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder={kind === 'LESSON' ? 'concept_id (optional)' : 'tag (optional)'} aria-label="Focus" className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" />
          <button onClick={assign} className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white">Assign</button>
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-stone-900">Teacher note (this device only)</h2>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-stone-300 p-2 text-sm" />
        <button onClick={saveNote} className="mt-2 rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Keep note</button>
      </Card>
      {toast && <div className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm text-white" role="status">{toast}</div>}
    </TShell>
  );
}
