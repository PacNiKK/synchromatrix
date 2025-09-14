// Modals: Admin, Event Editor, No-Attendees
(function(){
  window.SMX = window.SMX || {};
  const { state } = window.SMX;
  const { pad2, ymd, parseYMD, parseFlexible, buildISO } = window.SMX.date;
  const { ensureGroupColor, getGroupColorByName } = window.SMX.colors;

  function updateNoAttCount(){
    const btn = document.getElementById("noAttBtn"); if (!btn || !state.data) return;
    const cnt = (state.data.events || []).filter(ev => !(Array.isArray(ev.attendees) && ev.attendees.length > 0)).length;
    // Keep the icon; only update accessible labels and tooltip
    btn.title = `Termine ohne Teilnehmer (${cnt})`;
    btn.setAttribute('aria-label', `Termine ohne Teilnehmer (${cnt})`);
  }

  function renderAdmin(){
    const body = document.getElementById('adminModalBody'); if (!body) return; body.innerHTML = '';
    const wrap = document.createElement('div'); wrap.style.display='grid'; wrap.style.gridTemplateColumns='1fr 1fr'; wrap.style.gap='10px';
    const sd = state.data?.startDate ? parseYMD(state.data.startDate) : new Date();
    const ed = state.data?.endDate ? parseYMD(state.data.endDate) : new Date();
    const sLabel = document.createElement('label'); sLabel.textContent = 'Startdatum';
    const sInput = document.createElement('input'); sInput.type = 'date'; sInput.value = ymd(sd); sInput.style.width='100%';
    const eLabel = document.createElement('label'); eLabel.textContent = 'Enddatum';
    const eInput = document.createElement('input'); eInput.type = 'date'; eInput.value = ymd(ed); eInput.style.width='100%';
    const freeTxt = document.createElement('input'); freeTxt.type='text'; freeTxt.placeholder='Freitext: z.B. 8.9-20.9 oder 2025-09-08 bis 2025-09-20'; freeTxt.style.gridColumn='1 / span 2';
    // Preferences: Show current time line
    const nowLineWrap = document.createElement('label'); nowLineWrap.style.gridColumn = '1 / span 2';
    const nowLineChk = document.createElement('input'); nowLineChk.type = 'checkbox'; nowLineChk.checked = !!state.showNowLine;
    nowLineWrap.appendChild(nowLineChk); nowLineWrap.appendChild(document.createTextNode(' Aktuelle Zeit anzeigen'));

    // Preferences: Snap minutes
    const snapLbl = document.createElement('label'); snapLbl.textContent = 'Raster (Minuten)';
    const snapInput = document.createElement('input'); snapInput.type = 'number'; snapInput.min = '1'; snapInput.step = '1'; snapInput.value = String(Math.max(1, parseInt(state.snapMinutes,10)||30));

    const actions = document.createElement('div'); actions.style.gridColumn='1 / span 2'; actions.style.display='flex'; actions.style.gap='8px'; actions.style.justifyContent='flex-end';
    const cancel = document.createElement('button'); cancel.textContent='Abbrechen';
    const apply = document.createElement('button'); apply.textContent='Anwenden';
    actions.appendChild(cancel); actions.appendChild(apply);
    wrap.appendChild(sLabel); wrap.appendChild(eLabel); wrap.appendChild(sInput); wrap.appendChild(eInput); wrap.appendChild(freeTxt);
    wrap.appendChild(nowLineWrap);
    wrap.appendChild(snapLbl); wrap.appendChild(snapInput);
    wrap.appendChild(actions);
    body.appendChild(wrap);
    cancel.addEventListener('click', (e)=>{ e.preventDefault(); closeAdmin(); });
    apply.addEventListener('click', (e)=>{
      e.preventDefault();
      const today = new Date();
      let s = sInput.value ? parseYMD(sInput.value) : null;
      let eD = eInput.value ? parseYMD(eInput.value) : null;
      const txt = (freeTxt.value||'').trim();
      if (txt){ const parts = txt.split(/\s*(?:-|–|bis|to)\s*/i); if (parts.length === 2){ const p1 = parseFlexible(parts[0], today.getFullYear()); const p2 = parseFlexible(parts[1], today.getFullYear()); if (p1) s = p1; if (p2) eD = p2; } }
      if (!s || !eD) { alert('Bitte Start- und Enddatum angeben.'); return; }
      if (eD < s) { const tmp = s; s = eD; eD = tmp; }
  state.data.startDate = ymd(s); state.data.endDate = ymd(eD); state.data.date = ymd(s);
  state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
      // Apply preferences (do not mark data dirty, as they are not saved to file)
  state.showNowLine = !!nowLineChk.checked;
      const newSnap = parseInt(snapInput.value, 10);
      if (Number.isFinite(newSnap) && newSnap > 0) { state.snapMinutes = newSnap; }
  try { if (window.SMX?.prefs) window.SMX.prefs.save(); } catch(_) {}
      window.SMX.calendar.loadCalendar(); closeAdmin();
    });
  }
  function openAdmin(){ if (!state.data) return; renderAdmin(); const m = document.getElementById('adminModal'); if (m){ m.classList.add('open'); m.setAttribute('aria-hidden','false'); } }
  function closeAdmin(){ const m = document.getElementById('adminModal'); if (m){ m.classList.remove('open'); m.setAttribute('aria-hidden','true'); } }

  function renderNoAttList(){
    const naBody = document.getElementById('naModalBody'); if (!naBody) return; naBody.innerHTML = "";
    const list = document.createElement("div"); list.className = "na-list";
    const hTitle = document.createElement("div"); hTitle.className = "na-head"; hTitle.textContent = "Titel";
    const hStart = document.createElement("div"); hStart.className = "na-head"; hStart.textContent = "Start";
    const hEnd = document.createElement("div"); hEnd.className = "na-head"; hEnd.textContent = "Ende";
    const hAct = document.createElement("div"); hAct.className = "na-head"; hAct.textContent = "Aktionen";
    list.appendChild(hTitle); list.appendChild(hStart); list.appendChild(hEnd); list.appendChild(hAct);
    let count = 0;
    (state.data?.events || []).forEach((ev, idx) => {
      const atts = ev.attendees; if (Array.isArray(atts) && atts.length > 0) return;
      const row = document.createElement("div"); row.className = "na-row";
      const t = document.createElement("div"); const pill = document.createElement("span"); pill.className = "na-pill"; pill.style.background = ev.color || "#9e9e9e"; t.appendChild(pill); t.appendChild(document.createTextNode((ev.title||"(ohne Titel)")));
      const s = document.createElement("div"); s.textContent = ev.start || "";
      const e = document.createElement("div"); e.textContent = ev.end || "";
      const acts = document.createElement("div");
      const edit = document.createElement("button"); edit.textContent = "Bearbeiten"; edit.addEventListener("click", () => { closeNaModal(); openEvModal(idx); });
  const del = document.createElement("button"); del.textContent = "Löschen"; del.addEventListener("click", () => { if (confirm("Termin wirklich löschen?")) { state.data.events.splice(idx,1); state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {} window.SMX.calendar.loadCalendar(); renderNoAttList(); updateNoAttCount(); }});
      acts.appendChild(edit); acts.appendChild(del);
      list.appendChild(t); list.appendChild(s); list.appendChild(e); list.appendChild(acts);
      count++;
    });
    if (count === 0) { const empty = document.createElement("div"); empty.style.gridColumn = "1 / -1"; empty.style.color = "#666"; empty.textContent = "Keine Termine ohne Teilnehmer gefunden."; list.appendChild(empty); }
    naBody.appendChild(list);
  }
  function openNaModal(){ renderNoAttList(); const m = document.getElementById('naModal'); if (m){ m.classList.add('open'); m.setAttribute('aria-hidden','false'); } }
  function closeNaModal(){ const m = document.getElementById('naModal'); if (m){ m.classList.remove('open'); m.setAttribute('aria-hidden','true'); } }

  function renderEventEditor(eventIndex){
    const evBody = document.getElementById("evModalBody"); if (!evBody) return;
    const isNew = eventIndex === -1;
    const ev = isNew ? { title: "", start: "", end: "", color: "", attendees: [], notes: "", location: "" } : { ...state.data.events[eventIndex] };
    const todayStr = ymd(new Date());
    const baseDate = (ev.start && ev.start.includes('T')) ? ev.start.split('T')[0] : (state.data?.date || todayStr);
    const startVal = ev.start && ev.start.includes('T') ? ev.start.split('T')[1] : "09:00";
    const endVal = ev.end && ev.end.includes('T') ? ev.end.split('T')[1] : "10:00";
    const startDateVal = ev.start && ev.start.includes('T') ? ev.start.split('T')[0] : baseDate;
    const endDateVal = ev.end && ev.end.includes('T') ? ev.end.split('T')[0] : startDateVal;

    evBody.innerHTML = "";
    const form = document.createElement("div"); form.style.display = "grid"; form.style.gridTemplateColumns = "1fr 1fr"; form.style.gap = "10px";
    const titleInput = document.createElement("input"); titleInput.type = "text"; titleInput.placeholder = "Titel"; titleInput.value = ev.title || ""; titleInput.style.gridColumn = "1 / span 2"; form.appendChild(titleInput);
    const locationInput = document.createElement("input"); locationInput.type = "text"; locationInput.placeholder = "Ort"; locationInput.value = ev.location || ""; locationInput.style.gridColumn = "1 / span 2"; form.appendChild(locationInput);
    const dtWrap = document.createElement("div"); dtWrap.className = "ev-dt";
    const startBlock = document.createElement("div"); startBlock.className = "ev-block"; const startHead = document.createElement("div"); startHead.className = "ev-head"; startHead.textContent = "Beginn"; const startDate = document.createElement("input"); startDate.type = "date"; startDate.value = startDateVal; const startTime = document.createElement("input"); startTime.type = "time"; startTime.value = startVal; startBlock.appendChild(startHead); startBlock.appendChild(startDate); startBlock.appendChild(startTime); dtWrap.appendChild(startBlock);
    const endBlock = document.createElement("div"); endBlock.className = "ev-block"; const endHead = document.createElement("div"); endHead.className = "ev-head"; endHead.textContent = "Ende"; const endDate = document.createElement("input"); endDate.type = "date"; endDate.value = endDateVal; const endTime = document.createElement("input"); endTime.type = "time"; endTime.value = endVal; endBlock.appendChild(endHead); endBlock.appendChild(endDate); endBlock.appendChild(endTime); dtWrap.appendChild(endBlock); form.appendChild(dtWrap);
    const notes = document.createElement("textarea"); notes.placeholder = "Notizen"; notes.value = ev.notes || ""; notes.style.gridColumn = "1 / span 2"; notes.rows = 3; form.appendChild(notes);
    let userChangedColor = false; const colorWrap = document.createElement("div"); const colorLbl = document.createElement("label"); colorLbl.textContent = "Farbe"; const colorInput = document.createElement("input"); colorInput.type = "color";
    let initialColor = ev.color || "#4caf50"; (state.data.groups||[]).some(g => { if ((ev.attendees||[]).includes(g.name) && !ev.color) { initialColor = ensureGroupColor(g); return true; } return false; });
    colorInput.value = initialColor; colorInput.addEventListener("input", () => { userChangedColor = true; }); colorWrap.appendChild(colorLbl); colorWrap.appendChild(colorInput); form.appendChild(colorWrap);

    const groupsBox = document.createElement("div"); groupsBox.style.gridColumn = "1 / span 2"; const groupsTitle = document.createElement("div"); groupsTitle.textContent = "Gruppen"; groupsTitle.style.fontWeight = "bold"; groupsBox.appendChild(groupsTitle);
    const groupsWrap = document.createElement("div"); groupsWrap.style.display = "flex"; groupsWrap.style.flexWrap = "wrap"; groupsWrap.style.gap = "10px";
    state.data.groups.forEach((g, i) => { const wrap = document.createElement("label"); wrap.style.display = "inline-flex"; wrap.style.alignItems = "center"; wrap.style.gap = "6px"; const chk = document.createElement("input"); chk.type = "checkbox"; chk.value = g.name; chk.checked = (ev.attendees||[]).includes(g.name); const swatch = document.createElement("span"); swatch.style.display = "inline-block"; swatch.style.width = "10px"; swatch.style.height = "10px"; swatch.style.border = "1px solid #ccc"; swatch.style.background = ensureGroupColor(g, i); const txt = document.createElement("span"); txt.textContent = g.name; wrap.appendChild(chk); wrap.appendChild(swatch); wrap.appendChild(txt); groupsWrap.appendChild(wrap); });
    function syncColorFromSelection(){ if (userChangedColor) return; const firstChecked = Array.from(groupsWrap.querySelectorAll('input[type="checkbox"]')).find(c => c.checked); if (firstChecked) { colorInput.value = getGroupColorByName(firstChecked.value); } }
    groupsWrap.addEventListener('change', syncColorFromSelection); groupsBox.appendChild(groupsWrap); form.appendChild(groupsBox);


    const peopleBox = document.createElement("div"); peopleBox.style.gridColumn = "1 / span 2"; const peopleTitle = document.createElement("div"); peopleTitle.textContent = "Teilnehmer"; peopleTitle.style.fontWeight = "bold"; peopleBox.appendChild(peopleTitle);
    state.data.groups.forEach((g) => { const gHead = document.createElement("div"); gHead.textContent = g.name; gHead.style.marginTop = "6px"; gHead.style.fontSize = "12px"; gHead.style.color = "#555"; peopleBox.appendChild(gHead); const pWrap = document.createElement("div"); pWrap.style.display = "flex"; pWrap.style.flexWrap = "wrap"; pWrap.style.gap = "10px"; (g.people||[]).forEach((p) => { const wrap = document.createElement("label"); wrap.style.display = "inline-flex"; wrap.style.alignItems = "center"; wrap.style.gap = "6px"; const chk = document.createElement("input"); chk.type = "checkbox"; chk.value = p; chk.checked = (ev.attendees||[]).includes(p); const bullet = document.createElement("span"); bullet.textContent = "\u2022"; bullet.style.color = ensureGroupColor(g); const txt = document.createElement("span"); txt.textContent = p; wrap.appendChild(chk); wrap.appendChild(bullet); wrap.appendChild(txt); pWrap.appendChild(wrap); }); peopleBox.appendChild(pWrap); });
    form.appendChild(peopleBox);

    const actions = document.createElement("div"); actions.style.gridColumn = "1 / span 2"; actions.style.display = "flex"; actions.style.gap = "8px"; actions.style.justifyContent = "flex-end";
    const saveBtn = document.createElement("button"); saveBtn.textContent = isNew ? "Erstellen" : "Speichern";
    const cancelBtn = document.createElement("button"); cancelBtn.textContent = "Abbrechen";
    const delBtn = !isNew ? document.createElement("button") : null; if (delBtn) { delBtn.textContent = "Löschen"; delBtn.style.marginRight = "auto"; actions.appendChild(delBtn); }
    actions.appendChild(cancelBtn); actions.appendChild(saveBtn); form.appendChild(actions);
  if (delBtn) delBtn.addEventListener("click", () => { if (confirm("Termin wirklich löschen?")) { state.data.events.splice(eventIndex, 1); state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {} window.SMX.calendar.loadCalendar(); updateNoAttCount(); closeEvModal(); } });
    cancelBtn.addEventListener("click", (e) => { e.preventDefault(); closeEvModal(); });
    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const sd = startDate.value; const ed = endDate.value; const st = startTime.value; const et = endTime.value;
      if (!sd || !st || !ed || !et) { alert("Bitte Start- und Enddatum/-zeit angeben."); return; }
      const startIso = buildISO(sd, st); const endIso = buildISO(ed, et);
      if (new Date(startIso) >= new Date(endIso)) { alert("Ende muss nach dem Start liegen."); return; }
      const sels = [];
      groupsWrap.querySelectorAll('input[type="checkbox"]').forEach(chk => { if (chk.checked) sels.push(chk.value); });
      peopleBox.querySelectorAll('input[type="checkbox"]').forEach(chk => { if (chk.checked) sels.push(chk.value); });
      const color = colorInput.value || "#4caf50";
      const newEv = { title: (titleInput.value||"").trim() || "(ohne Titel)", start: startIso, end: endIso, color, attendees: sels, notes: (notes.value||""), location: (locationInput.value||"").trim() };
  if (isNew) state.data.events.push(newEv); else state.data.events[eventIndex] = newEv;
  state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
      window.SMX.calendar.loadCalendar(); updateNoAttCount(); closeEvModal();
    });
    evBody.appendChild(form);
  }
  function openEvModal(eventIndex = -1){ renderEventEditor(eventIndex); const m = document.getElementById('evModal'); if (m){ m.classList.add('open'); m.setAttribute('aria-hidden','false'); } }
  function closeEvModal(){ const m = document.getElementById('evModal'); if (m){ m.classList.remove('open'); m.setAttribute('aria-hidden','true'); } const na = document.getElementById('naModal'); if (na && na.classList.contains('open')) renderNoAttList(); updateNoAttCount(); }

  window.SMX.modals = { updateNoAttCount, renderAdmin, openAdmin, closeAdmin, renderNoAttList, openNaModal, closeNaModal, renderEventEditor, openEvModal, closeEvModal };
})();
