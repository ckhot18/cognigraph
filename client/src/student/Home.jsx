import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';
import { Card, Badge, ProgressRing, LineChart, Skeleton, EmptyState } from '../components/ui.jsx';
import ConceptMap, { useDag } from './ConceptMap.jsx';

function useData() {
  const [data, setData] = useState(null);
  const [issue, setIssue] = useState(null);
  useEffect(() => {
    Promise.all([api.me(), api.myTests(), api.bridgePlan()])
      .then(([me, tests, plan]) => setData({ me, tests: tests.tests, plan }))
      .catch((e) => setIssue(e.message));
  }, []);
  return { data, issue };
}

export default function StudentHome({ user, onLogout }) {
  const { data, issue } = useData();
  const dag = useDag();

  const startBridge = async (focus) => {
    try {
      const s = await api.practiceStart(focus);
      if (s.item) {
        try {
          sessionStorage.setItem(`cg_practice_${s.session_id}`, JSON.stringify(s.item));
        } catch {
          /* private mode */
        }
      }
      go(`/student/practice/${s.session_id}`);
    } catch {
      /* toast-less: stay put */
    }
  };

  if (issue) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <EmptyState title="Your data is taking a moment" hint="Check your connection and reload." />
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Skeleton className="h-28" /><Skeleton className="mt-4 h-48" />
      </Shell>
    );
  }

  const p = data.me.profile;
  const lastTwo = [...data.tests].sort((a, b) => a.date.localeCompare(b.date));
  const delta = lastTwo.length >= 2 ? lastTwo[lastTwo.length - 1].pct - lastTwo[lastTwo.length - 2].pct : 0;
  const top = data.plan.recommendations[0];
  const radar = buildRadar(data.me.profile.topic_scores);

  return (
    <Shell user={user} onLogout={onLogout}>
      <section className="flex items-center gap-4">
        <ProgressRing value={Math.round(p.overall)} />
        <div>
          <h1 className="text-xl font-bold text-stone-900">Hi {user.name.split(' ')[0]}, nice progress</h1>
          <p className="text-sm text-stone-600">
            {delta >= 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0)} vs last test · Top {100 - p.percentile}% band
          </p>
        </div>
      </section>

      {top && (
        <section className="animate-fade-up mt-4 rounded-2xl bg-gradient-to-r from-amber-200 to-amber-100 p-5" aria-label="Next best step">
          <p className="text-sm font-semibold text-amber-950">
            {top.redirect ? 'Back to foundations' : 'Your next best step'} · {etaMinutes(top)} min
            {top.state && top.state !== 'TODO' ? ` · ${top.state === 'DONE' ? 'Bridged' : 'In motion'}` : ''}
          </p>
          <p className="mt-1 text-sm text-amber-900">{top.why}</p>
          <button
            onClick={() => {
              const lesson = top.actions.find((a) => a.type === 'LESSON');
              const tag = top.evidence?.[0]?.tag;
              if (lesson?.ref) go(`/student/learn/${lesson.ref}`);
              else startBridge(tag ? { tag } : {});
            }}
            className="mt-3 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white"
          >
            Start bridge
          </button>
        </section>
      )}

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-stone-900">Progress over time</h2>
          <LineChart
            points={lastTwo.map((t) => t.pct)}
            hollow={lastTwo.map((t) => !t.has_item_data)}
            links={lastTwo.map((t) => (t.has_item_data ? `#/student/tests/${t.test_id}` : undefined))}
          />
          <p className="mt-1 text-xs text-stone-500">Hollow dots are summary-only tests.</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-stone-900">Topics</h2>
          <RadarChart data={radar} />
        </Card>
      </section>

      <Card className="mt-4">
        <h2 className="font-semibold text-stone-900">Concept map</h2>
        <ConceptMap dag={dag} states={p.node_states} onBridge={startBridge} />
      </Card>

      {data.plan.assignments?.length > 0 && (
        <Card className="mt-4 border-sky-200 bg-sky-50">
          <h2 className="font-semibold text-stone-900">From your teacher</h2>
          <ul className="mt-2 space-y-2">
            {data.plan.assignments.map((a) => (
              <li key={a.assignment_id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="sky">{a.kind === 'PRACTICE' ? 'Practice' : 'Lesson'}</Badge>
                <span className="text-stone-700">{a.note || 'A focused set picked for you'}</span>
                <button
                  onClick={() => (a.kind === 'PRACTICE' ? startBridge(a.focus ?? {}) : go(`/student/learn/${a.focus?.concept_id ?? ''}`))}
                  className="rounded-lg bg-stone-900 px-3 py-1 text-xs text-white"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <h2 className="font-semibold text-stone-900">Past tests</h2>
        <ul className="mt-2 divide-y divide-stone-100">
          {data.tests.map((t) => (
            <li key={t.test_id}>
              <button
                onClick={() => (t.has_item_data ? go(`/student/tests/${t.test_id}`) : null)}
                disabled={!t.has_item_data}
                title={t.title}
                className="flex w-full items-center gap-3 py-2.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:cursor-default"
              >
                <span className="flex-1">
                  <span className="block font-medium text-stone-800">{t.title}</span>
                  <span className="text-xs text-stone-500">{t.date}</span>
                </span>
                {t.has_item_data ? <Badge tone="sky">Deep analysis</Badge> : <Badge tone="slate">Summary only</Badge>}
                <span className="font-tabular font-semibold text-stone-900">{t.pct}%</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}

export function Shell({ user, onLogout, children }) {
  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf8f5]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={() => go('/student')} className="font-bold text-stone-900">CogniGraph</button>
          <nav className="ml-4 hidden gap-4 text-sm text-stone-600 sm:flex" aria-label="Student">
            <button onClick={() => go('/student')} className="hover:text-stone-900">Home</button>
          </nav>
          <span className="ml-auto text-sm text-stone-600">{user?.name}</span>
          <button onClick={onLogout} className="no-print rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Log out</button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function etaMinutes(rec) {
  return rec.actions.reduce((s, a) => s + (a.est_minutes ?? 0), 0) || 6;
}

function buildRadar(topicScores) {
  const topics = Object.keys(topicScores ?? {});
  return topics.map((t) => ({ label: t.replace(/_/g, ' ').slice(0, 12), value: topicScores[t] ?? 0 }));
}

function RadarChart({ data }) {
  const N = Math.max(data.length, 3);
  const R = 70;
  const C = 90;
  const pt = (i, v) => {
    const a = (2 * Math.PI * i) / N - Math.PI / 2;
    const r = (R * Math.min(100, v)) / 100;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const poly = data.map((d, i) => pt(i, d.value).join(',')).join(' ');
  const frame = data.map((d, i) => pt(i, 100).join(',')).join(' ');
  return (
    <svg viewBox="0 0 180 180" className="mx-auto w-full max-w-[240px]" role="img" aria-label="Topic radar">
      <polygon points={frame} fill="none" stroke="#d6d0c7" strokeWidth={1.5} />
      <polygon points={poly} fill="#dbeafe" stroke="#1e40af" strokeWidth={2} />
      {data.map((d, i) => {
        const [x, y] = pt(i, 112);
        return <text key={i} x={x} y={y} textAnchor="middle" fontSize={9} fill="#57534e">{d.label}</text>;
      })}
    </svg>
  );
}

