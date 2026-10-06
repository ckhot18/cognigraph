// Deterministic MCQ + free-text matcher (spec 5.3).
// Pure functions. Confidence is *match* confidence, not a calibrated probability.

/** Stage 1 — normalize: lowercase, unify unicode operators, collapse (and separately strip) whitespace. */
export function normalize(text) {
  const t = String(text ?? '')
    .toLowerCase()
    .replace(/[×·]/g, '*')
    .replace(/½/g, '0.5')
    .replace(/²/g, '^2')
    .replace(/[−–]/g, '-');
  const spaced = t.replace(/\s+/g, ' ').trim();
  const compact = t.replace(/\s+/g, '');
  return { spaced, compact };
}

/** Stage 2 — extract all numbers (in order) from normalized text. */
export function extractNumbers(spaced) {
  const matches = spaced.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches.map(Number);
}

/** Numbers following '=' are strong signals (the student's claimed result). */
export function numbersAfterEquals(spaced) {
  const out = [];
  const re = /=\s*(-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(spaced)) !== null) out.push(Number(m[1]));
  return out;
}

function tryRegex(source, pattern) {
  try {
    return new RegExp(pattern, 'i').test(source);
  } catch {
    return false;
  }
}

function matchesEither(pattern, spaced, compact) {
  return tryRegex(spaced, pattern) || tryRegex(compact, pattern);
}

/** Stage 3 — rubric: first pattern (question order) whose any/all/none rules hold. */
export function matchRubric(question, spaced, compact) {
  for (const pat of question?.rubric?.patterns ?? []) {
    const anyOf = pat.any_of ?? [];
    const allOf = pat.all_of ?? [];
    const noneOf = pat.none_of ?? [];
    const anyHit = anyOf.length === 0 || anyOf.some((rx) => matchesEither(rx, spaced, compact));
    const allHit = allOf.every((rx) => matchesEither(rx, spaced, compact));
    const noneHit = noneOf.some((rx) => matchesEither(rx, spaced, compact));
    if (anyHit && allHit && !noneHit) return pat;
  }
  return null;
}

function findOption(question, id) {
  return (question.options ?? []).find((o) => o.id === id) ?? null;
}

/**
 * Match one submission against a question.
 * @param {object} question quiz-bank question
 * @param {{selected_option_id?:string|null, working_text?:string}} sub
 * @param {object} cfg config (numeric_tolerance)
 */
export function matchSubmission(question, sub = {}, cfg = { numeric_tolerance: 0.05 }) {
  const tol = cfg.numeric_tolerance ?? 0.05;
  const selected = sub.selected_option_id ? findOption(question, sub.selected_option_id) : null;
  const text = (sub.working_text ?? '').trim();

  // MCQ-only: instant lookup, confidence 1.0, evidence = option text.
  if (selected && !text) {
    return {
      status: 'CLASSIFIED',
      option: selected,
      confidence: 1.0,
      evidence_quote: selected.text,
      evidence_interpretation: selected.payload.explanation,
      numeric_agree: false,
      rubric_agree: false,
    };
  }

  const { spaced, compact } = normalize(text);
  const numbers = extractNumbers(spaced);
  const afterEq = numbersAfterEquals(spaced);
  const lastNumber = numbers.length > 0 ? numbers[numbers.length - 1] : null;

  // Numeric stage: last number or any number following '=' matches an option's numeric.
  let numericOption = null;
  let numericHit = null;
  if (text) {
    const signals = [...afterEq];
    if (lastNumber !== null && !signals.includes(lastNumber)) signals.push(lastNumber);
    for (const n of signals) {
      const hit = (question.options ?? []).find(
        (o) => typeof o.numeric === 'number' && Math.abs(o.numeric - n) <= tol,
      );
      if (hit) { numericOption = hit; numericHit = n; break; }
    }
  }

  // Rubric stage.
  const rubricPat = text ? matchRubric(question, spaced, compact) : null;
  const rubricOption = rubricPat ? findOption(question, rubricPat.option_id) : null;

  // Combine.
  const agree = (a, b) => a && b && a.id === b.id;
  if (selected) {
    const numAgree = agree(numericOption, selected);
    const rubAgree = agree(rubricOption, selected);
    if (numAgree && rubAgree) {
      return classified(selected, 0.94, quoteFromRubric(rubricPat, text) ?? selected.text, rubricPat.evidence_template, true, true);
    }
    if (numAgree || rubAgree) {
      const pat = rubAgree ? rubricPat : null;
      return classified(selected, 0.78, (pat && quoteFromRubric(pat, text)) ?? selected.text, (pat && pat.evidence_template) ?? selected.payload.explanation, numAgree, rubAgree);
    }
    // Clicked option stands even when the working text matches nothing (a guess
    // writes noise); evidence falls back to the option text.
    return classified(selected, 0.78, selected.text, selected.payload.explanation, false, false);
  }

  // Free-text only.
  if (numericOption && rubricOption) {
    if (numericOption.id === rubricOption.id) {
      return classified(numericOption, 0.94, quoteFromRubric(rubricPat, text) ?? String(numericHit), rubricPat.evidence_template, true, true);
    }
    // Conflict: prefer the rubric (authored reasoning signal over a bare number).
    return classified(rubricOption, 0.78, quoteFromRubric(rubricPat, text) ?? rubricOption.text, rubricPat.evidence_template, false, true);
  }
  if (rubricOption) {
    return classified(rubricOption, 0.78, quoteFromRubric(rubricPat, text) ?? rubricOption.text, rubricPat.evidence_template, false, true);
  }
  if (numericOption) {
    return classified(numericOption, 0.78, String(numericHit), numericOption.payload.explanation, true, false);
  }
  return {
    status: 'UNCLASSIFIED',
    option: null,
    confidence: 0.3,
    evidence_quote: text.slice(0, 160),
    evidence_interpretation: 'Working did not match any known distractor pattern.',
    numeric_agree: false,
    rubric_agree: false,
  };
}

function classified(option, confidence, quote, interpretation, numericAgree, rubricAgree) {
  return {
    status: 'CLASSIFIED',
    option,
    confidence,
    evidence_quote: quote,
    evidence_interpretation: interpretation,
    numeric_agree: numericAgree,
    rubric_agree: rubricAgree,
  };
}

/** Exact substring of the student's raw working that triggered the rubric hit. */
export function quoteFromRubric(pat, rawText) {
  if (!pat?.evidence_pattern) return null;
  try {
    const m = new RegExp(pat.evidence_pattern, 'i').exec(String(rawText ?? ''));
    return m ? m[0] : null;
  } catch {
    return null;
  }
}
