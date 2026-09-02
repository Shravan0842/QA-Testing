/* ============================================================
   QA Tester Academy - Shared JavaScript
   Sidebar, accordion, tabs, flashcards, quiz engine,
   progress tracking (localStorage), bug-hunting playground
   ============================================================ */

(function () {
  "use strict";

  const STORE_KEY = "qat_progress_v1";

  /* ---------- Sidebar (mobile) ---------- */
  const menuBtn = document.querySelector(".menu-btn");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");

  function openSidebar() {
    if (sidebar) sidebar.classList.add("open");
    if (overlay) overlay.classList.add("show");
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
  }
  if (menuBtn) menuBtn.addEventListener("click", openSidebar);
  if (overlay) overlay.addEventListener("click", closeSidebar);

  /* ---------- Theme toggle (dark / light) ---------- */
  const themeBtn = document.getElementById("themeToggle");
  function syncThemeButton() {
    if (!themeBtn) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    themeBtn.querySelector(".ico").textContent = dark ? "☀️" : "🌙";
    themeBtn.querySelector(".label").textContent = dark ? "Light" : "Dark";
    themeBtn.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }
  syncThemeButton();
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("qat_theme_v1", next); } catch (e) {}
      syncThemeButton();
    });
  }

  // Highlight the active sidebar link.
  // For pages that use hash-anchors (docs.html, practice.html), the hash
  // selects a specific topic/tab and that link should be the one marked
  // active, not the generic "page-level" link above it.
  function updateActiveNav() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    const hash = window.location.hash.replace("#", "");
    const links = document.querySelectorAll(".sidebar-nav a");

    // Clear all active states first
    links.forEach((a) => a.classList.remove("active"));

    // Find a link whose href matches "<path>#<hash>" if a hash is present,
    // otherwise the link whose href equals the current path exactly.
    let active = null;
    if (hash) {
      active =
        Array.from(links).find((a) => a.getAttribute("href") === path + "#" + hash) ||
        null;
    }
    if (!active) {
      active =
        Array.from(links).find((a) => a.getAttribute("href") === path) ||
        null;
    }
    if (active) active.classList.add("active");

    // On docs.html, also reflect the active topic in the topbar title & breadcrumb.
    // (practice.html already has a single static "Practice & Interview Prep" title
    // that works for any tab, so we leave it alone.)
    if (path === "docs.html") {
      const titleEl = document.querySelector(".topbar .page-title");
      const crumbEl = document.querySelector(".topbar .page-crumb");
      if (titleEl && crumbEl) {
        if (active && hash && active.getAttribute("href") !== "docs.html") {
          // Pull the link label from text nodes only — ignore the <span class="ico">.
          const topic = Array.from(active.childNodes)
            .filter((n) => n.nodeType === 3) // Node.TEXT_NODE
            .map((n) => n.textContent.trim())
            .filter(Boolean)
            .join(" ");
          titleEl.textContent = "📘 " + topic;
          crumbEl.textContent = "Home / Learn / " + topic;
        } else {
          titleEl.textContent = "📘 Docs — All Concepts";
          crumbEl.textContent = "Home / Learn / Concepts";
        }
      }
    }
  }
  updateActiveNav();
  window.addEventListener("hashchange", updateActiveNav);

  /* ---------- Deep-link to a practice tab via URL hash (e.g. practice.html#flashcards) ---------- */
  function activateTabFromHash() {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const tab = document.querySelector('.tab[data-panel="' + hash + '"]');
    if (tab) tab.click();
  }
  activateTabFromHash();
  window.addEventListener("hashchange", activateTabFromHash);

  /* ---------- Accordion ---------- */
  document.addEventListener("click", (e) => {
    const head = e.target.closest(".acc-head");
    if (head) {
      const acc = head.parentElement;
      acc.classList.toggle("open");
    }
  });

  /* ---------- Tabs ---------- */
  document.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    const wrap = tab.closest("[data-tabs]") || tab.parentElement.parentElement;
    const panelId = tab.getAttribute("data-panel");
    wrap.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    wrap.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    const target = document.getElementById(panelId);
    if (target) target.classList.add("active");
  });

  /* ---------- Flashcards ---------- */
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".flashcard");
    if (card) card.classList.toggle("flip");
  });

  /* ---------- Progress tracking helpers ---------- */
  function getStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (err) {
      return {};
    }
  }
  function setStore(key, value) {
    const store = getStore();
    store[key] = value;
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }
  function getStoreVal(key, def) {
    const store = getStore();
    return store[key] !== undefined ? store[key] : def;
  }

  /* ---------- Docs "mark as read" checkboxes ---------- */
  document.querySelectorAll("[data-docmark]").forEach((cb) => {
    const key = cb.dataset.docmark;
    cb.checked = getStoreVal(key, false);
    cb.addEventListener("change", () => {
      setStore(key, cb.checked);
      updateDocProgress();
    });
  });

  function updateDocProgress() {
    const boxes = document.querySelectorAll("[data-docmark]");
    if (!boxes.length) return;
    const done = Array.from(boxes).filter((b) => b.checked).length;
    const bar = document.getElementById("docProgressBar");
    const lbl = document.getElementById("docProgressLabel");
    if (bar) {
      const pct = Math.round((done / boxes.length) * 100);
      bar.style.width = pct + "%";
      if (lbl) lbl.textContent = done + " / " + boxes.length + " topics read (" + pct + "%)";
    }
  }
  updateDocProgress();

  /* ---------- Quiz engine ---------- */
  // Expected markup: .quiz > .quiz-q[data-answer="A"] with .opt[data-opt="A"] etc.
  // A <button class="btn check-quiz">Check</button> inside or next to quiz,
  // and a result element #quizResult within the same [data-quiz] wrapper.

  function scoreQuiz(quizRoot) {
    let correct = 0;
    const total = quizRoot.querySelectorAll(".quiz-q").length;
    quizRoot.querySelectorAll(".quiz-q").forEach((q) => {
      const answer = q.dataset.answer;
      const chosen = q.querySelector(".opt.selected");
      q.querySelectorAll(".opt").forEach((o) => {
        o.classList.remove("correct", "wrong");
        if (o.dataset.opt === answer) o.classList.add("correct");
      });
      if (chosen && chosen.dataset.opt === answer) correct++;
      else if (chosen) chosen.classList.add("wrong");
      const ex = q.querySelector(".explain");
      if (ex) ex.classList.add("show");
    });
    return { correct, total };
  }

  document.addEventListener("click", (e) => {
    // Option selection (radio-like)
    if (e.target.classList.contains("opt")) {
      const q = e.target.closest(".quiz-q");
      // Lock selection if already checked
      if (q.classList.contains("locked")) return;
      q.querySelectorAll(".opt").forEach((o) => o.classList.remove("selected"));
      e.target.classList.add("selected");
    }
    // Check quiz
    if (e.target.classList.contains("check-quiz")) {
      const quizRoot = e.target.closest("[data-quiz]") || e.target.closest(".quiz");
      if (!quizRoot) return;
      const { correct, total } = scoreQuiz(quizRoot);
      const res = quizRoot.querySelector(".quiz-result");
      if (res) {
        const pass = correct / total >= 0.7;
        res.innerHTML =
          "<strong>" + correct + " / " + total + " correct</strong> (" +
          Math.round((correct / total) * 100) + "%) — " +
          (pass ? "✅ Great job! You understand this topic." : "❌ Revise the docs and try again.");
        res.style.color = pass ? "var(--pass)" : "var(--fail)";
        res.style.display = "block";
      }
      // Lock all questions in this quiz
      quizRoot.querySelectorAll(".quiz-q").forEach((q) => q.classList.add("locked"));
      if (quizRoot.dataset.quiz) {
        const key = quizRoot.dataset.quiz;
        const prev = getStoreVal(key, { best: 0 });
        const pct = Math.round((correct / total) * 100);
        if (pct > (prev.best || 0)) {
          setStore(key, { best: pct, tries: (prev.tries || 0) + 1 });
          if (res) res.innerHTML += " <small>🏆 New best score saved!</small>";
        } else {
          setStore(key, { best: prev.best || 0, tries: (prev.tries || 0) + 1 });
        }
      }
    }
    // Retake quiz
    if (e.target.classList.contains("reset-quiz")) {
      const quizRoot = e.target.closest("[data-quiz]") || e.target.closest(".quiz");
      if (!quizRoot) return;
      quizRoot.querySelectorAll(".quiz-q").forEach((q) => {
        q.classList.remove("locked");
        q.querySelectorAll(".opt").forEach((o) =>
          o.classList.remove("selected", "correct", "wrong"));
        const ex = q.querySelector(".explain");
        if (ex) ex.classList.remove("show");
      });
      const res = quizRoot.querySelector(".quiz-result");
      if (res) res.style.display = "none";
    }
  });

  /* ---------- Bug-hunting playground ----------
     The practice page's buggy form blocks normal submission (it is intentionally
     insecure). Prevent submit so users can inspect fields without navigation. */
  document.addEventListener("submit", (e) => {
    if (e.target.id === "bugForm") {
      e.preventDefault();
      window.qatToast("Submitted (this is a buggy test form — no real data was sent). " +
        "Now hunt the bugs and tick the checklist.");
    }
  });

  /* ---------- Toast helper ---------- */
  window.qatToast = function (msg) {
    let t = document.getElementById("qat-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "qat-toast";
      t.style.cssText =
        "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
        "background:rgba(42,28,32,0.95);color:#F5EBE0;padding:12px 22px;border-radius:14px;" +
        "border:1px solid rgba(245,235,224,0.12);z-index:999;font-size:14px;" +
        "box-shadow:0 12px 32px rgba(42,28,32,0.30),0 4px 12px rgba(214,125,140,0.20);opacity:0;" +
        "backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);" +
        "transition:opacity .3s, transform .3s;pointer-events:none;";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => (t.style.opacity = "0"), 2600);
  };

  /* ---------- Dashboard stats ---------- */
  function renderDashboard() {
    const el = document.getElementById("statQuizzes");
    if (el) {
      const store = getStore();
      const quizzes = Object.keys(store).filter((k) => k.startsWith("quiz_")).length;
      const total = document.querySelectorAll("[data-quiz]").length;
      el.textContent = (total ? quizzes + " / " + total : quizzes + " quiz best-scores saved");
    }
  }
  renderDashboard();

  /* ---------- Copy cheatsheet code buttons ---------- */
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("copy-code")) {
      const pre = e.target.parentElement.querySelector("pre");
      if (!pre) return;
      const text = pre.innerText;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => window.qatToast("Copied to clipboard ✔"));
      }
    }
  });
})();
