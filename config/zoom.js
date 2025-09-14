// Zoom configuration: adjust which hour labels are shown based on pixel-per-hour
// Use ascending maxHourWidth thresholds. First match applies.
// Example defaults:
// - <= 50 px/hour: show every 4th hour
// - <= 80 px/hour: show every 2nd hour
// - otherwise: show every hour
(function(){
  window.SMX_ZOOM = window.SMX_ZOOM || {
    steps: [
        { maxHourWidth: 5, hourStep: 24 },
        { maxHourWidth: 10, hourStep: 12 },
        { maxHourWidth: 20, hourStep: 6 },
      { maxHourWidth: 50, hourStep: 4 },
      { maxHourWidth: 80, hourStep: 2 },
      { maxHourWidth: Infinity, hourStep: 1 },
    ]
  };
})();
