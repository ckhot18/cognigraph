import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { NODE_STATE_STYLES } from '../theme.js';

const W = 132;
const H = 64;

function wrapTitle(title) {
  const words = title.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 18) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur += ' ' + w;
    }
    if (lines.length === 2) break;
  }
  if (lines.length === 2) return [lines[0], lines[1]];
  lines.push(cur.trim());
  return lines.slice(0, 2);
}

// Hand-rolled SVG concept map (spec 7.2 item 4). Fixed coordinates, no library.
export default function DagMap({ report, mastery }) {
  const [dag, setDag] = useState(null);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    api.dag().then(setDag).catch(() => {});
  }, []);

  const traceNodes = useMemo(
    () => (report?.traversal_trace ?? []).map((t) => t.node).filter(Boolean),
    [report],
  );

  useEffect(() => {
    setLit(0);
    if (traceNodes.length === 0) return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLit(traceNodes.length);
      return undefined;
    }
    const t = setInterval(() => {
      setLit((n) => {
        if (n >= traceNodes.length) {
          clearInterval(t);
          return n;
        }
        return n + 1;
      });
    }, 350);
    return () => clearInterval(t);
  }, [traceNodes]);

  const states = report?.node_states ?? {};
  const litSet = useMemo(() => new Set(traceNodes.slice(0, lit)), [traceNodes, lit]);

  if (!dag) {
    return <div className="h-48 animate-pulse rounded-lg bg-slate-950/60" aria-label="Loading concept map" />;
  }

  const center = (p) => ({ x: p.x + W / 2, y: p.y + H / 2 });
  const pos = Object.fromEntries(dag.nodes.map((n) => [n.id, n.pos]));

  return (
    <figure>
      <figcaption className="mb-2 text-xs uppercase tracking-wide text-slate-500">
        Concept dependency map {report ? '' : '(neutral — run the diagnostic)'}
      </figcaption>
      <svg viewBox="0 0 760 300" className="w-full rounded-lg bg-slate-950/60" role="img" aria-label="Concept dependency graph">
        {(dag.edges ?? []).map((e) => {
          const a = center(pos[e.from]);
          const b = center(pos[e.to]);
          const mx = (a.x + b.x) / 2;
          const hot = litSet.has(e.from) && litSet.has(e.to);
          return (
            <path
              key={`${e.from}->${e.to}`}
              d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
              fill="none"
              stroke={hot ? '#ef4444' : '#334155'}
              strokeWidth={hot ? 2.5 : 1.5}
              className={hot ? 'edge-trace' : undefined}
            />
          );
        })}
        {dag.nodes.map((n) => {
          const st = states[n.id]?.state ?? 'NEUTRAL';
          const style = NODE_STATE_STYLES[st];
          const isRoot = report?.root_prerequisite_blocked === n.id;
          const isLit = litSet.has(n.id);
          const warn = states[n.id]?.warning;
          const m = mastery?.[n.id];
          const lines = wrapTitle(n.title);
          return (
            <g key={n.id} transform={`translate(${n.pos.x}, ${n.pos.y})`} opacity={report && !isLit && traceNodes.length > 0 ? 0.55 : 1}>
              <title>{`${n.title} — ${n.description} Mastery ${m != null ? Math.round(m * 100) + '%' : 'n/a'} (threshold ${Math.round(n.mastery_threshold * 100)}%) · State ${st}`}</title>
              <rect
                width={W}
                height={H}
                rx={10}
                fill="#0f172a"
                stroke={style ? (st === 'BLOCKED_NEED_ROOT' ? '#ef4444' : st === 'ACCELERATED' ? '#fbbf24' : st === 'IN_PROGRESS' ? '#38bdf8' : st === 'MASTERED' ? '#10b981' : '#475569') : '#334155'}
                strokeWidth={isRoot || st === 'ACCELERATED' ? 2.5 : 1.5}
                className={st === 'BLOCKED_NEED_ROOT' ? 'animate-pulse-red' : st === 'ACCELERATED' ? 'animate-glow-gold' : undefined}
              />
              {isLit && (
                <rect width={W} height={H} rx={10} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4" />
              )}
              <text x={10} y={20} fontSize={11} fontWeight={600} className="fill-slate-100">
                {style?.icon} {lines[0]}
              </text>
              {lines[1] && <text x={10} y={33} fontSize={11} fontWeight={600} className="fill-slate-100">{lines[1]}</text>}
              <text x={10} y={52} fontSize={9} className="fill-slate-400">
                {st === 'NEUTRAL' ? n.title.split(' ').slice(-1) : st.replace(/_/g, ' ')}{isRoot ? ' · ROOT CAUSE' : ''}{warn && st !== 'BLOCKED_NEED_ROOT' ? ' · !' : ''}
                {st === 'LOCKED' && report?.root_prerequisite_blocked ? ' · frozen' : ''}
              </text>
              {isRoot && (
                <text x={W - 20} y={20} fontSize={14} aria-label="warning">⚠</text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
