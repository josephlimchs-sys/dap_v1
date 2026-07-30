# DAP Tour

A portable onboarding-tour engine: two files (`dap-engine.js`, `dap-engine.css`)
plus a JSON config. Drop into any site — no build step, no framework required.

## Files

| File | What it's for | Who edits it |
|---|---|---|
| `dap-engine.js` | The tour logic — spotlight, tooltip, dots, validation gating, event emission | Rarely, once it's working |
| `dap-engine.css` | The tour's own visual theme (independent of the host site) | Design tweaks only |
| `tour-config.json` | The actual steps: which element, what copy, optional validation rule | Content edits, most common |
| `index.html` | Example of wiring the two files into a real page | Copy this pattern into the client's real pages |
| `api/collect.js` | Serverless endpoint that receives analytics events | — |
| `api/report.js` | Serverless endpoint that aggregates the funnel | — |
| `api/_store.js` | Storage layer — in-memory locally, real DB once configured | — |
| `reports.html` | Dashboard showing tours started, completion rate, per-step drop-off | Whoever monitors adoption |

## Wiring it into a page

```html
<link rel="stylesheet" href="dap-engine.css">
...
<script src="dap-engine.js"></script>
<script>
  DAP.init({
    configUrl: 'tour-config.json',
    siteId: 'client-name-prod',
    tourId: 'onboarding-v1',
    collectUrl: '/api/collect'
  });
</script>
```

## Requiring the real action, not just a click on "Next"

By default, "Next" is always clickable — the person can click through without ever touching the highlighted element. Two ways to require the real action instead:

**A click on a button/link/element** — add `"action": "click"` to the step. "Next" disables, a hint appears ("Click the highlighted element to continue"), and clicking the actual spotlighted element is what advances the tour:

```json
{ "selector": "#add-expense-btn", "title": "Log an expense", "body": "...", "action": "click" }
```

**Filling in a form field correctly** — add a `validate` rule (see below). This is the same idea applied to typing instead of clicking.

"Skip" always stays available on both, so a broken selector or a confused user isn't ever fully stuck.

## Guiding a form fill, not just a feature tour

Add a `validate` rule to any step targeting an input:

```json
{ "selector": "#signup-email", "title": "Your email", "body": "We'll send the confirmation here.",
  "validate": { "type": "pattern", "value": "^[^@]+@[^@]+\\.[^@]+$", "message": "That doesn't look like a valid email yet." } }
```

"Next" stays disabled and shows the `message` inline until the field passes the rule, then
auto-advances to the next step — so filling the form *is* the act of completing the tour.
Rule types: `notEmpty`, `minLength` (needs a `value`), `pattern` (any regex). Set
`"autoAdvance": false` on a step to require a manual click even once valid.

## Deploying

1. Push this folder to a GitHub repo.
2. Vercel → Add New Project → Import Git Repository → select it.
   No build command needed — static files and the `api/` folder are both
   auto-detected; the `api/*.js` files become serverless functions with
   zero config (no `vercel.json` required for this).
3. Every `git push` after that redeploys automatically. Pull requests get
   their own preview URL before anything touches production.

## Analytics

Events (`tour_started`, `step_viewed`, `step_completed`, `tour_completed`,
`tour_abandoned`) POST to `/api/collect` and are stored via `api/_store.js`.
Out of the box that's **in-memory** — fine for testing, but it resets on
every cold start, so it's not for real production traffic.

To make it persistent: create a [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
store and link it to the project — Vercel sets `KV_REST_API_URL` automatically,
and `api/_store.js` switches to using it with no code changes needed on your part.
Any other Redis-compatible store works the same way if you'd rather not use Vercel KV.

Visit `reports.html` (or `yoursite.com/reports.html`) to see tours started,
completion rate, and per-step drop-off — the same metrics as the WordPress
plugin's Reports page, computed here from `api/report.js` instead of a
WordPress database table.

