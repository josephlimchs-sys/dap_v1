// api/_store.js
// Local dev / no database configured yet: events are written to a shared
// temp file, so both api/collect.js and api/report.js (which run as
// SEPARATE serverless function processes, even under `vercel dev`) see
// the same data. A plain in-memory array doesn't work here — each
// function has its own copy, so collect.js would write events that
// report.js could never see.
//
// This file-based fallback is fine for local testing on one machine,
// but NOT reliable once actually deployed to Vercel — production
// serverless instances don't share a persistent filesystem across
// invocations. Once KV_REST_API_URL is set (Vercel KV, or any
// Redis-compatible store), events persist for real, locally and in
// production, and nothing else in this project needs to change.

const fs = require('fs');
const path = require('path');
const os = require('os');

const FILE = path.join(os.tmpdir(), 'dap-tour-events.json');

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeFile(events) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(events));
  } catch (e) {
    console.error('[dap-store] could not write local event file:', e);
  }
}

async function appendEvent(event) {
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import('@vercel/kv');
    const events = (await kv.get('dap_events')) || [];
    events.push(event);
    await kv.set('dap_events', events);
    return;
  }
  const events = readFile();
  events.push(event);
  writeFile(events);
}

async function getEvents() {
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import('@vercel/kv');
    return (await kv.get('dap_events')) || [];
  }
  return readFile();
}

module.exports = { appendEvent, getEvents };
