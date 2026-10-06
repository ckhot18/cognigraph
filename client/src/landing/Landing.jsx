import { go } from '../App.jsx';

// Marketing landing: nav, hero with animated graph motif, steps, strips, FAQ.
export default function Landing() {
  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf8f5]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <button onClick={() => go('/')} className="flex items-center gap-2 font-bold text-stone-900" aria-label="CogniGraph home">
            <span className="flex h-5 w-5 items-center justify-center rounded border-2 border-stone-900 text-[11px]">▢</span>
            CogniGraph
          </button>
          <nav className="hidden gap-5 text-sm text-stone-600 sm:flex" aria-label="Sections">
            <a href="#how" className="hover:text-stone-900">How it works</a>
            <a href="#students" className="hover:text-stone-900">For students</a>
            <a href="#teachers" className="hover:text-stone-900">For teachers</a>
          </nav>
          <button onClick={() => go('/login')} className="no-print ml-auto rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white">Log in</button>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4">
        <section className="grid items-center gap-8 py-12 md:grid-cols-2">
          <div className="animate-fade-up">
            <p className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900">Learning, traced to the root</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
              Don&apos;t just grade.<br />Bridge the gap.
            </h1>
            <p className="mt-3 max-w-md text-stone-600">
              Find why an answer missed the target, trace it to the concept underneath, and build a path across.
            </p>
            <div className="no-print mt-5 flex gap-3">
              <button onClick={() => go('/login')} className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">Student login</button>
              <button onClick={() => go('/login')} className="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800">Teacher login</button>
            </div>
          </div>
          <GraphMotif />
        </section>

        <section id="how" className="grid gap-4 py-6 sm:grid-cols-3">
          {[
            ['1 · Test', 'Ten questions, every choice recorded'],
            ['2 · Trace', 'Find the root concept behind the gap'],
            ['3 · Bridge', 'Practice and guided steps that fit'],
          ].map(([t, d]) => (
            <div key={t} className="card p-5">
              <p className="font-semibold text-stone-900">{t}</p>
              <p className="mt-1 text-sm text-stone-600">{d}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-600">
          <span className="font-medium text-stone-800">Not a chatbot</span>
          <span>Deterministic · Explainable · Evidence-based</span>
          <span>Demo data</span>
        </section>

        <section id="students" className="grid gap-4 py-8 md:grid-cols-2">
          <div className="card bg-gradient-to-br from-amber-50 to-white p-6">
            <h2 className="text-xl font-bold text-stone-900">For students</h2>
            <p className="mt-2 text-sm text-stone-600">Your next best step, your bridges, your pace — never a red mark, always a way forward.</p>
            <button onClick={() => go('/login')} className="no-print mt-4 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Open student login</button>
          </div>
          <div id="teachers" className="card bg-gradient-to-br from-sky-50 to-white p-6">
            <h2 className="text-xl font-bold text-stone-900">For teachers</h2>
            <p className="mt-2 text-sm text-stone-600">Class patterns, per-question evidence, and a revision lecture planned in one click.</p>
            <button onClick={() => go('/login')} className="no-print mt-4 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Open teacher login</button>
          </div>
        </section>

        <section className="card mb-8 p-6">
          <h2 className="font-bold text-stone-900">Demo access</h2>
          <p className="mt-1 text-sm text-stone-600">Students use IDs 1–30 with password 123. The teacher uses ID 1 with password 123. Everything here runs offline on demo data.</p>
        </section>

        <footer className="border-t border-stone-200 py-6 text-xs text-stone-500">
          CogniGraph AI · classroom demo · synthetic data · heuristics, not validated findings
        </footer>
      </main>
    </div>
  );
}

function GraphMotif() {
  // Pure SVG/CSS motif: nodes warming amber → green on a loop.
  const nodes = [
    { x: 40, y: 80, c: '#bbf7d0' },
    { x: 110, y: 40, c: '#bbf7d0' },
    { x: 190, y: 40, c: '#bae6fd' },
    { x: 250, y: 80, c: '#ffffff' },
    { x: 190, y: 120, c: '#ffffff' },
    { x: 110, y: 120, c: '#fde68a' },
  ];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
  const P = (i) => nodes[i];
  return (
    <figure aria-hidden="true" className="mx-auto">
      <svg viewBox="0 0 290 160" className="w-full max-w-sm">
        {edges.map(([a, b], i) => (
          <line key={i} x1={P(a).x} y1={P(a).y} x2={P(b).x} y2={P(b).y} stroke="#d6d0c7" strokeWidth={2} />
        ))}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={16} fill={n.c} stroke="#a8a29e" strokeWidth={1.5} />
        ))}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-stone-500">foundation to strengthen</figcaption>
    </figure>
  );
}
