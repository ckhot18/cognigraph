import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { go } from '../App.jsx';

const STATE_META = {
  MASTERED: { label: 'Strong', dot: '#059669', fill: '#d1fae5' },
  IN_PROGRESS: { label: 'Building', dot: '#0284c7', fill: '#e0f2fe' },
  BLOCKED_NEED_ROOT: { label: 'Foundation to strengthen', dot: '#d97706', fill: '#fef3c7' },
  LOCKED: { label: 'Coming up', dot: '#a8a29e', fill: '#ffffff' },
  ACCELERATED: { label: 'Ready to stretch', dot: '#b45309', fill: '#fef9c3' },
};

// Layered DAG: columns by dependency depth, curved edges, topic filter, drawer.
export default function ConceptMap({ dag, states, onBridge, compact }) {
  const topics = dag?.topics ?? [];
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);

  const layout = useMemo(() => {
    const concepts = dag?.concepts ?? [];
    const list = filter === 'all' ? concepts : concepts.filter((n) => n.topic_id === filter);
    const ids = new Set(list.map((n) => n.id));
    const depth = {};
    const dv = (id, seen = new Set()) => {
      if (depth[id] != null) return depth[id];
      if (seen.has(id)) return 0;
      seen.add(id);
      const c = concepts.find((n) => n.id === id);
      const ps = (c?.prerequisites ?? []).filter((p) => ids.has(p));
      depth[id] = ps.length === 0 ? 0 : 1 + Math.max(...ps.map((p) => dv(p, new Set(seen))));
      return depth[id];
    };
    list.forEach((n) => dv(n.id));
    const cols = {};
    list.forEach((n) => {
      const d = depth[n.id];
      cols[d] = cols[d] || [];
      cols[d].push(n);
    });
    const pos = {};
    Object.entries(cols).forEach(([d, ns]) => {
      const rowH = 300 / Math.max(ns.length, 1);
      ns.forEach((n, i) => {
        pos[n.id] = { x: 90 + Number(d) * 175, y: 20 + (i + 0.5) * Math.min(rowH, 64) };
      });
    });
    const maxD = Math.max(0, ...Object.keys(cols).map(Number));
    const W = 90 + maxD * 175 + 100;
    const edges = [];
    list.forEach((n) => {
      for (const p of n.prerequisites ?? []) {
        if (pos[p] && pos[n.id]) edges.push([p, n.id]);
      }
    });
    return { list, pos, W: W + 60, H: 340, edges };
  }, [dag, filter]);

  return (
    <div>
      {!compact && topics.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All topics</FilterChip>
          {topics.filter((t) => t.topic_id !== 'foundations').map((t) => (
            <FilterChip key={t.topic_id} active={filter === t.topic_id} onClick={() => setFilter(t.topic_id)}>
              {t.title}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="overflow-auto rounded-xl border border-stone-200 bg-white p-2">
        <svg viewBox={`0 0 ${layout.W} ${layout.H}`} style={{ minWidth: 620, width: '100%' }} role="img" aria-label="Concept dependency graph">
          {layout.edges.map(([a, b], i) => {
            const A = layout.pos[a];
            const B = layout.pos[b];
            const hot = states?.[b]?.warning && states?.[a]?.state === 'BLOCKED_NEED_ROOT';
            const mx = (A.x + B.x) / 2;
            return <path key={i} d={`M ${A.x + 30} ${A.y} C ${mx} ${A.y}, ${mx} ${B.y}, ${B.x - 30} ${B.y}`} fill="none" stroke={hot ? '#d97706' : '#d6d0c7'} strokeWidth={hot ? 2.5 : 1.5} />;
          })}
          {layout.list.map((n) => {
            const p = layout.pos[n.id];
            const st = states?.[n.id]?.state ?? 'LOCKED';
            const meta = STATE_META[st] ?? STATE_META.LOCKED;
            const unknown = states?.[n.id]?.unknown;
            const isRoot = st === 'BLOCKED_NEED_ROOT';
            return (
              <g key={n.id} transform={`translate(${p.x - 30}, ${p.y - 22})`}>
                <title>{`${n.title} — ${unknown ? 'Not assessed yet' : meta.label}`}</title>
                <rect width={150} height={44} rx={10} fill={unknown ? '#faf8f5' : meta.fill} stroke={meta.dot} strokeWidth={isRoot ? 2.5 : 1.5} className={isRoot ? 'animate-pulse-amber' : undefined} />
                <text x={10} y={19} fontSize={11} fontWeight={600} fill="#1c1917">
                  {(n.title.length > 24 ? n.title.slice(0, 23) + '…' : n.title)}
                </text>
                <text x={10} y={34} fontSize={10} fill="#78716c">
                  {unknown ? 'Not assessed yet' : meta.label}{isRoot ? ' · ROOT' : ''}{st === 'LOCKED' && !unknown ? ' · held' : ''}
                </text>
                <rect width={150} height={44} rx={10} fill="transparent" onClick={() => setOpen(n)} style={{ cursor: 'pointer' }} tabIndex={0} role="button" aria-label={n.title}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOpen(n); }} />
              </g>
            );
          })}
        </svg>
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-600">
          {Object.entries({ MASTERED: 'Strong', IN_PROGRESS: 'Building', BLOCKED_NEED_ROOT: 'Foundation to strengthen', LOCKED: 'Coming up', ACCELERATED: 'Ready to stretch' }).map(([k, v]) => (
            <span key={k}><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATE_META[k].dot }} />{v}</span>
          ))}
        </div>
      )}
      {open && <NodeDrawer node={open} state={states?.[open.id]} onClose={() => setOpen(null)} onBridge={onBridge} />}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick} aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600'}`}
    >
      {children}
    </button>
  );
}

function NodeDrawer({ node, state, onClose, onBridge }) {
  const meta = STATE_META[state?.state] ?? STATE_META.LOCKED;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={node.title}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">{node.title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">✕</button>
        </div>
        <p className="mt-1 text-sm text-stone-600">{node.description}</p>
        <p className="mt-2 text-sm"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: meta.dot }} />{state?.unknown ? 'Not assessed yet' : meta.label}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => onBridge({ concept_id: node.id })} className="rounded-xl bg-stone-900 px-4 py-2 text-sm text-white">Start bridge</button>
          <button onClick={() => go(`/student/learn/${node.id}`)} className="rounded-xl border border-stone-300 px-4 py-2 text-sm">Open lesson</button>
        </div>
      </div>
    </div>
  );
}

export function useDag() {
  const [dag, setDag] = useState(null);
  useEffect(() => {
    api.dag().then(setDag).catch(() => {});
  }, []);
  return dag;
}
