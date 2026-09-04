/* ============================================================
   QA Tester Academy - Shared JavaScript
   Top nav, accordion, tabs, flashcards, quiz engine,
   progress tracking (localStorage), bug-hunting playground
   ============================================================ */

(function () {
  "use strict";

  const STORE_KEY = "qat_progress_v1";

  /* ---------- Top nav (mobile menu toggle) ---------- */
  const menuBtn = document.querySelector(".topnav-menu-btn");
  const topnavSections = document.querySelector(".topnav-sections");
  if (menuBtn && topnavSections) {
    menuBtn.addEventListener("click", () => {
      topnavSections.classList.toggle("open");
    });
  }

  /* ---------- Theme toggle (dark / light) ---------- */
  const themeBtn = document.getElementById("themeToggle");
  function syncThemeButton() {
    if (!themeBtn) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const ico = themeBtn.querySelector(".ico");
    const lbl = themeBtn.querySelector(".label");
    if (ico) ico.textContent = dark ? "☀️" : "🌙";
    if (lbl) lbl.textContent = dark ? "Light" : "Dark";
    themeBtn.title = dark ? "Switch to light mode" : "Switch to dark mode";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
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

  // Highlight the active topnav link.
  // Single-row nav: just match the current path to a section link.
  function updateActiveNav() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll(".topnav-sections .topnav-link");
    links.forEach((a) => a.classList.remove("active"));
    const active = Array.from(links).find((a) => a.getAttribute("href") === path) || null;
    if (active) active.classList.add("active");
  }
  updateActiveNav();
  window.addEventListener("hashchange", updateActiveNav);

  /* ---------- Deep-link to a section via URL hash (e.g. practice.html#flashcards) ----------
     Plain <a href="#id"> clicks are handled by the browser (html { scroll-behavior: smooth }
     + scroll-padding-top: 80px keeps the heading below the topnav). This helper just makes
     sure the target actually scrolls into view when the page is loaded with a hash
     already in the URL, and on subsequent hashchange events. */
  function scrollToHashTarget() {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Highlight the matching rail link (the rail exists on both docs.html and practice.html).
    if (typeof window.__qatSetRailActive === "function") {
      const link = document.querySelector('.toc-rail-list a[href="' + hash + '"]');
      if (link) window.__qatSetRailActive(link.dataset.toc);
    }
  }
  window.addEventListener("hashchange", scrollToHashTarget);

  /* ---------- Accordion ---------- */
  document.addEventListener("click", (e) => {
    const head = e.target.closest(".acc-head");
    if (head) {
      const acc = head.parentElement;
      acc.classList.toggle("open");
    }
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
      syncTocReadState();
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

  /* ---------- Docs sticky left rail: read-tick sync + scroll-spy ---------- */
  function syncTocReadState() {
    const links = document.querySelectorAll(".toc-rail-list a[data-toc]");
    if (!links.length) return;
    links.forEach((a) => {
      const key = a.dataset.toc; // e.g. "doc_intro" — matches data-docmark
      const checked = getStoreVal(key, false);
      const tick = a.querySelector(".toc-tick");
      a.classList.toggle("read", !!checked);
      if (tick) {
        if (checked) tick.removeAttribute("hidden");
        else tick.setAttribute("hidden", "");
      }
    });
  }
  syncTocReadState();

  function setupDocsScrollSpy() {
    const rail = document.querySelector(".toc-rail");
    if (!rail) return;
    const links = Array.from(rail.querySelectorAll(".toc-rail-list a[data-toc]"));
    if (!links.length) return;

    // Map data-toc key (e.g. "doc_intro") to its target section element (#intro).
    const sections = links
      .map((a) => {
        const href = a.getAttribute("href") || "";
        if (!href.startsWith("#")) return null;
        const el = document.getElementById(href.slice(1));
        return el ? { key: a.dataset.toc, el } : null;
      })
      .filter(Boolean);
    if (!sections.length) return;

    const linkByKey = new Map(links.map((a) => [a.dataset.toc, a]));
    let currentKey = null;
    let frameQueued = false;
    let pendingKey = null;

    function setActive(key) {
      if (key === currentKey) return;
      currentKey = key;
      links.forEach((a) => a.classList.toggle("active", a.dataset.toc === key));
      // Keep the active link visible inside the rail scroll container
      const active = linkByKey.get(key);
      if (active) {
        const railRect = rail.getBoundingClientRect();
        const linkRect = active.getBoundingClientRect();
        if (linkRect.top < railRect.top || linkRect.bottom > railRect.bottom) {
          active.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    }

    // Expose a way to force-set the active rail link by key (used by hash deep-links).
    window.__qatSetRailActive = function (key) { setActive(key); };

    function computeActive() {
      // Find the section whose top is closest to (but not below) ~25% of viewport
      const probeY = window.innerHeight * 0.25;
      let best = null;
      let bestDist = Infinity;
      for (const s of sections) {
        const top = s.el.getBoundingClientRect().top;
        if (top <= probeY) {
          const dist = probeY - top;
          if (dist < bestDist) {
            bestDist = dist;
            best = s;
          }
        }
      }
      // If we're at the very top of the page and no section is above the probe,
      // fall back to the first section.
      if (!best) best = sections[0];
      // If the last section's bottom is above the probe, we are below all sections
      // — keep the last one active.
      const last = sections[sections.length - 1];
      const lastRect = last.el.getBoundingClientRect();
      if (lastRect.bottom < probeY) best = last;
      pendingKey = best.key;
    }

    function onScroll() {
      if (frameQueued) return;
      frameQueued = true;
      requestAnimationFrame(() => {
        frameQueued = false;
        computeActive();
        if (pendingKey) setActive(pendingKey);
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Initial pass
    computeActive();
    if (pendingKey) setActive(pendingKey);
    // If the page was opened with a hash, scroll there and mark the rail link active.
    if (window.location.hash) {
      requestAnimationFrame(scrollToHashTarget);
    }
  }
  setupDocsScrollSpy();

  /* ---------- Scroll-driven pause for ambient motion ----------
     Toggles `is-scrolling` on <body> while the user is scrolling, then
     removes it ~150ms after they stop. The body uses this class to
     pause its infinite background-mesh + orb animations so the page
     doesn't repaint the mesh on every scroll frame. rAF-throttled. */
  (function setupScrollPause() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // honor user preference
    }
    let rafQueued = false;
    let resumeTimer = null;
    function onScroll() {
      if (!document.body.classList.contains("is-scrolling")) {
        document.body.classList.add("is-scrolling");
      }
      if (resumeTimer) clearTimeout(resumeTimer);
      if (!rafQueued) {
        rafQueued = true;
        requestAnimationFrame(() => { rafQueued = false; });
      }
      resumeTimer = setTimeout(() => {
        document.body.classList.remove("is-scrolling");
        resumeTimer = null;
      }, 160);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("touchmove", onScroll, { passive: true });
    window.addEventListener("keydown", (e) => {
      const keys = ["PageUp","PageDown","Home","End","ArrowUp","ArrowDown","Space"];
      if (keys.indexOf(e.code) !== -1) onScroll();
    });
  })();

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
  // Total quizzes available across the app (kept in sync with practice.html)
  const TOTAL_QUIZZES = 7;
  function renderDashboard() {
    const el = document.getElementById("statQuizzes");
    if (el) {
      const store = getStore();
      const taken = Object.keys(store).filter((k) => k.startsWith("quiz_")).length;
      el.textContent = taken > 0
        ? taken + " / " + TOTAL_QUIZZES
        : TOTAL_QUIZZES + "+";
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
