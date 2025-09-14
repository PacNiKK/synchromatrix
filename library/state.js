// Global application state and shared accessors
(function(){
  window.SMX = window.SMX || {};
  const state = {
    data: null,
    hourWidth: 60,
    labelWidth: 150,
    gmCollapsed: new Set(),
    collapsedGroups: new Set(),
    dirty: false,
    showNowLine: true,
    snapMinutes: 30,
  };
  window.SMX.state = state;
  // Persisted UI preferences (localStorage)
  const PREFS_KEY = 'SMX_PREFS';
  function loadPrefs(){
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.showNowLine === 'boolean') state.showNowLine = p.showNowLine;
      if (Number.isFinite(p.snapMinutes)) state.snapMinutes = Math.max(1, p.snapMinutes|0);
    } catch(_) { /* ignore */ }
  }
  function savePrefs(){
    try {
      const p = {
        showNowLine: !!state.showNowLine,
        snapMinutes: Math.max(1, parseInt(state.snapMinutes,10) || 30)
      };
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch(_) { /* ignore */ }
  }
  window.SMX.prefs = { load: loadPrefs, save: savePrefs };
  // Zoom configuration
  const ZOOM_CFG = (window.SMX_ZOOM || { steps: [{ maxHourWidth: Infinity, hourStep: 1 }] });
  function getHourLabelStep(pxPerHour){
    const steps = Array.isArray(ZOOM_CFG.steps) ? ZOOM_CFG.steps : [];
    for (let i=0;i<steps.length;i++){
      const s = steps[i];
      if (pxPerHour <= (typeof s.maxHourWidth === 'number' ? s.maxHourWidth : Infinity)) return Math.max(1, s.hourStep|0);
    }
    return 1;
  }
  window.SMX.zoom = { config: ZOOM_CFG, getHourLabelStep };
  // helpers to safely read group colors
  const colors = (window.SMX_COLORS || {});
  const PALETTE = colors.GROUP_COLOR_PALETTE || [
    "#64b5f6", "#81c784", "#ffd54f", "#ba68c8",
    "#4db6ac", "#ff8a65", "#90a4ae", "#e57373"
  ];
  const DEFAULT_GROUP_COLOR = colors.DEFAULT_GROUP_COLOR || "#999999";
  const UNGROUPED_COLOR = colors.UNGROUPED_COLOR || "#9e9e9e";

  function ensureGroupColor(g, idx){
    if (!g) return DEFAULT_GROUP_COLOR;
    if (!g.color) {
      const i = Math.max(0, (typeof idx === 'number' ? idx : (state.data?.groups||[]).indexOf(g))) % PALETTE.length;
      g.color = PALETTE[i];
    }
    return g.color;
  }
  function findGroupByName(name){ return (state.data?.groups || []).find(g => g.name === name); }
  function getGroupColorByName(name){
    if (name === 'Ungruppiert') return UNGROUPED_COLOR;
    const g = findGroupByName(name);
    return ensureGroupColor(g);
  }
  window.SMX.colors = { PALETTE, DEFAULT_GROUP_COLOR, UNGROUPED_COLOR, ensureGroupColor, findGroupByName, getGroupColorByName };
})();
