import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';
import { Card, Badge, Tabs, ProgressRing, Donut, Skeleton, EmptyState } from '../components/ui.jsx';
import { Shell } from './Home.jsx';
import { useDag } from './ConceptMap.jsx';

const KIND_LABEL = { concept: 'Concept', edge_case: 'Edge case', calculation: 'Calculation', careless: 'Careful reading', none: 'On target' };
const KIND_COLOR = { concept: '#1e40af', edge_case: '#b45309', calculation: '#0284c7', careless: '#a8a29e', none: '#059669' };

export default function StudentTest({ testId }) {
  const [tab, setTab] = useState('review');
  const [review, setReview] = useState(null);
  const [plan, setPlan] = useState(null);
  const [insights, setInsights] = useState(null);
  const [issue, setIssue] = useState(null);
  const dag = useDag();

  useEffect(() => {
    let live = true;
    Promise.all([api.testReview(testId), api.bridgePlan(), api.insights()])
      .then(([r, p, ins]) => {
        if (!live) return;
        setReview(r);
        setPlan(p);
        setInsights(ins);
      })
      .catch((e) => {
        if (live) setIssue(e.message);
      });
    return () => { live = false; };
  }, [testId]);

  if (issue) return <Shell user={{ name: '' }} onLogout={() => go('/login')}><EmptyState title="This test is taking a moment" hint="Reload to try again." /></Shell>;
  if (!review) return <Shell user={{ name: '' }} onLogout={() => go('/login')}><Skeleton className="h-64" /></Shell>;

  const user = { name: '' };
  if (review.summary_only) {
    return (
      <Shell user={user} onLogout={() => go('/login')}>
        <button onClick={() => go('/student')} className="text-sm text-stone-600 underline">← All tests</button>
        <Card>
          <h1 className="text-xl font-bold text-stone-900">{testId}</h1>
          <p className="mt-1 text-sm text-stone-600">Summary only — no question-level data. Score {review.score}/{review.max_score}.</p>
          <Badge tone="slate">Summary only</Badge>
        </Card>
      </Shell>
    );
  }

  const cards = review.cards ?? [];
  const bridged = cards.filter((c) => c.on_target === false).length;

  return (
    <Shell user={user} onLogout={() => go('/login')}>
      <button onClick={() => go('/student')} className="text-sm text-stone-600 underline">← All tests</button>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-stone-900">{prettyTest(testId)}</h1>
        <Badge tone="amber">{bridged} bridge{bridged === 1 ? '' : 's'} found</Badge>
      </div>
      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'review', label: 'Question review' },
          { id: 'insights', label: 'Insights' },
          { id: 'plan', label: 'Bridge plan' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'overview' && <Overview cards={cards} />}
      {tab === 'review' && <Review cards={cards} dag={dag} />}
      {tab === 'insights' && <Insights insights={insights} dag={dag} />}
      {tab === 'plan' && <Plan plan={plan} />}
    </Shell>
  );
}

function prettyTest(id) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Overview({ cards }) {
  const on = cards.filter((c) => c.on_target).length;
  const secs = cards.reduce((s, c) => s + (c.time_sec ?? 0), 0);
  return (
    <Card>
      <div className="flex items-center gap-6">
        <ProgressRing value={Math.round((on / Math.max(1, cards.length)) * 100)} />
        <div className="text-sm text-stone-600">
          <p>{on} of {cards.length} on target</p>
          <p className="mt-1">Time in test: {Math.round(secs / 60)} min {secs % 60} s</p>
        </div>
      </div>
    </Card>
  );
}

