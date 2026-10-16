"use strict";

/*
 * love-calendar — page logic.
 *
 * A shared calendar for two: month grid with hearts and event dots, a day
 * panel with event CRUD, countdowns, a year-at-a-glance heatmap, .ics and
 * JSON export/import. Everything stays on this device.
 */

(function () {
  var STORE = "mena-calendar";

  var START = 1704067200000; // Date.UTC(2024, 0, 1) — symbolic anchor
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var state = {
    events: [],       // {id, date:"YYYY-MM-DD", title, category, note}
    hearts: [],       // ["YYYY-MM-DD"]
    view: null,       // {y, m} (m 1-12)
    selected: null    // "YYYY-MM-DD"
  };

  /* ---------------- date helpers ---------------- */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function fmt(y, m, d) { return y + "-" + pad2(m) + "-" + pad2(d); }

  function parse(str) {
    var p = String(str).split("-");
    return { y: +p[0], m: +p[1], d: +p[2] };
  }

  function now() { return new Date(); }

  function todayStr() {
    var n = now();
    return fmt(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }

  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  // Monday-first weekday index (0 = Monday).
  function dowIndex(y, m, d) { return (new Date(y, m - 1, d).getDay() + 6) % 7; }

  function dayDiff(fromStr, toStr) {
    var a = parse(fromStr), b = parse(toStr);
    var ua = Date.UTC(a.y, a.m - 1, a.d);
    var ub = Date.UTC(b.y, b.m - 1, b.d);
    return Math.round((ub - ua) / 86400000);
  }

  function shiftDate(str, days) {
    var p = parse(str);
    var d = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  function isAutoHeart(str) { return str.slice(5) === "01-01"; }

  function isHeart(str) {
    return isAutoHeart(str) || state.hearts.indexOf(str) >= 0;
  }

  function fmtShort(str) {
    var p = parse(str);
    return p.d + " " + MONTHS[p.m - 1].slice(0, 3) + " " + p.y;
  }

  function fmtFull(str) {
    var p = parse(str);
    var w = DOW[new Date(p.y, p.m - 1, p.d).getDay()];
    return w + ", " + p.d + " " + MONTHS[p.m - 1] + " " + p.y;
  }

  /* ---------------- storage ---------------- */

  function load() {
    state.events = [];
    state.hearts = [];
    var raw = null;
    try { raw = localStorage.getItem(STORE); } catch (e) { raw = null; }
    var s = null;
    if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
    if (s && Array.isArray(s.events)) {
      s.events.forEach(function (ev) {
        if (ev && typeof ev.id === "string" && typeof ev.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && typeof ev.title === "string" && ev.title.trim()) {
          state.events.push({
            id: ev.id,
            date: ev.date,
            title: ev.title.slice(0, 80),
            category: ["date", "trip", "gift", "reminder"].indexOf(ev.category) >= 0 ? ev.category : "date",
            note: typeof ev.note === "string" ? ev.note.slice(0, 140) : ""
          });
        }
      });
    }
    if (s && Array.isArray(s.hearts)) {
      state.hearts = s.hearts.filter(function (h) {
        return typeof h === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h);
      });
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ events: state.events, hearts: state.hearts }));
    } catch (e) { /* ignore */ }
  }

  /* ---------------- small DOM helpers ---------------- */

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function note(msg) { setText("save-note", msg); }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function newId() {
    return "e" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  function eventsOn(dateStr) {
    return state.events
      .filter(function (ev) { return ev.date === dateStr; })
      .sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  }

  function upcomingEvents() {
    var today = todayStr();
    return state.events
      .filter(function (ev) { return ev.date >= today; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a.id < b.id ? -1 : 1;
      });
  }

  function countdownText(dateStr) {
    var d = dayDiff(todayStr(), dateStr);
    if (d === 0) return "today";
    if (d === 1) return "tomorrow";
    if (d < 0) return d === -1 ? "yesterday" : (-d) + " days ago";
    return "in " + d + " days";
  }

  /* ---------------- event CRUD ---------------- */

  function addEvent(data) {
    if (!data || !data.title || !data.date) return null;
    var ev = {
      id: newId(),
      date: data.date,
      title: String(data.title).trim().slice(0, 80),
      category: ["date", "trip", "gift", "reminder"].indexOf(data.category) >= 0 ? data.category : "date",
      note: String(data.note || "").trim().slice(0, 140)
    };
    if (!ev.title) return null;
    state.events.push(ev);
    save();
    return ev;
  }

  function removeEvent(id) {
    var before = state.events.length;
    state.events = state.events.filter(function (ev) { return ev.id !== id; });
    if (state.events.length !== before) { save(); return true; }
    return false;
  }

  function toggleHeart(dateStr) {
    if (!dateStr || isAutoHeart(dateStr)) return false;
    var i = state.hearts.indexOf(dateStr);
    if (i >= 0) state.hearts.splice(i, 1);
    else state.hearts.push(dateStr);
    save();
    return true;
  }

  /* ---------------- rendering: today ---------------- */

  function renderToday() {
    var t = now();
    setText("t-date", t.getDate() + " " + MONTHS[t.getMonth()] + " " + t.getFullYear());
    setText("t-dow", DOW[t.getDay()] + " \u2022 " + todayStr());
    setText("t-days", Math.floor((Date.now() - START) / 86400000));

    var next = upcomingEvents()[0];
    if (next) {
      setText("t-next-title", next.title);
      setText("t-next-days", countdownText(next.date) + " \u2014 " + fmtShort(next.date));
    } else {
      setText("t-next-title", "Nothing planned");
      setText("t-next-days", "add something below \u2665");
    }
  }

  /* ---------------- rendering: month grid ---------------- */

  function renderMonth() {
    var y = state.view.y, m = state.view.m;
    setText("m-title", MONTHS[m - 1] + " " + y);

    var grid = document.getElementById("m-grid");
    if (!grid) return;
    grid.textContent = "";

    var lead = dowIndex(y, m, 1);
    var total = lead + daysInMonth(y, m);
    var cells = Math.ceil(total / 7) * 7;
    var today = todayStr();

    for (var i = 0; i < cells; i += 1) {
      var dayNum = i - lead + 1;
      if (dayNum < 1 || dayNum > daysInMonth(y, m)) {
        var blank = el("div", "day-cell is-blank");
        blank.setAttribute("aria-hidden", "true");
        grid.appendChild(blank);
        continue;
      }
      var dateStr = fmt(y, m, dayNum);
      var cell = el("button", "day-cell");
      cell.type = "button";
      cell.setAttribute("data-date", dateStr);
      if (dateStr === today) cell.className += " is-today";
      if (dateStr === state.selected) cell.className += " is-selected";
      cell.appendChild(el("span")).textContent = String(dayNum);

      if (isHeart(dateStr)) {
        var heart = el("span", "heart-mark");
        heart.textContent = "\u2665";
        cell.appendChild(heart);
      }

      var evs = eventsOn(dateStr);
      if (evs.length) {
        var dots = el("span", "dot-row");
        evs.slice(0, 4).forEach(function (ev) {
          var dot = el("span", "ev-dot cat-" + ev.category);
          dots.appendChild(dot);
        });
        cell.appendChild(dots);
      }
      grid.appendChild(cell);
    }
  }

  /* ---------------- rendering: day panel ---------------- */

  function renderDayPanel() {
    var title = document.getElementById("d-title");
    var box = document.getElementById("d-events");
    var heartBtn = document.getElementById("d-heart");

    if (!state.selected) {
      if (title) title.textContent = "Pick a day";
      if (heartBtn) { heartBtn.setAttribute("aria-pressed", "false"); heartBtn.disabled = true; }
      if (box) {
        box.textContent = "";
        var empty = el("p", "day-empty");
        empty.textContent = "Select a day in the grid to see its plans.";
        box.appendChild(empty);
      }
      return;
    }

    if (title) title.textContent = fmtFull(state.selected);
    if (heartBtn) {
      var pressed = isHeart(state.selected);
      heartBtn.setAttribute("aria-pressed", pressed ? "true" : "false");
      heartBtn.textContent = pressed ? "\u2665" : "\u2661";
      heartBtn.disabled = isAutoHeart(state.selected);
      heartBtn.title = isAutoHeart(state.selected) ? "Since forever \u2665" : "Mark as our day";
    }

    var dateInput = document.getElementById("ev-date");
    if (dateInput) dateInput.value = state.selected;

    if (box) {
      box.textContent = "";
      var evs = eventsOn(state.selected);
      if (!evs.length) {
        var none = el("p", "day-empty");
        none.textContent = "No plans yet \u2014 add one below \u2665";
        box.appendChild(none);
      } else {
        evs.forEach(function (ev) {
          var row = el("div", "event-row");
          var chip = el("span", "chip cat-" + ev.category);
          chip.textContent = ev.category;
          row.appendChild(chip);

          var body = el("div", "event-body");
          var t = el("p", "event-title");
          t.textContent = ev.title;
          body.appendChild(t);
          if (ev.note) {
            var n = el("p", "event-note");
            n.textContent = ev.note;
            body.appendChild(n);
          }
          row.appendChild(body);

          var rm = el("button", "event-remove");
          rm.type = "button";
          rm.textContent = "remove";
          rm.addEventListener("click", function () {
            removeEvent(ev.id);
            renderAll();
            note("Removed \u2715");
          });
          row.appendChild(rm);

          box.appendChild(row);
        });
      }
    }
  }

  /* ---------------- rendering: upcoming ---------------- */

  function renderUpcoming() {
    var list = document.getElementById("upcoming-list");
    if (!list) return;
    list.textContent = "";
    var rows = upcomingEvents().slice(0, 12);
    if (!rows.length) {
      var empty = el("p", "upcoming-empty");
      empty.textContent = "Nothing on the horizon yet \u2014 add something to the calendar \u2665";
      list.appendChild(empty);
      return;
    }
    rows.forEach(function (ev) {
      var row = el("div", "upcoming-row");
      row.setAttribute("data-date", ev.date);

      var date = el("span", "upcoming-date");
      date.textContent = fmtShort(ev.date);
      row.appendChild(date);

      var chip = el("span", "chip cat-" + ev.category);
      chip.textContent = ev.category;
      row.appendChild(chip);

      var title = el("span", "upcoming-title");
      title.textContent = ev.title;
      row.appendChild(title);

      var count = el("span", "upcoming-count" + (ev.date === todayStr() ? " is-today" : ""));
      count.textContent = countdownText(ev.date);
      row.appendChild(count);

      row.addEventListener("click", function () {
        var p = parse(ev.date);
        state.view = { y: p.y, m: p.m };
        selectDay(ev.date);
        var section = document.getElementById("month");
        if (section && section.scrollIntoView) section.scrollIntoView({ block: "start" });
      });

      list.appendChild(row);
    });
  }

  /* ---------------- rendering: year heatmap ---------------- */

  function renderYear() {
    var box = document.getElementById("year-grid");
    if (!box) return;
    box.textContent = "";
    var y = state.view.y;
    var today = todayStr();

    var corner = el("span", "year-head");
    box.appendChild(corner);
    for (var d = 1; d <= 31; d += 1) {
      var head = el("span", "year-head");
      head.textContent = d === 1 || d % 5 === 0 ? String(d) : "";
      box.appendChild(head);
    }

    for (var m = 1; m <= 12; m += 1) {
      var label = el("span", "year-label");
      label.textContent = MONTHS[m - 1].slice(0, 3);
      box.appendChild(label);
      var dim = daysInMonth(y, m);
      for (var day = 1; day <= 31; day += 1) {
        if (day > dim) {
          var pad = el("span", "y-cell is-pad");
          box.appendChild(pad);
          continue;
        }
        var dateStr = fmt(y, m, day);
        var cls = "y-cell";
        if (isHeart(dateStr)) cls += " has-heart";
        else if (eventsOn(dateStr).length) cls += " has-event";
        if (dateStr === today) cls += " is-today";
        var cell = el("span", cls);
        cell.title = fmtShort(dateStr);
        box.appendChild(cell);
      }
    }
  }

  /* ---------------- selection + navigation ---------------- */

  function selectDay(dateStr) {
    state.selected = dateStr;
    renderMonth();
    renderDayPanel();
  }

  function goMonth(delta) {
    var m = state.view.m + delta;
    var y = state.view.y;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    state.view = { y: y, m: m };
    renderMonth();
    renderYear();
  }

  function goToday() {
    var t = now();
    state.view = { y: t.getFullYear(), m: t.getMonth() + 1 };
    selectDay(todayStr());
    renderYear();
  }

  function renderAll() {
    renderToday();
    renderMonth();
    renderDayPanel();
    renderUpcoming();
    renderYear();
  }

  /* ---------------- exports ---------------- */

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    return a;
  }

  function icsEscape(text) {
    return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;")
      .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  function buildIcs() {
    var stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MenaAmmarPro//love-calendar//EN",
      "CALSCALE:GREGORIAN"
    ];
    state.events.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .forEach(function (ev) {
        lines.push("BEGIN:VEVENT");
        lines.push("UID:" + ev.id + "@love-calendar");
        lines.push("DTSTAMP:" + stamp);
        lines.push("DTSTART;VALUE=DATE:" + ev.date.replace(/-/g, ""));
        lines.push("SUMMARY:" + icsEscape(ev.title));
        if (ev.note) lines.push("DESCRIPTION:" + icsEscape(ev.note));
        lines.push("END:VEVENT");
      });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function exportIcs() {
    if (!state.events.length) { note("Nothing to export yet \u2665"); return null; }
    note("Calendar exported \u2665");
    return download("our-days.ics", buildIcs(), "text/calendar;charset=utf-8");
  }

  function backupJson() {
    var text = JSON.stringify({ version: 1, events: state.events, hearts: state.hearts }, null, 2);
    note("Backup saved \u2665");
    return download("our-days-backup.json", text, "application/json");
  }

  function applyBackup(text) {
    var s = null;
    try { s = JSON.parse(text); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.events) || !Array.isArray(s.hearts)) {
      note("That file doesn't look like a backup \u2715");
      return false;
    }
    state.events = [];
    state.hearts = [];
    save();
    loadBackupInto(s);
    save();
    renderAll();
    note("Backup restored \u2665");
    return true;
  }

  function loadBackupInto(s) {
    s.events.forEach(function (ev) {
      if (ev && typeof ev.id === "string" && typeof ev.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && typeof ev.title === "string" && ev.title.trim()) {
        state.events.push({
          id: ev.id,
          date: ev.date,
          title: ev.title.slice(0, 80),
          category: ["date", "trip", "gift", "reminder"].indexOf(ev.category) >= 0 ? ev.category : "date",
          note: typeof ev.note === "string" ? ev.note.slice(0, 140) : ""
        });
      }
    });
    s.hearts.forEach(function (h) {
      if (typeof h === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h)) state.hearts.push(h);
    });
  }

  function clearAll() {
    if (typeof window !== "undefined" && window.confirm &&
        !window.confirm("Clear every event and heart? This cannot be undone.")) return false;
    state.events = [];
    state.hearts = [];
    save();
    renderAll();
    note("The calendar is empty again.");
    return true;
  }

  /* ---------------- wiring ---------------- */

  function wire() {
    var grid = document.getElementById("m-grid");
    if (grid) {
      grid.addEventListener("click", function (ev) {
        var target = ev && ev.target ? ev.target : null;
        while (target && target !== grid && target.getAttribute &&
               !target.getAttribute("data-date")) {
          target = target.parentNode;
        }
        if (!target || target === grid || !target.getAttribute) return;
        var dateStr = target.getAttribute("data-date");
        if (dateStr) selectDay(dateStr);
      });
    }

    var prev = document.getElementById("m-prev");
    if (prev) prev.addEventListener("click", function () { goMonth(-1); });
    var next = document.getElementById("m-next");
    if (next) next.addEventListener("click", function () { goMonth(1); });
    var today = document.getElementById("m-today");
    if (today) today.addEventListener("click", goToday);

    var heartBtn = document.getElementById("d-heart");
    if (heartBtn) heartBtn.addEventListener("click", function () {
      if (toggleHeart(state.selected)) {
        renderMonth();
        renderDayPanel();
        renderYear();
        note(isHeart(state.selected) ? "A day for us \u2665" : "Heart removed \u2715");
      }
    });

    var form = document.getElementById("ev-form");
    if (form) form.addEventListener("submit", function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      var titleEl = document.getElementById("ev-title");
      var dateEl = document.getElementById("ev-date");
      var catEl = document.getElementById("ev-category");
      var noteEl = document.getElementById("ev-note");
      var title = titleEl ? String(titleEl.value || "").trim() : "";
      var date = dateEl ? String(dateEl.value || "").trim() : todayStr();
      if (!title) { note("Give it a name first \u2665"); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = todayStr();

      var ev2 = addEvent({
        title: title,
        date: date,
        category: catEl ? catEl.value : "date",
        note: noteEl ? noteEl.value : ""
      });
      if (!ev2) { note("Something went wrong \u2715"); return; }
      if (titleEl) titleEl.value = "";
      if (noteEl) noteEl.value = "";

      var p = parse(ev2.date);
      if (state.view.y !== p.y || state.view.m !== p.m) state.view = { y: p.y, m: p.m };
      state.selected = ev2.date;
      renderAll();
      note("Added \u2665 " + countdownText(ev2.date));
    });

    var upcoming = document.getElementById("upcoming-list");
    if (upcoming) {
      // rows wire their own click in renderUpcoming; this is a no-op anchor
    }

    var icsBtn = document.getElementById("ics-export");
    if (icsBtn) icsBtn.addEventListener("click", exportIcs);

    var jsonBtn = document.getElementById("json-export");
    if (jsonBtn) jsonBtn.addEventListener("click", backupJson);

    var importInput = document.getElementById("json-import");
    if (importInput) importInput.addEventListener("change", function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { applyBackup(String(reader.result || "")); };
      reader.readAsText(file);
    });

    var clearBtn = document.getElementById("clear-all");
    if (clearBtn) clearBtn.addEventListener("click", clearAll);

    var share = document.getElementById("share-button");
    if (share) share.addEventListener("click", function () {
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { note("Link copied \u2665"); })
          .catch(function () { note(url); });
        return;
      }
      note(url);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    load();
    var t = now();
    state.view = { y: t.getFullYear(), m: t.getMonth() + 1 };
    state.selected = null;
    renderAll();
    wire();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  });
})();
