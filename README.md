# DAP Tour — WordPress plugin

Same engine (`dap-engine.js` / `dap-engine.css`) as the standalone version, wired into WordPress:

- **Steps live in wp-admin**, not a JSON file — go to Settings → DAP Tour to edit copy or add steps without touching code.
- **Analytics land in your own database** — a `wp_dap_tour_events` table, populated via a REST route (`/wp-json/dap-tour/v1/collect`) instead of an external endpoint.
- **No build step, no Composer** — this is a single plain-PHP plugin.

## Installing

1. Zip the `dap-tour` folder (the one containing `dap-tour.php`).
2. wp-admin → Plugins → Add New → Upload Plugin → select the zip.
3. Activate. This creates the events table automatically.
4. Settings → DAP Tour → paste in your steps JSON (a starter example is pre-filled), matching real selectors on your pages.

## Before this works on a real site

- **Check the hosting plan.** WordPress.com's free/Personal/Premium tiers block custom plugins entirely — this needs a self-hosted WordPress.org install, or WordPress.com Business plan or above.
- **Selectors must match the live theme's markup.** The pre-filled example (`#add-expense-btn`, `#filter-btn`) is a placeholder — inspect the real page and swap in real IDs/classes.

## Reading the analytics

The `wp_dap_tour_events` table has one row per event. A quick funnel query:

```sql
SELECT step_index,
       SUM(event_type = 'step_viewed') AS viewed,
       SUM(event_type = 'step_completed') AS completed
FROM wp_dap_tour_events
WHERE tour_id = 'onboarding-v1'
GROUP BY step_index
ORDER BY step_index;
```

`viewed` vs `completed` per step is the same drop-off signal as the standalone version — just queryable directly in phpMyAdmin or any DB tool instead of a separate analytics service.
