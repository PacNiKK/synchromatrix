// Teilnehmer- / Gruppenverwaltung module
(function(){
  window.SMX = window.SMX || {};
  const { state } = window.SMX;
  const { ensureGroupColor } = window.SMX.colors;

  function renderGroupManager(){
    const gm = document.getElementById("gmModalBody");
    if (!gm) return;
    if (!state.data || !Array.isArray(state.data.groups)) { gm.innerHTML = ""; return; }

    const groupNames = () => state.data.groups.map(g => g.name);
    const findGroup = (name) => state.data.groups.find(g => g.name === name);
    const personExists = (name) => state.data.groups.some(g => (g.people||[]).includes(name));
    const groupExists = (name) => {
      if (!name) return false;
      const n = String(name).trim().toLowerCase();
      return groupNames().some(g => g.toLowerCase() === n);
    };

    function ensureUngrouped(){
      let u = findGroup("Ungruppiert");
      if (!u) { u = { name: "Ungruppiert", people: [] }; state.data.groups.push(u); }
      if (!Array.isArray(u.people)) u.people = [];
      return u;
    }

    function addGroup(name){
      const n = (name || "").trim();
      if (!n) { alert("Gruppenname darf nicht leer sein."); return; }
      if (groupExists(n)) { alert("Gruppe existiert bereits."); return; }
      const idx = state.data.groups.length;
      const color = window.SMX.colors.PALETTE[idx % window.SMX.colors.PALETTE.length];
  state.data.groups.push({ name: n, people: [], color });
  state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
      window.SMX.calendar.loadCalendar();
      window.SMX.modals.updateNoAttCount();
      renderGroupManager();
    }

    function deleteGroup(name){
      if (name === "Ungruppiert") { alert("Die Gruppe 'Ungruppiert' kann nicht gelöscht werden."); return; }
      const g = findGroup(name); if (!g) return;
      if (!confirm(`Gruppe "${name}" löschen? Mitglieder werden nach 'Ungruppiert' verschoben.`)) return;
      const fallback = ensureUngrouped();
  (g.people || []).forEach(p => { if (!fallback.people.includes(p)) fallback.people.push(p); });
      (state.data.events || []).forEach(ev => { if (Array.isArray(ev.attendees)) { ev.attendees = ev.attendees.filter(a => a !== name); } });
  state.data.groups = state.data.groups.filter(gr => gr.name !== name);
  state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
      window.SMX.calendar.loadCalendar();
      window.SMX.modals.updateNoAttCount();
      renderGroupManager();
    }

    function addPersonToGroup(name, groupName){
      const n = (name || "").trim();
      if (!n) { alert("Name darf nicht leer sein."); return; }
      if (!groupNames().includes(groupName)) { alert("Gruppe nicht gefunden."); return; }
      if (personExists(n)) { alert("Teilnehmername bereits vorhanden."); return; }
      const g = findGroup(groupName);
      if (!Array.isArray(g.people)) g.people = [];
  g.people.push(n);
  state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
      window.SMX.calendar.loadCalendar();
      window.SMX.modals.updateNoAttCount();
      renderGroupManager();
    }

    function movePerson(name, fromGroup, toGroup){
      if (fromGroup === toGroup) return;
      const src = findGroup(fromGroup); const dst = findGroup(toGroup);
      if (!src || !dst) return;
      src.people = (src.people||[]).filter(p => p !== name);
      if (!Array.isArray(dst.people)) dst.people = [];
  if (dst.people.includes(name)) { alert("Zielgruppe enthält den Namen bereits."); return; }
      dst.people.push(name);
  state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
      window.SMX.calendar.loadCalendar();
      window.SMX.modals.updateNoAttCount();
      renderGroupManager();
    }

    function movePersonAt(name, fromGroup, toGroup, toIndex){
      const src = findGroup(fromGroup); const dst = findGroup(toGroup);
      if (!src || !dst) return;
      const fromIdx = (src.people || []).indexOf(name); if (fromIdx === -1) return;
      src.people.splice(fromIdx, 1);
      if (!Array.isArray(dst.people)) dst.people = [];
      let insertIndex = typeof toIndex === 'number' && !isNaN(toIndex) ? toIndex : dst.people.length;
      if (fromGroup === toGroup) { if (insertIndex > fromIdx) insertIndex--; }
      insertIndex = Math.max(0, Math.min(insertIndex, dst.people.length));
      if (toGroup !== fromGroup && dst.people.includes(name)) { /* skip duplicate */ }
  else { dst.people.splice(insertIndex, 0, name); }
  state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
      window.SMX.calendar.loadCalendar();
      window.SMX.modals.updateNoAttCount();
      renderGroupManager();
    }

    function deletePerson(name){
      state.data.groups.forEach(g => { g.people = (g.people||[]).filter(p => p !== name); });
  (state.data.events||[]).forEach(ev => { if (Array.isArray(ev.attendees)) { ev.attendees = ev.attendees.filter(a => a !== name); } });
  state.dirty = true;
      window.SMX.calendar.loadCalendar();
      renderGroupManager();
    }

    gm.innerHTML = "";
    const addWrap = document.createElement("div"); addWrap.className = "gm-toolbar";

    const gmSearch = document.createElement("div"); gmSearch.className = "gm-search";
    const gmSearchInput = document.createElement("input"); gmSearchInput.type = "text"; gmSearchInput.placeholder = "Suchen (Gruppen/Teilnehmer)"; gmSearchInput.value = state._gmSearchTerm || "";
    gmSearchInput.addEventListener("input", () => { state._gmSearchTerm = (gmSearchInput.value || "").trim().toLowerCase(); renderList(); });
    const gmCollapseAll = document.createElement("button"); gmCollapseAll.textContent = "Alle einklappen";
    gmCollapseAll.addEventListener("click", () => { state.gmCollapsed = new Set(state.data.groups.map(g => g.name)); renderList(); });
    const gmExpandAll = document.createElement("button"); gmExpandAll.textContent = "Alle ausklappen";
    gmExpandAll.addEventListener("click", () => { state.gmCollapsed = new Set(); renderList(); });
    gmSearch.appendChild(gmSearchInput); gmSearch.appendChild(gmCollapseAll); gmSearch.appendChild(gmExpandAll);
    addWrap.appendChild(gmSearch);

    const groupSelect = document.createElement("select"); groupSelect.id = "gmAddGroup";
    groupNames().forEach(n => { const opt = document.createElement("option"); opt.value = opt.textContent = n; groupSelect.appendChild(opt); });

    const nameInput = document.createElement("input"); nameInput.type = "text"; nameInput.placeholder = "Name des Teilnehmers"; nameInput.id = "gmAddName";
    const addBtn = document.createElement("button"); addBtn.textContent = "Hinzufügen"; addBtn.addEventListener("click", () => addPersonToGroup(nameInput.value, groupSelect.value));
    const rowAddPerson = document.createElement("div"); rowAddPerson.className = "row";
    const secTitle1 = document.createElement("span"); secTitle1.className = "section-title"; secTitle1.textContent = "Teilnehmer hinzufügen";
    rowAddPerson.appendChild(secTitle1); rowAddPerson.appendChild(nameInput); rowAddPerson.appendChild(groupSelect); rowAddPerson.appendChild(addBtn);
    addWrap.appendChild(rowAddPerson);

    const gNameInput = document.createElement("input"); gNameInput.type = "text"; gNameInput.placeholder = "Gruppenname"; gNameInput.id = "gmGroupName";
    const gAddBtn = document.createElement("button"); gAddBtn.textContent = "Gruppe hinzufügen"; gAddBtn.addEventListener("click", () => addGroup(gNameInput.value));
    const rowAddGroup = document.createElement("div"); rowAddGroup.className = "row";
    const secTitle2 = document.createElement("span"); secTitle2.className = "section-title"; secTitle2.textContent = "Gruppe hinzufügen";
    rowAddGroup.appendChild(secTitle2); rowAddGroup.appendChild(gNameInput); rowAddGroup.appendChild(gAddBtn);
    addWrap.appendChild(rowAddGroup);
    gm.appendChild(addWrap);

    function renderList(){
      let listWrap = document.getElementById("gmListWrap");
      if (!listWrap) { listWrap = document.createElement("div"); listWrap.id = "gmListWrap"; listWrap.style.marginTop = "10px"; gm.appendChild(listWrap); }
      listWrap.innerHTML = "";

      state.data.groups.forEach(g => {
        if ((g.name === 'Ungruppiert') && (!g.people || g.people.length === 0)) return;
        const term = (state._gmSearchTerm || "").toLowerCase();
        const peopleList = (g.people || []);
        const peopleFiltered = term ? peopleList.filter(p => p.toLowerCase().includes(term)) : peopleList;
        const groupMatches = !term || g.name.toLowerCase().includes(term) || peopleFiltered.length > 0;
        if (!groupMatches) return;
        const section = document.createElement("div"); section.className = "gm-card";
        try { section.style.borderColor = ensureGroupColor(g); } catch(e) {}

        const header = document.createElement("div"); header.className = "gm-head"; header.style.fontWeight = "bold";
        const title = document.createElement("div"); title.className = "gm-title";
        const isCollapsed = state.gmCollapsed.has(g.name);
        title.textContent = (isCollapsed ? "> " : "v ") + `${g.name} (${(g.people||[]).length})`;
        title.addEventListener('click', () => {
          if (state.gmCollapsed.has(g.name)) state.gmCollapsed.delete(g.name); else state.gmCollapsed.add(g.name);
          renderList();
        });
        header.appendChild(title);
        header.style.display = "flex"; header.style.alignItems = "center"; header.style.justifyContent = "space-between";
        const hActions = document.createElement("div");
        const colorInput = document.createElement("input"); colorInput.type = "color"; colorInput.value = ensureGroupColor(g); colorInput.title = "Gruppenfarbe";
  colorInput.addEventListener("input", () => { g.color = colorInput.value; state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {} window.SMX.calendar.loadCalendar(); renderList(); });
        title.appendChild(colorInput);
        const renameBtn = document.createElement("button"); renameBtn.textContent = "Umbenennen";
        renameBtn.addEventListener("click", () => {
          const oldName = g.name;
          const input = prompt("Neuer Gruppenname:", oldName);
          if (input == null) return;
          const newName = String(input).trim();
          if (!newName || newName === oldName) return;
          if ((state.data.groups || []).some(gr => gr !== g && (gr.name||"").toLowerCase() === newName.toLowerCase())) { alert("Gruppe existiert bereits."); return; }
          g.name = newName;
          (state.data.events || []).forEach(ev => { if (Array.isArray(ev.attendees)) { ev.attendees = ev.attendees.map(a => a === oldName ? newName : a); } });
          if (state.gmCollapsed && state.gmCollapsed.has(oldName)) { state.gmCollapsed.delete(oldName); state.gmCollapsed.add(newName); }
          if (state.collapsedGroups && state.collapsedGroups.has(oldName)) { state.collapsedGroups.delete(oldName); state.collapsedGroups.add(newName); }
          const gs = document.getElementById("gmAddGroup");
          if (gs) {
            const prev = gs.value; gs.innerHTML = ""; (state.data.groups || []).forEach(gr => { const opt = document.createElement("option"); opt.value = opt.textContent = gr.name; gs.appendChild(opt); });
            gs.value = (prev === oldName) ? newName : prev;
          }
          state.dirty = true; try { window.dispatchEvent(new CustomEvent('smx:dirty-changed')); } catch(_) {}
          window.SMX.calendar.loadCalendar(); renderList();
        });
        hActions.appendChild(renameBtn);
        if (g.name !== "Ungruppiert") {
          const delGroupBtn = document.createElement("button"); delGroupBtn.textContent = "Gruppe löschen"; delGroupBtn.addEventListener("click", () => deleteGroup(g.name));
          hActions.appendChild(delGroupBtn);
        }
        header.appendChild(hActions);

        section.dataset.group = g.name;
        section.addEventListener('dragover', (e) => { e.preventDefault(); try { if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; } catch(_){} section.classList.add('gm-drop'); });
        section.addEventListener('dragleave', () => section.classList.remove('gm-drop'));
        section.addEventListener('drop', (e) => {
          e.stopPropagation(); section.classList.remove('gm-drop');
          let obj = null; try { const txt = e.dataTransfer?.getData('text/plain') || ''; obj = JSON.parse(txt || '{}'); } catch(_){}
          if (!obj || obj.type !== 'gm/person') { obj = (window.__gmDragPayload || null); }
          if (!obj || obj.type !== 'gm/person') return;
          const { person, from } = obj; if (!person || !from) return;
          const dest = findGroup(g.name);
          const toIndex = (dest && Array.isArray(dest.people)) ? dest.people.length : 0;
          movePersonAt(person, from, g.name, toIndex);
          try { window.__gmDragPayload = null; } catch(_){}
        });

        section.appendChild(header);

        if (!state.gmCollapsed.has(g.name)) {
          ( (state._gmSearchTerm ? (g.people||[]).filter(p => p.toLowerCase().includes((state._gmSearchTerm||"").toLowerCase())) : (g.people||[])) ).forEach(p => {
            const row = document.createElement("div"); row.className = "gm-chip"; row.style.display = "flex"; row.style.alignItems = "center"; row.style.gap = "8px"; row.style.padding = "2px 0";
            row.setAttribute('draggable','true'); row.dataset.person = p; row.dataset.group = g.name;
            row.addEventListener('dragstart', (e) => {
              row.classList.add('dragging');
              const payload = { type:'gm/person', person:p, from:g.name };
              try { if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', JSON.stringify(payload)); } } catch(_){}
              try { window.__gmDragPayload = payload; } catch(_){}
            });
            row.addEventListener('dragend', () => { row.classList.remove('dragging'); row.classList.remove('drag-over-top'); row.classList.remove('drag-over-bottom'); });
            row.addEventListener('dragover', (e) => { e.preventDefault(); try { if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; } catch(_){} const r = row.getBoundingClientRect(); const before = (e.clientY - r.top) < (r.height / 2); row.classList.toggle('drag-over-top', before); row.classList.toggle('drag-over-bottom', !before); });
            row.addEventListener('dragleave', () => { row.classList.remove('drag-over-top'); row.classList.remove('drag-over-bottom'); });
            row.addEventListener('drop', (e) => {
              e.stopPropagation(); row.classList.remove('drag-over-top'); row.classList.remove('drag-over-bottom');
              let obj=null; try { const txt = e.dataTransfer?.getData('text/plain')||''; obj=JSON.parse(txt||'{}'); } catch(_){}
              if (!obj || obj.type !== 'gm/person') { obj = (window.__gmDragPayload || null); }
              if (!obj || obj.type !== 'gm/person') return;
              const { person, from } = obj; if (!person || !from) return;
              const peopleArr = (findGroup(g.name)?.people || []);
              const targetIdx = peopleArr.indexOf(p);
              if (targetIdx < 0) { movePersonAt(person, from, g.name); return; }
              const r = row.getBoundingClientRect(); const before = (e.clientY - r.top) < (r.height / 2);
              const insertAt = before ? targetIdx : (targetIdx + 1);
              movePersonAt(person, from, g.name, insertAt);
              try { window.__gmDragPayload = null; } catch(_){}
            });

            const name = document.createElement("span"); name.textContent = p; name.style.minWidth = "160px"; name.className = "gm-chip-name";
            const moveSel = document.createElement("select");
            groupNames().forEach(n => { const opt = document.createElement("option"); opt.value = opt.textContent = n; if (n === g.name) opt.selected = true; moveSel.appendChild(opt); });
            moveSel.addEventListener("change", () => movePerson(p, g.name, moveSel.value));
            const delBtn = document.createElement("button"); delBtn.className = "gm-del"; delBtn.textContent = "✕";
            delBtn.addEventListener("click", () => { if (confirm(`"${p}" wirklich löschen?`)) deletePerson(p); });

            row.appendChild(name);
            const actions = document.createElement("span"); actions.className = "gm-chip-actions"; actions.appendChild(moveSel); actions.appendChild(delBtn); row.appendChild(actions);
            section.appendChild(row);
          });
        }

        listWrap.appendChild(section);
      });
    }

    renderList();
  }

  window.SMX.groupManager = { renderGroupManager };
})();
