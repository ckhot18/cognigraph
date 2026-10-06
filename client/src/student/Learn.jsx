import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';
import { Card, Badge, Skeleton, EmptyState } from '../components/ui.jsx';
import { Shell } from './Home.jsx';

const STEPS = ['INTRO', 'WORKED_EXAMPLE', 'GUIDED_TRY', 'INDEPENDENT_CHECK', 'REFLECT', 'COMPLETE'];
const STEP_LABEL = { INTRO: 'Intro', WORKED_EXAMPLE: 'Worked example', GUIDED_TRY: 'Guided try', INDEPENDENT_CHECK: 'Check', REFLECT: 'Reflect', COMPLETE: 'Complete' };

// Guided learning stepper over the deterministic path state machine.
export default function Learn({ conceptId }) {
  const [data, setData] = useState(null);
  const [issue, setIssue] = useState(null);
  const [answer, setAnswer] = useState('');
  const [predict, setPredict] = useState('');
  const [reflect, setReflect] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setData(await api.learn(conceptId));
    } catch (e) {
      setIssue(e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  const advance = async (action) => {
    setBusy(true);
    try {
      const r = await api.learnAdvance(conceptId, action);
      setData({ state: r.state, view: r.view });
      setAnswer('');
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (issue && !data) {
    return <Shell user={{ name: '' }} onLogout={() => go('/login')}><EmptyState title="This lesson is taking a moment" hint="Reload to try again." /></Shell>;
  }
  if (!data) return <Shell user={{ name: '' }} onLogout={() => go('/login')}><Skeleton className="h-64" /></Shell>;

  const { view } = data;
  const idx = STEPS.indexOf(view.step);

  return (
    <Shell user={{ name: '' }} onLogout={() => go('/login')}>
      <button onClick={() => go('/student')} className="text-sm text-stone-600 underline">← Home</button>
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Path steps">
        {STEPS.map((s, i) => (
          <span key={s} role="listitem" className={`rounded-full px-2.5 py-1 text-xs ${i < idx ? 'bg-emerald-100 text-emerald-900' : i === idx ? 'bg-sky-100 text-sky-900 font-semibold' : 'bg-stone-100 text-stone-500'}`}>
            {STEP_LABEL[s]}
          </span>
        ))}
      </div>

      {view.step === 'INTRO' && (
        <Card>
          <ul className="space-y-2 text-sm text-stone-700">
            {view.blocks.slice(0, view.shown).map((b, i) => <li key={i} className="rounded-xl bg-stone-50 p-3">{b}</li>)}
          </ul>
          <button onClick={() => advance({})} disabled={busy} className="mt-3 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Continue</button>
        </Card>
      )}

      {view.step === 'WORKED_EXAMPLE' && (
        <Card>
          <h1 className="font-semibold text-stone-900">Worked example · step {view.shown} of {view.example.steps.length}</h1>
          <ol className="mt-2 space-y-1 text-sm text-stone-700">
            {view.example.steps.slice(0, view.shown).map((s, i) => <li key={i}>{i + 1} · {s}</li>)}
          </ol>
          <div className="mt-3 flex gap-2">
            <input value={predict} onChange={(e) => setPredict(e.target.value)} placeholder="Predict the next step…" aria-label="Predict the next step" className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            <button onClick={() => advance({ predict })} disabled={busy} className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">Predict</button>
          </div>
          <button onClick={() => advance({})} disabled={busy} className="mt-2 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Continue</button>
        </Card>
      )}

      {view.step === 'GUIDED_TRY' && view.item && (
        <Card>
          <p className="text-sm text-stone-600">Try it with scaffolds:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-stone-600">
            {view.scaffolds.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <p className="mt-3 font-medium text-stone-900">{view.item.text}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {view.item.options.map((o) => (
              <button key={o.id} onClick={() => advance({ answer: o.id })} disabled={busy} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:border-stone-400">{o.text}</button>
            ))}
          </div>
          {view.was_correct === false && <p className="mt-2 text-sm text-amber-800" role="status">Not quite — hint: {view.hint}</p>}
        </Card>
      )}

      {view.step === 'INDEPENDENT_CHECK' && (
        <Card>
          <h1 className="font-semibold text-stone-900">Independent check ({view.answered + 1} of {view.items.length})</h1>
          {view.items[view.answered] ? (
            <div className="mt-2">
              <p className="font-medium text-stone-900">{view.items[view.answered].text}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {view.items[view.answered].options.map((o) => (
                  <button key={o.id} onClick={() => advance({ answer: o.id })} disabled={busy} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:border-stone-400">{o.text}</button>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                {view.items.map((_, i) => (
                  <span key={i} className={`h-2 w-6 rounded-full ${i < view.answered ? 'bg-emerald-500' : 'bg-stone-200'}`} />
                ))}
              </div>
            </div>
          ) : (
            <button onClick={() => advance({})} disabled={busy} className="mt-2 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Continue</button>
          )}
        </Card>
      )}

      {view.step === 'REFLECT' && (
        <Card>
          <h1 className="font-semibold text-stone-900">Pick the trap you will watch for</h1>
          <div className="mt-2 grid gap-2">
            {view.options.map((o) => (
              <button key={o} onClick={() => { setReflect(o); advance({ reflection: o }); }} disabled={busy} aria-pressed={reflect === o} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm hover:border-stone-400">{o}</button>
            ))}
          </div>
        </Card>
      )}

      {view.step === 'COMPLETE' && (
        <Card className="text-center">
          <Badge tone="green">Path complete</Badge>
          <p className="mt-2 text-sm text-stone-600">Your bridge plan already reflects this. {data.state?.reflection ? `Your commitment: “${data.state.reflection}”.` : ''}</p>
          <button onClick={() => go('/student')} className="mt-3 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Back home</button>
        </Card>
      )}
    </Shell>
  );
}
