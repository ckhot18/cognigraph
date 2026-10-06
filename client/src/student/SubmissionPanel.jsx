import { useEffect, useState } from 'react';
import { DEMO_DELAY_MS } from '../api.js';

const STEPS = ['Parsing distractor payload…', 'Counting recurring errors…', 'Traversing concept graph…'];

// Left panel: question, options/working, student chip, run button (spec 7.2).
export default function SubmissionPanel({ detail, selectedOptionId, onPickOption, onRun, analyzing, runError }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!analyzing) {
      setStepIdx(0);
      return undefined;
    }
    const per = Math.max(200, Math.floor(DEMO_DELAY_MS / STEPS.length));
    const t = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), per);
    return () => clearInterval(t);
  }, [analyzing]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && !analyzing) {
        const tag = e.target && e.target.tagName;
        if (tag !== 'SELECT' && tag !== 'TEXTAREA') onRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [analyzing, onRun]);

  if (!detail) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur">
        <p className="text-sm text-slate-400">Loading presets…</p>
      </section>
    );
  }

  const isSession = detail.submission.mode === 'session';
  const isFreeText = detail.submission.mode === 'free_text';
  const questions = detail.questions ?? [];

  return (
    <section aria-label="Submission" className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300">
          {detail.student.name}
        </span>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          Overall mastery {detail.overall_mastery}%
        </span>
        <span className="rounded bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">
          Synthetic demo data
        </span>
      </div>

      {isSession ? (
        <div className="mt-4 space-y-3">
          {detail.submission.attempts.map((a, i) => {
            const q = questions.find((x) => x.question_id === a.question_id);
            return (
              <div key={a.question_id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Question {i + 1} · {a.time_sec}s
                </p>
                <p className="mt-1 text-sm text-slate-100">{q?.prompt}</p>
                <p className="mt-1 text-sm text-emerald-300">
                  ✓ {q?.options.find((o) => o.id === a.selected_option_id)?.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <h2 className="text-base font-semibold leading-snug">{questions[0]?.prompt}</h2>
          {isFreeText ? (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Student working (read-only)</p>
              <blockquote className="mt-1 rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-sm text-slate-200">
                {detail.submission.working_text}
              </blockquote>
            </div>
          ) : (
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Answer options">
              {questions[0]?.options.map((o) => {
                const active = o.id === selectedOptionId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onPickOption(o.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      active
                        ? 'border-indigo-400 bg-indigo-500/15 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${active ? 'border-indigo-300 text-indigo-200' : 'border-slate-600 text-slate-400'}`}>
                      {o.id.replace('opt_', '').toUpperCase()}
                    </span>
                    {o.text}
                  </button>
                );
              })}
              {detail.submission.working_text && (
                <blockquote className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-300">
                  {detail.submission.working_text}
                </blockquote>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onRun}
        disabled={analyzing}
        className="mt-5 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-60"
      >
        {analyzing ? 'Analyzing…' : 'Run Knowledge Graph Diagnostic'}
      </button>

      {analyzing && (
        <div className="mt-3" aria-hidden="true">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-400" />
          </div>
          <p className="mt-2 text-xs text-indigo-300">{STEPS[stepIdx]}</p>
        </div>
      )}

      {runError && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {runError} <button type="button" onClick={onRun} className="underline">Retry</button>
        </div>
      )}
    </section>
  );
}
