// App wiring: connects UI and modules
(function(){
  const { state } = window.SMX;
  const { ymd } = window.SMX.date;

  function normalizeLoadedData(data){
    const out = { ...data };
    const norm = (v) => {
      if (!v) return undefined;
      const s = String(v);
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0,10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      if (!isNaN(d)) return ymd(d);
      return undefined;
    };
    out.startDate = norm(data.startDate) || ymd(new Date());
    out.endDate = norm(data.endDate) || out.startDate;
    out.date = norm(data.date) || out.startDate;
    out.groups = Array.isArray(data.groups) ? data.groups : [];
    out.events = Array.isArray(data.events) ? data.events : [];

    out.events = out.events.map(ev => {
      const e = { ...ev };
      const coerce = (v, fallbackDate) => {
        if (!v) return `${fallbackDate}T09:00`;
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T09:00`;
        const d = new Date(v);
        if (!isNaN(d)) return `${ymd(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        return `${fallbackDate}T09:00`;
      };
      const base = out.startDate || ymd(new Date());
      e.start = coerce(e.start, base);
      e.end = coerce(e.end, base);
      if (new Date(e.end) <= new Date(e.start)) {
        const sd = new Date(e.start);
        e.end = `${ymd(sd)}T${String((sd.getHours()+1)%24).padStart(2,'0')}:${String(sd.getMinutes()).padStart(2,'0')}`;
      }
      if (!Array.isArray(e.attendees)) e.attendees = [];
      e.title = e.title || '(ohne Titel)';
      return e;
    });
    return out;
  }

  function wire(){
    const fileInput = document.getElementById("fileInput");
    const downloadBtn = document.getElementById("downloadBtn");
    const manageBtn = document.getElementById("manageBtn");
    const adminBtn = document.getElementById("adminBtn");
    const zoomSlider = document.getElementById("zoomSlider");
    const newEventBtn = document.getElementById("newEventBtn");
    const noAttBtn = document.getElementById("noAttBtn");
    const calWrapper = document.getElementById("calendarWrapper");
    const menuToggle = document.getElementById("menuToggle");
    const topMenu = document.getElementById("topMenu");
  const themeToggle = document.getElementById("themeToggle");
  const nowToggle = document.getElementById("nowToggle");

    const dirtyBadge = document.getElementById('dirtyBadge');
    function updateDirtyBadge(){ if (dirtyBadge) dirtyBadge.style.display = state.dirty ? 'inline-block' : 'none'; }
    try { window.addEventListener('smx:dirty-changed', updateDirtyBadge); } catch(_) {}

    if (fileInput) fileInput.addEventListener("change", function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      const loader = document.createElement('span'); loader.id = 'loadBadge'; loader.textContent = 'Laden…'; loader.style.marginLeft = '8px'; fileInput.insertAdjacentElement('afterend', loader);
      reader.onload = function(evt) {
        try {
          const raw = JSON.parse(evt.target.result);
          state.data = normalizeLoadedData(raw);
          state.dirty = false;
          window.SMX.calendar.loadCalendar();
          try { window.dispatchEvent(new CustomEvent('smx:calendar-rendered')); } catch(_) {}
          if (downloadBtn) downloadBtn.disabled = false;
          if (manageBtn) manageBtn.disabled = false;
          if (adminBtn) adminBtn.disabled = false;
          if (newEventBtn) newEventBtn.disabled = false;
          if (noAttBtn) noAttBtn.disabled = false;
          window.SMX.modals.updateNoAttCount();
          updateDirtyBadge();
        } catch (err) {
          const cal = document.getElementById("calendar");
          if (cal) cal.textContent = "Invalid JSON file: " + err;
        } finally {
          const b = document.getElementById('loadBadge'); if (b) b.remove();
        }
      };
      reader.readAsText(file, "UTF-8");
    });

    function applyZoomPercent(percentVal){
      if (!zoomSlider) return;
      const min = 5, max = 150;
      let p = Math.max(1, Math.min(100, parseInt(percentVal, 10) || 1));
      zoomSlider.value = String(p);
      const t = p / 100;
      state.hourWidth = Math.round(min * Math.pow(max / min, t));
      if (state.data) window.SMX.calendar.loadCalendar();
    }

    if (zoomSlider) zoomSlider.addEventListener("input", e => {
      applyZoomPercent(e.target.value);
      // When zoom changes and now-tracking is on, re-center now
      if (nowToggle && nowToggle.checked) {
        requestAnimationFrame(centerNowAtViewport);
      }
    });

    if (menuToggle && topMenu) {
      // start collapsed
      topMenu.classList.remove('open');
      topMenu.setAttribute('aria-hidden', 'true');
      menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.textContent = '☰';

      menuToggle.addEventListener('click', () => {
        const willOpen = !topMenu.classList.contains('open');
        if (willOpen) {
          topMenu.classList.add('open');
          topMenu.setAttribute('aria-hidden', 'false');
          menuToggle.setAttribute('aria-expanded', 'true');
          menuToggle.textContent = '✖';
        } else {
          topMenu.classList.remove('open');
          topMenu.setAttribute('aria-hidden', 'true');
          menuToggle.setAttribute('aria-expanded', 'false');
          menuToggle.textContent = '☰';
        }
      });
    }

    // Theme toggle with persistence
    function applyTheme(mode){
      const body = document.body;
      if (mode === 'dark') {
        body.classList.add('dark');
        if (themeToggle) themeToggle.textContent = '🌙';
        try { localStorage.setItem('smx:theme','dark'); } catch(_) {}
      } else {
        body.classList.remove('dark');
        if (themeToggle) themeToggle.textContent = '☀️';
        try { localStorage.setItem('smx:theme','light'); } catch(_) {}
      }
    }
    try {
      const saved = localStorage.getItem('smx:theme');
      applyTheme(saved === 'dark' ? 'dark' : 'light');
    } catch(_) { applyTheme('light'); }
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        applyTheme(isDark ? 'light' : 'dark');
        themeToggle.setAttribute('aria-pressed', String(!isDark));
      });
    }

    if (calWrapper) {
      calWrapper.addEventListener('wheel', (e) => {
        // Ctrl+wheel => zoom; otherwise scroll horizontally
        if (e.ctrlKey) {
          e.preventDefault();
          const current = zoomSlider ? parseInt(zoomSlider.value, 10) || 50 : 50;
          // deltaY < 0 => zoom in (increase percent); scale step
          const step = 5;
          const next = current + (e.deltaY < 0 ? step : -step);
          applyZoomPercent(next);
          return;
        }else if(e.shiftKey){
          // Shift+wheel: horizontal scroll. Use deltaX when present, else translate deltaY to horizontal.
          const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if (dx !== 0) {
            e.preventDefault();
            calWrapper.scrollLeft += dx;
          }
        }
      }, { passive: false });
    }

    if (downloadBtn) downloadBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date();
      const fname = `synchromatrix-${ymd(ts)}.json`;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      state.dirty = false;
      updateDirtyBadge();
    });

    // Auto-center "now" at 10% when toggle is enabled
    let nowCenterTimer = null;
    function centerNowAtViewport(){
      const wrapper = document.getElementById('calendarWrapper');
      if (!wrapper) return;
      const left = (window.SMX.calendar.nowLeftPx && window.SMX.calendar.nowLeftPx());
      if (left == null) return;
      const target = Math.max(0, left - wrapper.clientWidth * 0.20);
      wrapper.scrollLeft = target;
    }
    function startNowCentering(){
      // Force show now-line while tracking
      state.showNowLine = true;
      try { window.SMX.prefs.save(); } catch(_) {}
      // Initial center after render
      centerNowAtViewport();
      // Update every minute to follow time
      if (nowCenterTimer) { try { clearInterval(nowCenterTimer); } catch(_) {} nowCenterTimer = null; }
      try { nowCenterTimer = setInterval(centerNowAtViewport, 60 * 1000); } catch(_) {}
    }
    function stopNowCentering(){
      if (nowCenterTimer) { try { clearInterval(nowCenterTimer); } catch(_) {} nowCenterTimer = null; }
    }
    // Initialize toggle from prefs (default off if not present)
    if (nowToggle) {
      // default unchecked; but if prefs.showNowLine was true, keep checkbox unchecked; this toggle is for auto-centering behavior
      nowToggle.checked = false;
      nowToggle.addEventListener('change', () => {
        if (nowToggle.checked) {
          startNowCentering();
          // ensure calendar reflects now-line
          if (state.data) { window.SMX.calendar.loadCalendar(); try { window.dispatchEvent(new CustomEvent('smx:calendar-rendered')); } catch(_) {} }
        } else {
          stopNowCentering();
        }
      });
    }

    // Re-center after each calendar render if tracking is active
    try {
      window.addEventListener('smx:calendar-rendered', () => {
        if (nowToggle && nowToggle.checked) {
          requestAnimationFrame(centerNowAtViewport);
        }
      });
    } catch(_) {}

    // Group Manager modal
    const gmModal = document.getElementById("gmModal");
    const gmClose = document.getElementById("gmModalClose");
    const gmOpenBtn = document.getElementById("manageBtn");
    function openGmModal(){ if (!state.data) return; window.SMX.groupManager.renderGroupManager(); gmModal.classList.add("open"); gmModal.setAttribute("aria-hidden","false"); const gmBody = document.getElementById("gmModalBody"); if (gmBody) gmBody.scrollTop = 0; }
    function closeGmModal(){ gmModal.classList.remove("open"); gmModal.setAttribute("aria-hidden","true"); }
    if (gmOpenBtn) gmOpenBtn.addEventListener("click", openGmModal);
    if (gmClose) gmClose.addEventListener("click", closeGmModal);
    if (gmModal) gmModal.addEventListener("click", (e)=>{ if (e.target === gmModal) closeGmModal(); });
    window.addEventListener("keydown", (e)=>{ if (e.key === "Escape" && gmModal.classList.contains("open")) closeGmModal(); });

    // Admin modal
    const adminModal = document.getElementById("adminModal");
    const adminClose = document.getElementById("adminModalClose");
    const adminOpenBtn = document.getElementById("adminBtn");
    if (adminOpenBtn) adminOpenBtn.addEventListener('click', window.SMX.modals.openAdmin);
    if (adminClose) adminClose.addEventListener('click', window.SMX.modals.closeAdmin);
    if (adminModal) adminModal.addEventListener('click', (e)=>{ if (e.target === adminModal) window.SMX.modals.closeAdmin(); });

    // Event editor + No-attendees
    const evModal = document.getElementById("evModal");
    const evClose = document.getElementById("evModalClose");
    if (evClose) evClose.addEventListener("click", window.SMX.modals.closeEvModal);
    if (evModal) evModal.addEventListener("click", (e)=>{ if (e.target === evModal) window.SMX.modals.closeEvModal(); });
    if (newEventBtn) {
      // Keep click behavior to open empty editor
      newEventBtn.addEventListener("click", () => window.SMX.modals.openEvModal(-1));
      // Enable drag-and-drop creation on timeline rows
      newEventBtn.setAttribute('draggable', 'true');
      newEventBtn.addEventListener('dragstart', (e) => {
        const dt = e.dataTransfer; if (!dt) return;
        try {
          dt.effectAllowed = 'copy';
          dt.setData('smx/new-event', '1');
          dt.setData('text/plain', 'smx-new-event');
        } catch(_) {}
      });
    }
    const naModal = document.getElementById("naModal");
    const naClose = document.getElementById("naModalClose");
    if (noAttBtn) noAttBtn.addEventListener("click", window.SMX.modals.openNaModal);
    if (naClose) naClose.addEventListener("click", window.SMX.modals.closeNaModal);
    if (naModal) naModal.addEventListener("click", (e)=>{ if (e.target === naModal) window.SMX.modals.closeNaModal(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { if (window.SMX?.prefs) window.SMX.prefs.load(); } catch(_) {}
    wire();
    try {
      window.addEventListener('beforeunload', (e) => {
        if (state.dirty) {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      });
    } catch(_) {}
    // auto-open file dialog if no data yet
    const fileInput = document.getElementById('fileInput');
    if (!state.data && fileInput) {
      // slight delay to ensure UI is ready and browsers allow programmatic open
      setTimeout(() => {
        try {fileInput.click(); } catch(_) { alert('Error');}
      }, 200);
    }
    // When calendar renders via loadCalendar, emit an event used by auto-centering
    try { document.dispatchEvent(new Event('smx:request-rendered-event')); } catch(_) {}
  });
})();
