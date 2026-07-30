// api/report.js
// Same aggregation as the WordPress plugin's Reports page SQL query —
// just computed here instead of in MySQL. GET /api/report?tour_id=onboarding-v1

const { getEvents } = require('./_store');

module.exports = async (req, res) => {
  const events = await getEvents();
  const tourId = req.query.tour_id;
  const filtered = tourId ? events.filter(e => e.tour_id === tourId) : events;

  const started = filtered.filter(e => e.type === 'tour_started').length;
  const completed = filtered.filter(e => e.type === 'tour_completed').length;

  const stepMap = {};
  filtered.forEach(e => {
    if (e.step_index === undefined) return;
    stepMap[e.step_index] = stepMap[e.step_index] || { viewed: 0, completed: 0 };
    if (e.type === 'step_viewed') stepMap[e.step_index].viewed++;
    if (e.type === 'step_completed') stepMap[e.step_index].completed++;
  });

  const steps = Object.keys(stepMap)
    .sort((a, b) => a - b)
    .map(idx => ({ step_index: Number(idx), ...stepMap[idx] }));

  res.status(200).json({
    started,
    completed,
    completion_rate: started ? Math.round((completed / started) * 100) : 0,
    steps
  });
};
