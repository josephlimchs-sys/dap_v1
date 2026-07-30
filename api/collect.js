// api/collect.js
// This is what dap-engine.js's emit() sends to when collectUrl is set —
// same event shape as the WordPress plugin's REST route, just landed
// here instead of a WordPress database table.

const { appendEvent } = require('./_store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }

  await appendEvent({ ...body, received_at: Date.now() });
  res.status(200).json({ ok: true });
};
