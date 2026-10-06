import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 8787);

const app = createApp();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`cognigraph-ai server listening on :${PORT}`);
});
