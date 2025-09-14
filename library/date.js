// Centralized date helpers to avoid timezone pitfalls
(function(){
  window.SMX = window.SMX || {};
  const pad2 = (n) => String(n).padStart(2, '0');

  function ymd(date){
    return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
  }

  function parseYMD(ymdStr){
    // Avoid Date('YYYY-MM-DD') which may parse as UTC; build via parts
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymdStr||'')) return null;
    const [y,m,d] = ymdStr.split('-').map(x=>parseInt(x,10));
    return new Date(y, m-1, d);
    }

  function parseFlexible(s, fallbackYear){
    if (!s) return null; const txt = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return parseYMD(txt);
    const m = txt.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/);
    if (m){
      const dd = parseInt(m[1],10); const mo = parseInt(m[2],10);
      let yy = m[3] ? parseInt(m[3],10) : (fallbackYear || (new Date()).getFullYear());
      if (yy < 100) yy = 2000 + yy;
      return new Date(yy, mo-1, dd);
    }
    return null;
  }

  function toDateInputValue(dateObj){ return ymd(dateObj); }

  function parseTimeStr(t){
    // 'HH:mm' -> {h,m}
    const m = (t||'').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return {h:0, m:0};
    return { h: Math.min(23, parseInt(m[1],10)||0), m: Math.min(59, parseInt(m[2],10)||0) };
  }

  function buildISO(dateYMD, timeHM){
    const d = parseYMD(dateYMD);
    const {h,m} = parseTimeStr(timeHM);
    return `${ymd(d)}T${pad2(h)}:${pad2(m)}`;
  }

  function diffDays(a, b){
    const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((B - A) / 86400000);
  }

  function addDays(date, days){
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  window.SMX.date = { pad2, ymd, parseYMD, parseFlexible, toDateInputValue, parseTimeStr, buildISO, diffDays, addDays };
})();
