// Fetch wrappers for the CogniGraph AI API (spec section 6).
// All routes are same-origin (/api) in dev (Vite proxy) and production.

// Staged-reveal delay for the "analyzing" shimmer (spec 7.2). The engine is
// instant; the shimmer sells the pipeline. Mirrors config.json demo_delay_ms.
export const DEMO_DELAY_MS = 750;

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return body;
}

export const api = {
  health: () => request('/api/health'),
  presets: () => request('/api/presets'),
  preset: (id) => request(`/api/presets/${encodeURIComponent(id)}`),
  dag: () => request('/api/dag'),
  analyze: (payload) =>
    request('/api/analyze-submission', { method: 'POST', body: JSON.stringify(payload) }),
  roadmap: (studentId) =>
    request(`/api/student-roadmap?student_id=${encodeURIComponent(studentId)}`),
  bridge: (payload) =>
    request('/api/bridge-gap', { method: 'POST', body: JSON.stringify(payload) }),
  cohort: () => request('/api/teacher-cohort'),
  intervene: (payload) =>
    request('/api/teacher-intervention', { method: 'POST', body: JSON.stringify(payload) }),
  reset: () => request('/api/reset', { method: 'POST' }),
};
