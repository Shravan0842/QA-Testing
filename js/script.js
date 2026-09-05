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

  /* ---------- Deep-link to a section via URL hash ----------
     We intercept clicks on in-page anchor links (<a href="#id">) and run our
     own smooth-scroll. Why not rely on the browser's native smooth-scroll?
     Two reasons:
       1. Chromium's native smooth-scroll + `scroll-padding-top: 80px` has a
          bug where it stops 80px short of the target — the section's top
          ends up at viewport y=160 instead of y=80. This shifts every
          subsequent section down by 80px and makes the page appear to
          "miss" the target.
       2. The native smooth-scroll and our scroll-spy can race, causing the
          rail highlight to flicker.
     Our JS scroll uses window.scrollTo() with the EXACT target position
     (element.getBoundingClientRect().top + window.scrollY - 80) and a
     simple rAF easing function. The spy observer picks up the active
     section once the scroll settles. */

  function smoothScrollTo(targetY, durationMs) {
    const startY = window.scrollY;
    const delta = targetY - startY;
    if (Math.abs(delta) < 1) return;
    const duration = Math.max(200, Math.min(durationMs || 600, Math.abs(delta) * 0.4));
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      // easeInOutCubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, startY + delta * eased);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Intercept clicks on in-page hash links inside the TOC rail (and also
  // any other in-page hash link on the page). The default action is
  // suppressed only for links whose target exists and is in the same
  // page — so external links still work.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    // Skip links inside the infographic focus rail — that page has its
    // own click controller (which renders a single infographic instead of
    // scrolling to it). Letting both handlers run would scroll to a
    // hidden element AND show the focus view, which is janky.
    if (a.closest(".infographics-layout")) return;
    const href = a.getAttribute("href");
    if (!href || href.length < 2 || href === "#") return;
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (!el) return; // let the browser handle it (will likely no-op)
    e.preventDefault();
    // Compute target Y: element's top in the page, minus topnav padding.
    const targetY = el.getBoundingClientRect().top + window.scrollY - 80;
    // Light up the matching rail link immediately.
    if (typeof window.__qatSetRailActive === "function") {
      const railLink = document.querySelector('.toc-rail-list a[href="' + href + '"]');
      if (railLink) window.__qatSetRailActive(railLink.dataset.toc);
    }
    smoothScrollTo(targetY, 600);
    // Update the URL hash without re-triggering hashchange scroll logic.
    if (history && history.replaceState) {
      history.replaceState(null, "", href);
    }
  });

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

    // Skip rails whose data-toc keys are not scroll-spy namespaces. The
    // infographics rail uses keys prefixed with "i_" (e.g. "i_sdlc_models");
    // it's a focus-mode controller, not a TOC spy. The spy must not claim
    // those items or override the focus controller's "active" class.
    // Docs/tutorial TOCs use "doc_*" and "t_*" — those are valid spy keys.
    const SPY_KEY_RE = /^(doc_|t_)/;
    const scopedLinks = links.filter((a) => SPY_KEY_RE.test(a.dataset.toc || ""));
    if (!scopedLinks.length) return;

    // Map data-toc key (e.g. "t_intro") to its target section element (#t-intro).
    const sections = scopedLinks
      .map((a) => {
        const href = a.getAttribute("href") || "";
        if (!href.startsWith("#")) return null;
        const el = document.getElementById(href.slice(1));
        return el ? { key: a.dataset.toc, el } : null;
      })
      .filter(Boolean);
    if (!sections.length) return;

    const linkByKey = new Map(scopedLinks.map((a) => [a.dataset.toc, a]));
    let currentKey = null;

    function setActive(key) {
      if (key === currentKey) return;
      currentKey = key;
      scopedLinks.forEach((a) => a.classList.toggle("active", a.dataset.toc === key));
      // Keep the active link visible inside the rail scroll container.
      // Use rail.scrollTop directly (NOT scrollIntoView) so the document
      // scroll position is not affected.
      const active = linkByKey.get(key);
      if (active) {
        const railRect = rail.getBoundingClientRect();
        const linkRect = active.getBoundingClientRect();
        if (linkRect.top < railRect.top) {
          rail.scrollTop -= (railRect.top - linkRect.top);
        } else if (linkRect.bottom > railRect.bottom) {
          rail.scrollTop += (linkRect.bottom - railRect.bottom);
        }
      }
    }

    // Expose a way to force-set the active rail link by key (used on initial
    // page load when there's a hash in the URL).
    window.__qatSetRailActive = function (key) { setActive(key); };

    /* ---------- IntersectionObserver-based scroll spy ----------
       The previous implementation used a scroll listener + a "find the
       section closest to a probe line" scan. That had two issues:
         1. During the browser's smooth-scroll on a TOC click, the scroll
            event fires repeatedly and the spy would "fight" the choice
            the user just made — landing on the chapter above the one
            they clicked.
         2. Calling scrollIntoView() on the rail link to keep it visible
            could re-scroll the document in some browsers, re-triggering
            the scroll listener.

       IntersectionObserver is the right primitive here. The browser
       notifies us when a section's top edge crosses a defined zone (the
       top of the viewport, just under the topnav). No timing hacks, no
       double-scroll, no fight between click and spy. */

    // Track which sections are currently in the "active zone" (top of
    // viewport, below the topnav). The active section is the last one
    // (in DOM order) whose top has scrolled into this zone.
    const inZone = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = entry.target.dataset.spyKey;
          if (!key) continue;
          if (entry.isIntersecting) {
            inZone.add(key);
          } else {
            inZone.delete(key);
          }
        }
        // Pick the last section (DOM order) currently in the zone. The
        // last-in-DOM-order rule means: when two sections are both
        // visible in the band, the one further down (i.e. the one the
        // user is currently reading) wins.
        let best = null;
        for (const s of sections) {
          if (inZone.has(s.key)) best = s;
        }
        if (best) setActive(best.key);
        else if (inZone.size === 0) {
          // No section is currently in the band — this can happen briefly
          // between two sections during a fast scroll. Pick the section
          // whose top is just above the band (the one we just scrolled
          // past). Falling back to the most recent "in zone" via
          // currentKey is fine; if there's no currentKey yet, default
          // to the first section.
          if (!currentKey) setActive(sections[0].key);
        }
      },
      {
        // Active zone: the top 30% of the viewport, just below the topnav.
        // A section is "in the zone" if any part of it falls in this band.
        // This is wide enough that for a smooth scroll that lands slightly
        // above or below the section header, the section still shows up
        // as active. The thin 40px band I tried before was too narrow —
        // sections could "fall through" the band and the highlight
        // wouldn't update.
        rootMargin: "-80px 0px -70% 0px",
        threshold: 0,
      }
    );

    // Tag each section with its spy key and observe it.
    for (const s of sections) {
      s.el.dataset.spyKey = s.key;
      observer.observe(s.el);
    }

    // When the user clicks a rail link, set the active link immediately.
    // The smooth scroll will run via the browser's native behaviour; the
    // observer will keep the highlight in sync as the scroll progresses.
    rail.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-toc]");
      if (!a) return;
      setActive(a.dataset.toc);
    });

    // Initial pass: if the page was loaded with a hash, mark that link
    // active so the highlight is correct before the first observer
    // callback fires.
    if (window.location.hash) {
      const link = rail.querySelector(
        '.toc-rail-list a[href="' + window.location.hash + '"]'
      );
      if (link) setActive(link.dataset.toc);
    } else {
      // No hash: default to the first section.
      setActive(sections[0].key);
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
  const TOTAL_QUIZZES = 12;
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
