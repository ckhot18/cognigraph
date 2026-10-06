// API layer: token auth (localStorage), fetch wrappers, tiny GET cache.

const store = {
  get token() {
    try {
      return localStorage.getItem('cg_token');
    } catch {
      return null;
    }
  },
  set token(v) {
    try {
      if (v) localStorage.setItem('cg_token', v);
      else localStorage.removeItem('cg_token');
    } catch {
      /* private mode */
    }
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem('cg_user') ?? 'null');
    } catch {
      return null;
    }
  },
  set user(v) {
    try {
      if (v) localStorage.setItem('cg_user', JSON.stringify(v));
      else localStorage.removeItem('cg_user');
    } catch {
      /* private mode */
    }
  },
};

export async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || `Request did not go through (${res.status})`);
    e.code = data?.error?.code;
    e.status = res.status;
    throw e;
  }
  return data;
}

// Simple GET cache keyed by path (per login session).
const cache = new Map();
export function cachedGet(path) {
  if (!cache.has(path)) cache.set(path, request(path));
  return cache.get(path);
}
export function bust(...prefixes) {
  for (const k of [...cache.keys()]) {
    if (prefixes.some((p) => k.startsWith(p))) cache.delete(k);
  }
}
export function bustAll() {
  cache.clear();
}

export const api = {
  login: (role, id, password) => request('/api/auth/login', { method: 'POST', body: { role, id, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }).finally(() => {
    store.token = null;
    store.user = null;
    bustAll();
  }),
  dag: () => cachedGet('/api/content/dag'),
  tests: (q = '') => cachedGet(`/api/content/tests${q}`),
  me: () => cachedGet('/api/student/me'),
  myTests: () => cachedGet('/api/student/me/tests'),
  testReview: (id) => cachedGet(`/api/student/me/tests/${encodeURIComponent(id)}`),
  insights: () => cachedGet('/api/student/me/insights'),
  bridgePlan: () => cachedGet('/api/student/me/bridge-plan'),
  practiceStart: (focus) => request('/api/student/practice/start', { method: 'POST', body: { focus } }),
  practiceAnswer: (session_id, question_id, answer_option_id) =>
    request('/api/student/practice/answer', { method: 'POST', body: { session_id, question_id, answer_option_id } }),
  learn: (cid) => request(`/api/student/learn/${encodeURIComponent(cid)}`),
  learnAdvance: (cid, action) => request(`/api/student/learn/${encodeURIComponent(cid)}/advance`, { method: 'POST', body: action }),
  tOverview: () => cachedGet('/api/teacher/overview'),
  tAnalysis: (id) => cachedGet(`/api/teacher/tests/${encodeURIComponent(id)}/analysis`),
  tStudents: () => cachedGet('/api/teacher/students'),
  tStudent: (id) => cachedGet(`/api/teacher/students/${encodeURIComponent(id)}`),
  lecturePlan: (test_id, minutes, challenge) =>
    request(`/api/teacher/lecture-plan?test_id=${encodeURIComponent(test_id)}&minutes=${minutes}&challenge=${challenge ? 1 : 0}`),
  assign: (payload) => request('/api/teacher/assignments', { method: 'POST', body: payload }).then((r) => {
    bust('/api/teacher/assignments', '/api/student/me/bridge-plan');
    return r;
  }),
  assignments: () => cachedGet('/api/teacher/assignments'),
  reset: () => request('/api/admin/reset', { method: 'POST' }).then((r) => {
    bustAll();
    return r;
  }),
};

export { store };
