// api/_store.js
// Local dev / no database configured yet: events live in memory and
// reset on cold start — fine for testing, not for real traffic.
// Once KV_REST_API_URL is set (Vercel KV, or any Redis-compatible
// store), events persist for real. Nothing else in api/collect.js
// or api/report.js needs to change when you switch.

let memory = [];

async function appendEvent(event) {
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import('@vercel/kv');
    const events = (await kv.get('dap_events')) || [];
    events.push(event);
    await kv.set('dap_events', events);
    return;
  }
  memory.push(event);
}

async function getEvents() {
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import('@vercel/kv');
    return (await kv.get('dap_events')) || [];
  }
  return memory;
}

module.exports = { appendEvent, getEvents };
