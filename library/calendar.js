// Calendar/timeline rendering module
//
// Responsibilities:
// - Render date/hour headers and rows for groups and people
// - Place person events (foreground) and a single tall group-span event (background)
// - Support drag (move) and resize (left/right) with snapping in minutes
// - Optionally show a live "now" line based on user preference
// - Keep DOM in sync when an event changes (drag/resize)
(function(){
  window.SMX = window.SMX || {};
  const { state } = window.SMX;
  const { ymd, parseYMD, addDays, diffDays } = window.SMX.date;
  const { getGroupColorByName } = window.SMX.colors; // ensureGroupColor is unused here

  /** Convert hex color (#rgb or #rrggbb) to rgb object */
  function hexToRgb(hex){
    if (!hex) return { r: 153, g: 153, b: 153 };
    let h = hex.replace('#','').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const int = parseInt(h, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }
  /** Compose an rgba string from rgb + alpha */
  function rgba(rgb, a){ const {r,g,b} = rgb||{r:153,g:153,b:153}; return `rgba(${r}, ${g}, ${b}, ${a})`; }

  /**
   * Make an event element draggable horizontally (move entire event).
   * Updates all mirrored instances after dropping.
   */
  function makeDraggable(el){
    let isDragging = false, startX, origLeft, hasMoved = false;
    const ev = state.data.events[el.dataset.eventIndex];

    el.addEventListener("mousedown", e => {
      if (e.target.classList.contains("resize-handle")) return;
      isDragging = true; startX = e.clientX; origLeft = parseFloat(el.style.left); hasMoved = false; e.preventDefault();
    });
    window.addEventListener("mousemove", e => {
      if (!isDragging) return; const dx = e.clientX - startX; if (Math.abs(dx) < 3) return; hasMoved = true; const newLeft = origLeft + dx;
      const idx = state.data.events.indexOf(ev);
      const elems = document.querySelectorAll(`.event[data-event-index='${idx}']`);
      elems.forEach(elm => { elm.style.left = newLeft + "px"; });
    });
    window.addEventListener("mouseup", () => {
      if (isDragging) { isDragging = false; if (hasMoved) { const idx = state.data.events.indexOf(ev); const elems = document.querySelectorAll(`.event[data-event-index='${idx}']`); const leftPx = parseFloat(elems[0].style.left); const widthPx = parseFloat(elems[0].style.width); updateEvent(ev, leftPx, widthPx); } }
    });
  }

  /**
   * Make an event element resizable from a given side.
   * side: "left" | "right" — adjusts start or end while preserving the opposite edge.
   */
  function makeResizable(handle, side, el){
    let isResizing = false, startX, origWidth, origLeft, hasResized = false;
    const ev = state.data.events[el.dataset.eventIndex];
    handle.addEventListener("mousedown", e => { isResizing = true; startX = e.clientX; origWidth = parseFloat(el.style.width); origLeft = parseFloat(el.style.left); hasResized = false; e.preventDefault(); e.stopPropagation(); });
    window.addEventListener("mousemove", e => {
      if (!isResizing) return; const dx = e.clientX - startX; if (Math.abs(dx) < 2) return; hasResized = true; let newLeft, newWidth;
      if (side === "right") { newLeft = origLeft; newWidth = origWidth + dx; } else { newLeft = origLeft + dx; newWidth = origWidth - dx; }
      const minWidth = Math.max(6, (state.hourWidth * 0.25));
      if (newWidth < minWidth) { if (side === 'left') { newLeft = origLeft + (origWidth - minWidth); } newWidth = minWidth; }
      const idx = state.data.events.indexOf(ev); const elems = document.querySelectorAll(`.event[data-event-index='${idx}']`);
      elems.forEach(elm => { elm.style.left = newLeft + "px"; elm.style.width = newWidth + "px"; });
    });
    window.addEventListener("mouseup", () => { if (isResizing) { isResizing = false; if (hasResized) { updateEvent(ev, parseFloat(el.style.left), parseFloat(el.style.width), side); syncAllEventElements(ev); } } });
  }
  /**
   * Update the event model from pixel positions then sync DOM clones.
   * The left/width pixels include visual paddings/handles, we compensate here (+/- constants).
   */
  function updateEvent(ev, leftPx, widthPx, side = "both") {
    // Compensate 4px left padding and 4px right padding (total 8px width delta)
    leftPx = leftPx - 4;
    widthPx = widthPx + 8;

    const snapMinutes = Math.max(1, parseInt(state.snapMinutes,10) || 30);
    const sDate = state.data.startDate || ymd(new Date());
    const [yy, mm, dd] = sDate.split('-').map(n => parseInt(n, 10));

    // Calculate current start and end as Date objects so we can preserve duration on moves
    const origStart = new Date(ev.start);
    const origEnd = new Date(ev.end);

    if (side === "left") {
      // Only update start, keep end fixed
      const startTotalMin = Math.max(
        0,
        Math.round(((leftPx - state.labelWidth) * 60 / state.hourWidth) / snapMinutes) * snapMinutes
      );
      const startDay = Math.floor(startTotalMin / (24 * 60));
      const startHour = Math.floor((startTotalMin % (24 * 60)) / 60);
      const startMinute = startTotalMin % 60;
      const startDateObj = new Date(yy, mm - 1, dd + startDay);
      ev.start = `${ymd(startDateObj)}T${window.SMX.date.pad2(startHour)}:${window.SMX.date.pad2(startMinute)}`;
      // Keep end unchanged
    } else if (side === "right") {
      // Only update end, keep start fixed
      const calStartDate = new Date(yy, mm - 1, dd);
      const startTotalMin = Math.round((new Date(ev.start) - calStartDate) / 60000);

      // Compute new right edge in minutes and snap the END (not the duration)
      const rightPx = leftPx + widthPx;
      const endRawMin = ((rightPx - state.labelWidth) / state.hourWidth) * 60;
      let endTotalMin = Math.round(endRawMin / snapMinutes) * snapMinutes;

      // Ensure end is after start (allow durations smaller than snapMinutes if start isn't aligned)
      if (endTotalMin <= startTotalMin) endTotalMin = startTotalMin + 1;

      const endDay = Math.floor(endTotalMin / (24 * 60));
      const endHour = Math.floor((endTotalMin % (24 * 60)) / 60);
      const endMinute = endTotalMin % 60;
      const endDateObj = new Date(yy, mm - 1, dd + endDay);
      ev.end = `${ymd(endDateObj)}T${window.SMX.date.pad2(endHour)}:${window.SMX.date.pad2(endMinute)}`;
      // Keep start unchanged
    } else {
      // Move entire event: preserve original duration while dragging
      const startTotalMin = Math.max(
        0,
        Math.round(((leftPx - state.labelWidth) / state.hourWidth) * 60 / snapMinutes) * snapMinutes
      );
      const durationMinutes = Math.max(1, Math.round((origEnd - origStart) / 60000));
      const startDay = Math.floor(startTotalMin / (24 * 60));
      const startHour = Math.floor((startTotalMin % (24 * 60)) / 60);
      const startMinute = startTotalMin % 60;
      const endTotalMin = startTotalMin + durationMinutes;
      const endDay = Math.floor(endTotalMin / (24 * 60));
      const endHour = Math.floor((endTotalMin % (24 * 60)) / 60);
      const endMinute = endTotalMin % 60;
      const startDateObj = new Date(yy, mm - 1, dd + startDay);
      const endDateObj = new Date(yy, mm - 1, dd + endDay);
      ev.start = `${ymd(startDateObj)}T${window.SMX.date.pad2(startHour)}:${window.SMX.date.pad2(startMinute)}`;
      ev.end = `${ymd(endDateObj)}T${window.SMX.date.pad2(endHour)}:${window.SMX.date.pad2(endMinute)}`;
    }
    state.dirty = true;
    try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
    syncAllEventElements(ev);
  }

  /** Sync all DOM clones of a single event (after data model changed). */
  function syncAllEventElements(ev){
    const idx = state.data.events.indexOf(ev);
    const elems = document.querySelectorAll(`.event[data-event-index='${idx}']`);
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    const calStart = state.data.startDate ? parseYMD(state.data.startDate) : new Date();
    const startMid = new Date(calStart.getFullYear(), calStart.getMonth(), calStart.getDate());
    const sH = (start - startMid) / 36e5;
    const eH = (end - startMid) / 36e5;
    elems.forEach(el => {
      el.style.left = (state.labelWidth + sH * state.hourWidth) + "px";
      // Subtract 8px to account for 4px paddings/handles on each side
      el.style.width = (((eH - sH) * state.hourWidth) - 8) + "px";
    });
  }

  function loadCalendar(){
    const data = state.data; const container = document.getElementById("calendar"); if (!container) return;
    container.innerHTML = "";
    if (!data) { container.textContent = 'Bitte JSON laden, um den Kalender zu sehen.'; return; }
    const startDate = data.startDate ? parseYMD(data.startDate) : new Date();
    const endDate = data.endDate ? parseYMD(data.endDate) : new Date();
    const startMid = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endMid = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const numDays = Math.max(1, Math.round((endMid.getTime() - startMid.getTime())/86400000) + 1);
    window.SMX.calendar._lastRender = { startMid, numDays };

    // Mirror CSS variables
    container.style.setProperty("--hour-width", state.hourWidth + "px");
    container.style.setProperty("--totalHours", (numDays*24).toString());
    container.style.setProperty("--label-size", state.labelWidth + "px");
    document.documentElement.style.setProperty('--hour-width', `${state.hourWidth}px`);
    document.documentElement.style.setProperty('--totalHours', `${numDays*24}`);
    document.documentElement.style.setProperty('--label-size', `${state.labelWidth}px`);

    const hours = [...Array(numDays*24).keys()];

    // Apply grid density class on wrapper based on header step
    const wrapper = document.getElementById('calendarWrapper');
    const hourStep = (window.SMX.zoom ? window.SMX.zoom.getHourLabelStep(state.hourWidth) : 1);
    if (wrapper) {
      wrapper.classList.remove('grid-h','grid-30','grid-15');
      if (hourStep <= 1) wrapper.classList.add('grid-15');
      else if (hourStep <= 2) wrapper.classList.add('grid-30');
      else wrapper.classList.add('grid-h');
      // Also enable dynamic grid with 4 subdivisions per header block
      wrapper.classList.add('grid-dyn');
      wrapper.style.setProperty('--header-step', String(hourStep)); // hours per header division
    }

    const dateHeader = document.createElement("div");
    dateHeader.className = "timeline date-header";
    const emptyDivDate = document.createElement("div");
    emptyDivDate.className = "label";
    dateHeader.appendChild(emptyDivDate);
    const weekdays = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    for (let d = 0; d < numDays; d++) {
      const cur = addDays(startMid, d);
      const dd = String(cur.getDate()).padStart(2, '0');
      const mm = String(cur.getMonth()+1).padStart(2, '0');
      const label = `${weekdays[cur.getDay()]} ${dd}.${mm}.`;
      const div = document.createElement("div");
      div.className = "header"; div.textContent = label; div.style.gridColumn = `span ${24}`;
      dateHeader.appendChild(div);
    }
    container.appendChild(dateHeader);

    const header = document.createElement("div");
    header.className = "timeline header-row";
    const emptyDivHour = document.createElement("div");
    emptyDivHour.className = "label";
    header.appendChild(emptyDivHour);
    // Create header blocks according to hourStep (already computed above)
    for (let h = 0; h < hours.length; ) {
      const span = Math.min(hourStep, hours.length - h);
      const div = document.createElement("div");
      div.className = "header";
      div.style.gridColumn = `span ${span}`;
      const hourTxt = (h % 24).toString().padStart(2, "0") + ":00";
      const dIdx = Math.floor(h/24);
      const cur = addDays(startMid, dIdx);
      const dd = String(cur.getDate()).padStart(2, '0');
      const mm = String(cur.getMonth()+1).padStart(2, '0');
      const w = ['So','Mo','Di','Mi','Do','Fr','Sa'][cur.getDay()];
      const dayTxt = `${w} ${dd}.${mm}.`;
      const hourEl = document.createElement('div');
      hourEl.className ='h-hour';
      hourEl.textContent = hourTxt;
      const dayEl = document.createElement('div');
      dayEl.className = 'h-day';
      dayEl.textContent = dayTxt;
      div.appendChild(hourEl);
      div.appendChild(dayEl);
      header.appendChild(div);
      h += span;
    }
    container.appendChild(header);

    try { if (window.__nowTimer) { clearInterval(window.__nowTimer); window.__nowTimer = null; } } catch(_){}
    let nowLine = container.querySelector('.now-line');
    if (!nowLine) { nowLine = document.createElement('div'); nowLine.className = 'now-line'; container.appendChild(nowLine); }
    const rangeStart = new Date(startMid.getTime());
    const rangeEnd = new Date(startMid.getTime() + (numDays * 24 * 60 * 60 * 1000));
    function updateNow() {
      const now = new Date();
      if (state.showNowLine && now >= rangeStart && now <= rangeEnd) {
        const hoursSince = (now - rangeStart) / 36e5;
        const left = state.labelWidth + hoursSince * state.hourWidth;
        nowLine.style.display = '';
        nowLine.style.left = left + 'px';
      } else {
        nowLine.style.display = 'none';
      }
    }
    updateNow();
    try { window.__nowTimer = setInterval(updateNow, 60 * 1000); } catch(_) {}

    function getRows() {
      const rows = [];
      state.data.groups.forEach(g => {
        if (g.name === 'Ungruppiert' && (!g.people || g.people.length === 0)) return;
        rows.push({ type: "group", name: g.name });
        if (!state.collapsedGroups.has(g.name)) {
          (g.people||[]).forEach(p => rows.push({ type: "person", name: p, group: g.name }));
        }
      });
      return rows;
    }
    const rows = getRows();

    // Build rows and keep references for layout math
  const groupRowMap = new Map(); // groupName -> group rowDiv
  const groupPersonRows = new Map(); // groupName -> [person rowDivs]
  const personRowMap = new Map(); // personName -> rowDiv

    rows.forEach(row => {
      const rowDiv = document.createElement("div");
      rowDiv.className = "timeline";
      // Enable drop on rows to create events
      rowDiv.addEventListener('dragover', (e) => {
        if (!state.data) return;
        const dt = e.dataTransfer;
        if (!dt) return;
        if (dt.types && (dt.types.includes('smx/new-event') || dt.types.includes('text/plain'))) {
          e.preventDefault();
          dt.dropEffect = 'copy';
        }
      });
      rowDiv.addEventListener('drop', (e) => {
        const dt = e.dataTransfer; if (!dt) return;
        const has = dt.types && (dt.types.includes('smx/new-event') || dt.types.includes('text/plain'));
        if (!has) return;
        e.preventDefault();
        // Only create for person rows (ignore group-only drops)
        if (row.type !== 'person') return;
        const wrapperRect = container.getBoundingClientRect();
        const x = e.clientX - wrapperRect.left; // relative to calendar container
        // Convert x to minutes from start of visible range
        const leftPx = Math.max(0, x - state.labelWidth);
        const minutesFromStart = Math.max(0, Math.round((leftPx / state.hourWidth) * 60 / state.snapMinutes) * state.snapMinutes);
        const startDate = data.startDate ? parseYMD(data.startDate) : new Date();
        const startMid = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const startTs = new Date(startMid.getTime() + minutesFromStart * 60000);
        const defaultDurMin = Math.max(15, state.snapMinutes);
        const endTs = new Date(startTs.getTime() + defaultDurMin * 60000);
        const { ymd, pad2 } = window.SMX.date;
        const ev = {
          title: 'Neuer Termin',
          start: `${ymd(startTs)}T${pad2(startTs.getHours())}:${pad2(startTs.getMinutes())}`,
          end: `${ymd(endTs)}T${pad2(endTs.getHours())}:${pad2(endTs.getMinutes())}`,
          attendees: [row.name],
          color: window.SMX.colors.getGroupColorByName(row.group)
        };
        state.data.events.push(ev);
        state.dirty = true;
        try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
        loadCalendar();
        // Optional: open editor immediately
        try { if (typeof window.SMX.modals?.openEvModal === 'function') window.SMX.modals.openEvModal(state.data.events.length - 1); } catch(_) {}
      });
      const label = document.createElement("div");
      label.className = row.type === "group" ? "label group" : "label";
      const groupNameForRow = row.type === "group" ? row.name : row.group;
      const gCol = getGroupColorByName(groupNameForRow);
      const rgb = hexToRgb(gCol);
      if (row.type === 'group') {
        const isCollapsed = state.collapsedGroups.has(row.name);
        const caret = isCollapsed ? "\u25b6" : "\u25bc";
        label.textContent = `${caret} ${row.name}`;
        label.style.background = rgba(rgb, 0.6);
        label.addEventListener('click', () => {
          // Toggle collapse state and re-render so group-span heights recompute
          if (state.collapsedGroups.has(row.name)) state.collapsedGroups.delete(row.name);
          else state.collapsedGroups.add(row.name);
          loadCalendar();
        });
        groupRowMap.set(row.name, rowDiv);
        groupPersonRows.set(row.name, []);
      } else {
        label.textContent = `${row.name}`;
        label.style.background = rgba(rgb, 0.3);
        personRowMap.set(row.name, rowDiv);
        const arr = groupPersonRows.get(row.group) || [];
        arr.push(rowDiv);
        groupPersonRows.set(row.group, arr);
      }
      label.style.borderLeft = "6px solid " + gCol;
      rowDiv.appendChild(label);
      // Hour cells background tinted by group color (stronger for group rows)
      hours.forEach(() => {
        const cell = document.createElement("div");
        cell.className = "cell";
        const alpha = row.type === "group" ? 0.5 : 0.2;
        cell.style.background = rgba(rgb, alpha);
        rowDiv.appendChild(cell);
      });
      container.appendChild(rowDiv);
    });

    // Helper to compute horizontal placement
    function setHoriz(el, ev){
      const clipStart = new Date(ev.start);
      const clipEnd = new Date(ev.end);
      const startHour = (clipStart - startMid) / 36e5;
      const endHour = (clipEnd - startMid) / 36e5;
      el.style.left = (state.labelWidth + startHour * state.hourWidth) + "px";
      // Subtract 8px to account for 4px paddings/handles on each side
      el.style.width = ((endHour - startHour) * state.hourWidth - 8) + "px";
    }

    // Render person events on their rows (foreground)
    (state.data.events || []).forEach(ev => {
      const attendees = ev.attendees || [];
      attendees.forEach(name => {
        const rowDiv = personRowMap.get(name);
        if (!rowDiv) return;
        const eventDiv = document.createElement("div");
        eventDiv.className = "event";
        eventDiv.style.background = ev.color || getGroupColorByName((rows.find(r => r.type==='person' && r.name===name) || {}).group || '');
        setHoriz(eventDiv, ev);
        let evText = ev.title || "(ohne Titel)";
        if (ev.location && ev.location.trim()) evText = `${ev.title || "(ohne Titel)"} @ ${ev.location.trim()}`;
        eventDiv.textContent = evText;
        eventDiv.dataset.eventIndex = state.data.events.indexOf(ev);
        makeDraggable(eventDiv);
        eventDiv.addEventListener('dblclick', () => {
          const idxOpen = parseInt(eventDiv.dataset.eventIndex, 10);
          if (!isNaN(idxOpen)) {
            setTimeout(() => {
              if (typeof window.SMX.modals?.openEvModal === 'function') window.SMX.modals.openEvModal(idxOpen);
            }, 0);
          }
        });
        const leftHandle = document.createElement("div");
        leftHandle.className = "resize-handle left";
        eventDiv.appendChild(leftHandle);
        makeResizable(leftHandle, "left", eventDiv);
        const rightHandle = document.createElement("div");
        rightHandle.className = "resize-handle right";
        eventDiv.appendChild(rightHandle);
        makeResizable(rightHandle, "right", eventDiv);
        rowDiv.appendChild(eventDiv);
      });
    });

    // Render one tall group event spanning group + visible members
    (state.data.events || []).forEach(ev => {
      const attendees = ev.attendees || [];
      attendees.forEach(groupName => {
        const groupDiv = groupRowMap.get(groupName);
        if (!groupDiv) return;
        const personDivs = groupPersonRows.get(groupName) || [];
        const lastDiv = personDivs.length > 0 ? personDivs[personDivs.length - 1] : groupDiv;
        // Compute vertical span: start a few px below group's top label, end above last row's bottom
        const top = groupDiv.offsetTop + 4; // respect row padding
        const height = (lastDiv.offsetTop + lastDiv.offsetHeight) - groupDiv.offsetTop - 12;
        const eventDiv = document.createElement("div");
        eventDiv.className = "event group-span";
        eventDiv.style.background = ev.color || getGroupColorByName(groupName);
        setHoriz(eventDiv, ev);
        eventDiv.style.top = top + "px";
        eventDiv.style.height = height + "px";
        eventDiv.style.bottom = "auto";
        let evText = ev.title || "(ohne Titel)";
        if (ev.location && ev.location.trim()) evText = `${ev.title || "(ohne Titel)"} @ ${ev.location.trim()}`;
        eventDiv.textContent = evText;
        eventDiv.dataset.eventIndex = state.data.events.indexOf(ev);
        makeDraggable(eventDiv);
        eventDiv.addEventListener('dblclick', () => {
          const idxOpen = parseInt(eventDiv.dataset.eventIndex, 10);
          if (!isNaN(idxOpen)) {
            setTimeout(() => {
              if (typeof window.SMX.modals?.openEvModal === 'function') window.SMX.modals.openEvModal(idxOpen);
            }, 0);
          }
        });
        const leftHandle = document.createElement("div");
        leftHandle.className = "resize-handle left";
        eventDiv.appendChild(leftHandle);
        makeResizable(leftHandle, "left", eventDiv);
        const rightHandle = document.createElement("div");
        rightHandle.className = "resize-handle right";
        eventDiv.appendChild(rightHandle);
        makeResizable(rightHandle, "right", eventDiv);
        container.appendChild(eventDiv);
      });
    });

      // Notify listeners that calendar finished rendering
      try { window.dispatchEvent(new CustomEvent('smx:calendar-rendered')); } catch(_) {}
  }

  function nowLeftPx(){
    const ctx = window.SMX.calendar._lastRender;
    if (!ctx) return null;
    const { startMid, numDays } = ctx;
    const now = new Date();
    const rangeStart = new Date(startMid.getTime());
    const rangeEnd = new Date(startMid.getTime() + numDays * 24 * 60 * 60 * 1000);
    if (!(now >= rangeStart && now <= rangeEnd)) return null;
    const hoursSince = (now - startMid) / 36e5;
    return state.labelWidth + hoursSince * state.hourWidth;
  }

  window.SMX.calendar = { loadCalendar, syncAllEventElements, nowLeftPx, _lastRender: null };
})();
