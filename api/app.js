// Vercel serverless entry: wraps the Express app (cold start precomputes analytics).
// Client calls same-origin /api/*, rewritten here by vercel.json.
import { createApp } from '../server/app.js';

const app = createApp();

export default function handler(req, res) {
  app(req, res);
}
