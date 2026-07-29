# DAP Tour

A portable onboarding-tour engine: two files (`dap-engine.js`, `dap-engine.css`)
plus a JSON config. Drop into any site — no build step, no framework required.

## Files

| File | What it's for | Who edits it |
|---|---|---|
| `dap-engine.js` | The tour logic — spotlight, tooltip, dots, event emission | Rarely, once it's working |
| `dap-engine.css` | The tour's own visual theme (independent of the host site) | Design tweaks only |
| `tour-config.json` | The actual steps: which element, what copy | Content edits, most common |
| `index.html` | Example of wiring the two files into a real page | Copy this pattern into the client's real pages |

## Wiring it into a page

```html
<link rel="stylesheet" href="dap-engine.css">
...
<script src="dap-engine.js"></script>
<script>
  DAP.init({
    configUrl: 'tour-config.json',
    siteId: 'client-name-prod',
    tourId: 'onboarding-v1'
    // collectUrl: '/collect'   ← add once an analytics endpoint exists
  });
</script>
```

## Deploying

1. Push this folder to a GitHub repo.
2. Vercel → Add New Project → Import Git Repository → select it.
   No build command needed — it's detected as static and deploys as-is.
3. Every `git push` after that redeploys automatically. Pull requests get
   their own preview URL before anything touches production.

## Analytics

Without `collectUrl` set, every event (`tour_started`, `step_viewed`,
`step_completed`, `tour_completed`, `tour_abandoned`) just logs to the
browser console — useful while wiring up steps. Set `collectUrl` once
you have an endpoint (e.g. a Vercel serverless function) to start
receiving real completion/drop-off data.