function Review({ cards, dag }) {
  const [mode, setMode] = useState('all');
  const shown = cards.filter((c) => mode === 'all' || (mode === 'on' ? c.on_target : !c.on_target));
  const titles = Object.fromEntries((dag?.concepts ?? []).map((n) => [n.id, n.title]));
  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        {[['all', 'All'], ['on', 'On target'], ['bridge', 'To bridge']].map(([id, label]) => (
          <button
            key={id} onClick={() => setMode(id)} aria-pressed={mode === id}
            className={`rounded-full border px-3 py-1 ${mode === id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.map((c, i) => (
        <Card key={c.question_id} className={c.on_target ? '' : 'border-amber-200'}>
          <p className="text-sm font-semibold text-stone-900">Q{i + 1} · {shortQ(c.text)}</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Your choice</dt>
              <dd className="font-tabular text-right font-medium text-stone-900">{optText(c, c.chosen_option_id)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Target answer</dt>
              <dd className="font-tabular text-right font-medium text-emerald-700">{optText(c, c.correct_option_id)}</dd>
            </div>
          </dl>
          {c.tag && <div className="mt-2"><Badge tone="amber">{tagLabel(c.tag)}</Badge></div>}
          {c.student_note && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{c.student_note}</p>}
          {c.solution_steps?.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-stone-600 underline">Steps</summary>
              <ol className="mt-1 list-decimal pl-5 text-stone-700">
                {c.solution_steps.map((s, k) => <li key={k}>{s}</li>)}
              </ol>
            </details>
          )}
          <p className="mt-2 text-xs text-stone-500">
            {c.time_sec}s taken (about {c.expected_time_sec}s expected)
            {titles[c.concept_id] ? ` · ${titles[c.concept_id]}` : ''}
          </p>
        </Card>
      ))}
    </div>
  );
}

function shortQ(t) {
  return t.length > 90 ? t.slice(0, 90) + '…' : t;
}

function optText(c, oid) {
  return c.options?.find((o) => o.id === oid)?.text ?? '—';
}

function tagLabel(tag) {
  return tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Insights({ insights, dag }) {
  const p = insights?.insights;
  if (!p) return <Skeleton className="h-48" />;
  const mix = p.error_mix ?? {};
  const slices = Object.entries(mix).filter(([k]) => k !== 'none').map(([k, v]) => ({ label: KIND_LABEL[k] ?? k, value: v, color: KIND_COLOR[k] ?? '#78716c' }));
  const cross = (p.tag_table ?? []).filter((t) => t.cross_topic).slice(0, 2);
  const titles = Object.fromEntries((dag?.concepts ?? []).map((n) => [n.id, n.title]));
  void titles;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h2 className="font-semibold text-stone-900">Where the marks went</h2>
        <Donut slices={slices} />
      </Card>
      <Card>
        <h2 className="font-semibold text-stone-900">Pace reading</h2>
        <PaceStrip profile={p} />
      </Card>
      <Card className="md:col-span-2">
        <h2 className="font-semibold text-stone-900">Habit table</h2>
        <ul className="mt-2 space-y-2">
          {(p.tag_table ?? []).slice(0, 6).map((t) => (
            <li key={t.tag} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={t.severity === 'SYSTEMIC_MISCONCEPTION' ? 'amber' : 'sky'}>{tagLabel(t.tag)}</Badge>
              <span className="text-stone-600">{t.count} · {t.topics.join(' + ')}</span>
              {t.cross_topic && <span className="text-xs text-stone-500">Also seen across topics — one bridge covers both.</span>}
            </li>
          ))}
        </ul>
        {cross.length > 0 && (
          <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
            Also seen in {cross.map((t) => t.topics.join(' + ')).join('; ')} — a single bridge helps in both places.
          </p>
        )}
      </Card>
    </div>
  );
}

function PaceStrip({ profile }) {
  const tp = profile.time_profile ?? {};
  const total = tp.FAST_WRONG + tp.SLOW_RIGHT + tp.SLOW_WRONG + tp.FAST_RIGHT || 1;
  const segs = [
    ['Quick + on target', tp.FAST_RIGHT, '#059669'],
    ['Steady + on target', tp.SLOW_RIGHT, '#0284c7'],
    ['Quick + to bridge', tp.FAST_WRONG, '#f59e0b'],
    ['Longer + to bridge', tp.SLOW_WRONG, '#b45309'],
  ];
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-stone-100" role="img" aria-label="Pace mix">
        {segs.map(([label, v, color]) => (
          <span key={label} title={`${label}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: color }} />
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-xs text-stone-600">
        {segs.map(([label, v]) => <li key={label}>{label}: {v}</li>)}
        <li>Answer changes: {profile.answer_changes?.total ?? 0} ({profile.answer_changes?.wrong_to_right ?? 0} settled into target).</li>
      </ul>
    </div>
  );
}

function Plan({ plan }) {
  if (!plan) return <Skeleton className="h-48" />;
  const recs = plan.recommendations ?? [];
  return (
    <div className="space-y-3">
      {recs.map((r) => (
        <Card key={r.id} className="border-amber-200">
          <p className="font-semibold text-stone-900">{r.title}</p>
          <p className="mt-1 text-sm text-stone-600">{r.why}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {r.actions.map((a, i) => (
              <ActionButton key={i} action={a} />
            ))}
          </div>
        </Card>
      ))}
      {(plan.more ?? []).length > 0 && <p className="text-sm text-stone-500">+{plan.more.length} more in your full plan.</p>}
    </div>
  );
}

function ActionButton({ action }) {
  const start = async () => {
    if (action.type === 'LESSON' && action.ref) go(`/student/learn/${action.ref}`);
    else if (action.type === 'PRACTICE') {
      const s = await api.practiceStart({});
      if (s.item) {
        try {
          sessionStorage.setItem(`cg_practice_${s.session_id}`, JSON.stringify(s.item));
        } catch {
          /* private mode */
        }
      }
      go(`/student/practice/${s.session_id}`);
    }
  };
  const label = action.type === 'LESSON' ? 'Lesson' : action.type === 'PRACTICE' ? 'Practice' : action.type === 'REFLECT' ? 'Reflect' : 'Review';
  return (
    <button onClick={action.type === 'REFLECT' ? undefined : start} disabled={action.type === 'REFLECT'} className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-white disabled:opacity-40">
      {label}{action.est_minutes ? ` · ${action.est_minutes} min` : ''}
    </button>
  );
}
