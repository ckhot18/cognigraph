// Segmenter — infers segments from RESPONSES ONLY (V2 §6.4).
// Never reads archetypes or generator-expectations. Priority order per spec,
// with two documented precedence refinements: (a) NEEDS is split — overall<40
// decides immediately (only the truly stuck + guessers are that low), while the
// systemic-topics clause runs after pattern checks so broad-but-shallow error
// spreads on mid performers don't mask their real pattern; (b) a dominant
// single-topic deficit (TOPIC_LAG) precedes cross-topic pattern counts, and
// EDGE precedes SIGN, so incidental counts can't steal a clear primary.
import { studentProfile } from './studentProfile.js';

export function segmentStudent(db, studentId, overlay = {}) {
  const cfg = db.config;
  const p = studentProfile(db, studentId, overlay);
  const responses = db.byStudent.get(studentId) ?? [];
  const secondaries = [];

  const maxTag = Math.max(0, ...p.tag_table.map((t) => t.count));
  const systemicTags = p.tag_table.filter((t) => t.severity === 'SYSTEMIC_MISCONCEPTION' && (db.pack.tags[t.tag]?.escalates ?? false));
  const topicsBelow = (cut) => Object.values(p.topic_scores).filter((v) => v < cut).length;
  const wrongTotal = responses.filter((r) => !r.is_correct).length;

  // 1. ACCELERATE
  if (p.overall >= (cfg.seg_accelerate_overall ?? 85) && maxTag < (cfg.seg_accelerate_max_tag ?? 2) && p.median_ratio <= 1) {
    return { primary: 'ACCELERATE', secondary: trendSecondary(p), profile: p };
  }
  // 2a. NEEDS_STRONG_SUPPORT on overall alone.
  if (p.overall < (cfg.seg_support_overall ?? 40)) {
    if (isGuessing(p, responses.length, cfg)) secondaries.push('GUESSING_PATTERN');
    const tr = trendSecondary(p);
    return { primary: 'NEEDS_STRONG_SUPPORT', secondary: [...secondaries, ...tr], profile: p };
  }
  // 3. GUESSING_PATTERN
  if (isGuessing(p, responses.length, cfg)) {
    return { primary: 'GUESSING_PATTERN', secondary: trendSecondary(p), profile: p };
  }
  // 4. TREND-STRONG (a decisive trajectory precedes single-test dips).
  const tr0 = trendSecondary(p);
  const bar0 = cfg.trend_primary_slope ?? 4.5;
  if (tr0.length > 0 && (p.trend_slope >= bar0 || p.trend_slope <= -bar0)) {
    return { primary: tr0[0], secondary: [], profile: p };
  }
  // 5. SIGN-STRONG ( entrenched habit outranks any single-topic dip).
  const sign = p.tag_table.find((t) => t.tag === 'sign_convention');
  const signStrong = sign && sign.count >= 5 && sign.topics.length >= (cfg.seg_sign_topics ?? 2);
  if (signStrong) {
    return { primary: 'SIGN_CONVENTION_GAP', secondary: trendSecondary(p), profile: p };
  }
  // 6. TOPIC_LAG (a deep, isolated deficit).
  const lagCut = cfg.seg_lag_cut ?? 50;
  const othersCut = cfg.seg_lag_others ?? 70;
  const gapMin = cfg.seg_lag_gap ?? 25;
  const entries = Object.entries(p.topic_scores);
  const lags = entries.filter(([tid, v]) => v <= lagCut && entries.filter(([t2]) => t2 !== tid).every(([, v2]) => v2 >= v) && meanOthers(entries, tid) >= othersCut && (meanOthers(entries, tid) - v) >= gapMin);
  if (lags.length >= 1) {
    lags.sort((a, b) => a[1] - b[1]);
    return { primary: `TOPIC_LAG:${lags[0][0]}`, secondary: trendSecondary(p), profile: p };
  }
  // 7. EDGE-STRONG.
  const impl = p.tag_table.find((t) => t.tag === 'implicit_condition');
  if (impl && impl.count >= 5) {
    return { primary: 'EDGE_CASE_GAP', secondary: trendSecondary(p), profile: p };
  }
  // 8. SIGN (standard).
  if (sign && sign.count >= (cfg.seg_sign_count ?? 3) && sign.topics.length >= (cfg.seg_sign_topics ?? 2)) {
    return { primary: 'SIGN_CONVENTION_GAP', secondary: trendSecondary(p), profile: p };
  }
  // 9. CALCULATION_HABITS (habits need evidence volume: floor on wrong answers)
  const calcShare = ((p.error_mix.calculation ?? 0) + (p.error_mix.careless ?? 0)) / (wrongTotal || 1);
  const conceptAvg = avgMastery(p);
  if (wrongTotal >= (cfg.calc_min_wrong ?? 6) && calcShare >= (cfg.seg_calc_share ?? 0.5) && conceptAvg >= (cfg.seg_calc_mastery ?? 0.6)) {
    return { primary: 'CALCULATION_HABITS', secondary: trendSecondary(p), profile: p };
  }
  // 10. EDGE (standard).
  if (impl && impl.count >= (cfg.seg_implicit_count ?? 3)) {
    return { primary: 'EDGE_CASE_GAP', secondary: trendSecondary(p), profile: p };
  }
  // 11. NEEDS_STRONG_SUPPORT, systemic/topics clause.
  if (systemicTags.length >= (cfg.seg_support_systemic_tags ?? 3)
    || topicsBelow(cfg.seg_support_topic_cut ?? 50) >= (cfg.seg_support_weak_topics ?? 4)) {
    return { primary: 'NEEDS_STRONG_SUPPORT', secondary: trendSecondary(p), profile: p };
  }
  return { primary: 'ON_TRACK', secondary: trendSecondary(p), profile: p };
}

function isGuessing(p, n, cfg) {
  if (n === 0) return false;
  return (p.time_profile.FAST_WRONG / n) >= (cfg.seg_guessing_fastwrong ?? 0.3)
    && ((p.error_mix.none / n) * 100) < (cfg.seg_guessing_acc ?? 50);
}

function trendSecondary(p) {
  if (p.trend === 'IMPROVING') return ['IMPROVING'];
  if (p.trend === 'DECLINING') return ['DECLINING'];
  return [];
}

function avgMastery(p) {
  const vals = Object.values(p.concept_mastery).filter((m) => m.hasData).map((m) => m.mastery);
  if (vals.length === 0) return 0.5;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function meanOthers(entries, tid) {
  const rest = entries.filter(([t]) => t !== tid).map(([, v]) => v);
  if (rest.length === 0) return 100;
  return rest.reduce((a, b) => a + b, 0) / rest.length;
}
