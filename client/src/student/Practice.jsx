import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';
import { Card, Badge, Skeleton, EmptyState } from '../components/ui.jsx';
import { Shell } from './Home.jsx';

const CONFETTI = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa'];

// Focused practice card: instant feedback, hint ladder, live mastery meter.
export default function Practice({ sessionId }) {
  const [item, setItem] = useState(null);
  const [picked, setPicked] = useState(null);
  const [fb, setFb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState(null);
  const [done, setDone] = useState(null);
  const [count, setCount] = useState(0);
  const [shake, setShake] = useState(0);
  useEffect(() => {
    setItem(null);
  }, [sessionId]);

  useEffect(() => {
    // First item arrives via sessionStorage handoff from the launcher.
    if (!item && !done && count === 0) {
      try {
        const raw = sessionStorage.getItem(`cg_practice_${sessionId}`);
        if (raw) {
          setItem(JSON.parse(raw));
          sessionStorage.removeItem(`cg_practice_${sessionId}`);
          return;
        }
      } catch {
        /* fall through */
      }
      setIssue('This practice link needs a fresh start — head home and start a bridge.');
    }
  }, [item, done, count, sessionId]);

  const answer = async (oid) => {
    if (busy || fb?.correct) return;
    setPicked(oid);
    setBusy(true);
    try {
      const r = await api.practiceAnswer(sessionId, item.question_id, oid);
      setFb(r);
      setCount((c) => c + 1);
      if (!r.correct) setShake((s) => s + 1);
      if (r.done) {
        setDone(r);
      }
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (fb?.next_item) {
      setItem(fb.next_item);
      setPicked(null);
      setFb(null);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && item && !fb?.correct) {
        const o = item.options[n - 1];
        if (o) answer(o.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, fb, busy]);

  if (issue && !item) {
    return (
      <Shell user={{ name: '' }} onLogout={() => go('/login')}>
        <EmptyState title="Practice needs a fresh start" hint={issue} />
        <button onClick={startFresh} className="mt-3 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Start a bridge set</button>
      </Shell>
    );
  }

  // Normal entry carries the first item via the launcher handoff.
  if (!item && !done) {
    return (
      <Shell user={{ name: '' }} onLogout={() => go('/login')}>
        <EmptyState title="Practice needs a fresh start" hint={issue ?? 'Head home and start a bridge.'} />
        <button onClick={() => go('/student')} className="mt-3 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Back home</button>
      </Shell>
    );
  }

  if (done && !fb?.next_item) {
    return (
      <Shell user={{ name: '' }} onLogout={() => go('/login')}>
        <Card className="relative overflow-hidden text-center">
          <Confetti />
          <h1 className="text-xl font-bold text-stone-900">Bridge complete</h1>
          <p className="mt-1 text-sm text-stone-600">You worked through {count} items. Your concept map and Bridge plan are already updated.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => go('/student')} className="rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Back home</button>
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell user={{ name: '' }} onLogout={() => go('/login')}>
      <div className="mx-auto max-w-2xl" key={shake}>
        <div className={`card p-6 ${shake ? 'animate-shake' : ''}`}>
          <div className="flex items-center justify-between">
            <ProgressDots n={count} />
            <Badge tone="sky">{item.level === 'L1' ? 'Level 1 · isolate the idea' : item.level === 'L2' ? 'Level 2 · apply it' : 'Level 3 · stretch'}</Badge>
          </div>
          <h1 className="mt-3 text-lg font-semibold text-stone-900">{item.text}</h1>
          <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Options">
            {item.options.map((o, i) => {
              const chosen = picked === o.id;
              const good = fb?.correct && chosen;
              const off = fb && !fb.correct && chosen;
              return (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={chosen}
                  disabled={busy || fb?.correct}
                  onClick={() => answer(o.id)}
                  className={`rounded-xl border-2 px-4 py-3 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                    good ? 'border-emerald-500 bg-emerald-50 font-medium' : off ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-white hover:border-stone-400'
                  }`}
                >
                  <span className="mr-2 rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">{i + 1}</span>
                  {o.text}
                </button>
              );
            })}
          </div>
          {fb && (
            <div className={`mt-4 rounded-xl p-4 text-sm ${fb.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`} role="status" aria-live="polite">
              <p className="font-semibold">{fb.correct ? 'On target' : 'A step to bridge'}</p>
              <p className="mt-1">{fb.feedback}</p>
              {fb.hint && <p className="mt-1">Hint {fb.hint.level}: {fb.hint.text}</p>}
              {fb.solution_steps?.length > 0 && (
                <ol className="mt-2 list-decimal pl-5">
                  {fb.solution_steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              )}
              {fb.next_item && !fb.done && (
                <button onClick={next} className="mt-3 rounded-xl bg-stone-900 px-4 py-2 text-white">Next →</button>
              )}
            </div>
          )}
          <MasteryMeter overlay={fb?.overlay} />
        </div>
      </div>
    </Shell>
  );
}

function ProgressDots({ n }) {
  return (
    <div className="flex gap-1.5" aria-label={`${n} answered`}>
      {Array.from({ length: Math.min(10, Math.max(4, n + 1)) }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < n ? 'bg-stone-900' : 'bg-stone-200'}`} />
      ))}
    </div>
  );
}

function MasteryMeter({ overlay }) {
  const entries = Object.entries(overlay ?? {});
  if (entries.length === 0) return null;
  const [cid, v] = entries[entries.length - 1];
  const pct = Math.min(95, Math.round(v * 100));
  const color = pct >= 75 ? '#059669' : pct >= 55 ? '#0284c7' : '#d97706';
  const label = pct >= 75 ? 'Strong' : pct >= 55 ? 'Building' : 'Foundation';
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-stone-600">
        <span>{cid.replace(/_/g, ' ')}</span>
        <span><Badge tone="amber">{label}</Badge> → <Badge tone="sky">Building</Badge></span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className="confetti-bit" style={{ left: `${3 + i * 6}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 5) * 0.07}s` }} />
      ))}
    </div>
  );
}
