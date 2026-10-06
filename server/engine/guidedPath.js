// Guided learning paths — deterministic state machine (V2 §7.2). Not a chatbot.
import { publicItem } from './practice.js';

const STEPS = ['INTRO', 'WORKED_EXAMPLE', 'GUIDED_TRY', 'INDEPENDENT_CHECK', 'REFLECT', 'COMPLETE'];

function lessonContent(db, conceptId) {
  const full = db.pack.lessons.find((l) => l.concept_id === conceptId);
  if (full) return { ...full, fallback: false };
  const concept = db.dag.nodes.find((n) => n.id === conceptId);
  const traps = Object.values(db.pack.tags ?? {}).map((t) => t.trap_text).slice(0, 2);
  const items = db.pack.questions.filter((q) => q.is_practice && q.concept_id === conceptId).slice(0, 2).map((q) => q.id);
  return {
    concept_id: conceptId,
    micro_lesson: [`About ${concept?.title ?? conceptId}: ${concept?.description ?? ''}`, ...traps],
    worked_example: { problem: items[0] ?? 'review', steps: ['Read the stem', 'Apply the concept'] },
    common_traps: traps,
    reflect_options: ['I will watch for the traps above'],
    fallback: true,
  };
}

/** Start (or resume) a path. Content per step is served without answers. */
export function startPath(db, studentId, conceptId, answeredGlobal = new Set()) {
  const lesson = lessonContent(db, conceptId);
  const tryItem = db.pack.questions.find((q) => q.is_practice && q.concept_id === conceptId && q.practice_level === 'L1' && !answeredGlobal.has(q.id));
  const checks = db.pack.questions.filter((q) => q.is_practice && q.concept_id === conceptId && !answeredGlobal.has(q.id) && q.id !== tryItem?.id).slice(0, 3);
  const state = {
    student_id: studentId, concept_id: conceptId, step: 'INTRO',
    block_idx: 0, try_item: tryItem ? tryItem.id : null, try_attempts: 0,
    check_items: checks.map((q) => q.id), check_answers: [], reflection: null, done: false,
  };
  return { state, view: stepView(db, state, lesson) };
}

function stepView(db, state, lesson = null) {
  const l = lesson ?? lessonContent(db, state.concept_id);
  switch (state.step) {
    case 'INTRO':
      return { step: 'INTRO', blocks: l.micro_lesson, shown: state.block_idx + 1 };
    case 'WORKED_EXAMPLE':
      return { step: 'WORKED_EXAMPLE', example: l.worked_example, shown: state.block_idx + 1 };
    case 'GUIDED_TRY': {
      const q = db.questions.get(state.try_item);
      return { step: 'GUIDED_TRY', item: q ? publicItem(q) : null, scaffolds: ['List knowns and unknowns', 'Choose the convention or formula', 'Compute'], attempts: state.try_attempts };
    }
    case 'INDEPENDENT_CHECK': {
      const items = state.check_items.map((id) => publicItem(db.questions.get(id))).filter(Boolean);
      return { step: 'INDEPENDENT_CHECK', items, answered: state.check_answers.length };
    }
    case 'REFLECT':
      return { step: 'REFLECT', options: l.reflect_options };
    default:
      return { step: 'COMPLETE', done: true };
  }
}

/**
 * advance(state, action): {next} reveals/predicts, {answer} grades try/check items,
 * {reflect} stores commitment -> COMPLETE (+overlay bump).
 */
export function advancePath(db, state, action = {}) {
  const lesson = lessonContent(db, state.concept_id);
  const totalIntro = lesson.micro_lesson.length;
  const totalWorked = lesson.worked_example.steps.length;
  let overlayGain = 0;

  if (state.step === 'INTRO') {
    if (state.block_idx + 1 < totalIntro) state.block_idx += 1;
    else { state.step = 'WORKED_EXAMPLE'; state.block_idx = 0; }
  } else if (state.step === 'WORKED_EXAMPLE') {
    if (action.predict) state.predicted = action.predict;
    if (state.block_idx + 1 < totalWorked) state.block_idx += 1;
    else { state.step = state.try_item ? 'GUIDED_TRY' : 'REFLECT'; state.block_idx = 0; }
  } else if (state.step === 'GUIDED_TRY') {
    const q = db.questions.get(state.try_item);
    const correct = action.answer === q?.correct_option_id;
    state.try_attempts += 1;
    if (correct || state.try_attempts >= 3) { state.step = state.check_items.length > 0 ? 'INDEPENDENT_CHECK' : 'REFLECT'; }
    else {
      return { state, view: { ...stepView(db, state, lesson), was_correct: false, hint: q.solution_steps[Math.min(state.try_attempts - 1, q.solution_steps.length - 1)] } };
    }
  } else if (state.step === 'INDEPENDENT_CHECK') {
    const idx = state.check_answers.length;
    const q = db.questions.get(state.check_items[idx]);
    if (!q) {
      state.step = 'REFLECT';
    } else {
      state.check_answers.push({ qid: q.id, correct: action.answer === q.correct_option_id });
      if (state.check_answers.length >= Math.min(3, state.check_items.length)) state.step = 'REFLECT';
    }
  } else if (state.step === 'REFLECT') {
    state.reflection = action.reflection ?? lesson.reflect_options[0];
    state.step = 'COMPLETE';
    state.done = true;
    overlayGain = 0.1;
  }
  return { state, view: stepView(db, state, lesson), overlayGain };
}

export { STEPS };

/** Recompute the current view for stored state (no advancement). */
export function viewState(db, state) {
  return stepView(db, state, lessonContent(db, state.concept_id));
}
