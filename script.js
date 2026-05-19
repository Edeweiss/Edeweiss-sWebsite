/* =====================================================================
   EDEWEISS'S PORTFOLIO — script.js  (revised)

   Fixes applied in this revision:
   FIX 3 — Removed random-character "glitch" effect on Contents rows
           (kept the visual scanline/hover transform).
   FIX 5 — Side-menu active state is now computed *per project section*
           using IntersectionObserver, so AI Music's "05 Future Direction"
           no longer stays lit. Default on first load: 01 Overview.
   FIX 8 — Removed the decorative music sphere logic; search bar is now
           a real filter that scrolls to the first matching project, or
           shows "No matching project found." when no project matches.
   ===================================================================== */

(() => {
  'use strict';

  /* ----------------------------------------------------------------
     1. Smooth scroll for in-page anchors (with sticky-header offset)
  ---------------------------------------------------------------- */
  const headerOffset = 72;

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href.length < 2) return;
      const target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      scrollToId(href.slice(1));
      const sm = document.getElementById('startMenu');
      if (sm) sm.classList.remove('open');
    });
  });

  /* FIX 1: brand logo always returns to Home (#home) within the same file.
     Works even if the page is opened by direct path (index.html#about etc.). */
  const brandHome = document.getElementById('brandHome');
  brandHome?.addEventListener('click', (e) => {
    if (location.pathname.endsWith('index.html') || location.pathname.endsWith('/')) {
      e.preventDefault();
      scrollToId('home');
    }
  });

  /* ----------------------------------------------------------------
     2. Desktop icons (home) → folder-open feel + smooth scroll
  ---------------------------------------------------------------- */
  document.querySelectorAll('.desktop-icon').forEach(icon => {
    icon.addEventListener('click', () => {
      const targetId = icon.dataset.open;
      icon.animate(
        [
          { transform: 'translateY(0) scale(1)' },
          { transform: 'translateY(-4px) scale(1.06)' },
          { transform: 'translateY(0) scale(1)' }
        ],
        { duration: 280, easing: 'ease-out' }
      );
      setTimeout(() => scrollToId(targetId), 180);
    });
  });

  /* ----------------------------------------------------------------
     3. FIX 5 — Side-menu active-state (PER PROJECT, IntersectionObserver)

     Strategy:
       • For each .project-section we look at its .proj-block articles.
       • An IntersectionObserver fires whenever a block enters/leaves view.
       • We then ask: which block is closest to the top of the viewport
         inside this project? That one's sm-link becomes "active".
       • If the project section itself is not in view at all,
         we default to the FIRST sm-link being active (01 Overview).
     This guarantees that when you scroll into AI Music's 01 Overview,
     "01" is highlighted — not "05 Future Direction".
  ---------------------------------------------------------------- */
  function setupSideMenus() {
    const projectSections = document.querySelectorAll('.project-section');

    projectSections.forEach(proj => {
      const links = Array.from(proj.querySelectorAll('.sm-link'));
      const blocks = links
        .map(l => document.getElementById(l.getAttribute('href').slice(1)))
        .filter(Boolean);
      if (!blocks.length) return;

      // helper: turn off all this project's links, then turn on one
      function setActive(idx) {
        links.forEach((l, i) => l.classList.toggle('active', i === idx));
      }

      // Default state on load: first link active (FIX 5 default)
      setActive(0);

      // Track visibility of each block within this project
      const visibility = new Map();
      blocks.forEach(b => visibility.set(b, 0));

      const io = new IntersectionObserver((entries) => {
        entries.forEach(en => visibility.set(en.target, en.intersectionRatio));

        // Pick the block with greatest visible ratio (ties: earlier wins)
        let bestIdx = -1;
        let bestRatio = 0;
        blocks.forEach((b, i) => {
          const r = visibility.get(b) || 0;
          if (r > bestRatio) { bestRatio = r; bestIdx = i; }
        });

        if (bestRatio === 0) {
          // none in view -> if we're above the project entirely, keep 01;
          // if we're below it entirely, keep last; otherwise keep 01.
          const projRect = proj.getBoundingClientRect();
          if (projRect.bottom < 0) {
            setActive(blocks.length - 1);
          } else {
            setActive(0);
          }
          return;
        }
        setActive(bestIdx);
      }, {
        // top offset to account for sticky header
        rootMargin: `-${headerOffset + 24}px 0px -55% 0px`,
        threshold: [0, 0.15, 0.4, 0.7, 1]
      });

      blocks.forEach(b => io.observe(b));
    });
  }
  setupSideMenus();

  /* ----------------------------------------------------------------
     4. Lightbox — click any figure marked [data-lightbox]
  ---------------------------------------------------------------- */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCap = document.getElementById('lightboxCaption');
  const lightboxClose = lightbox?.querySelector('.lb-close');

  function openLightbox(src, caption = '') {
    if (!lightbox) return;
    lightboxImg.src = src;
    lightboxCap.textContent = caption;
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-lightbox] img').forEach(img => {
    img.addEventListener('click', () => {
      const cap = img.closest('figure')?.querySelector('figcaption')?.textContent || '';
      openLightbox(img.src, cap);
    });
  });
  lightboxClose?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  /* ----------------------------------------------------------------
     5. FIX 8 — Functional search bar

     Behaviour:
       • Reads keywords from the input.
       • Matches each project (echo / glow / ai) against a fixed keyword
         dictionary derived from the project content + the user's requested
         search vocabulary.
       • Hides non-matching CONTENTS rows in real time and dims
         non-matching project sections.
       • On Enter or button click, scrolls to the first matched
         project section.
       • If no project matches, shows "No matching project found."
         in a small bubble under the input.
  ---------------------------------------------------------------- */
  const searchInput  = document.getElementById('searchInput');
  const searchBtn    = document.getElementById('searchBtn');
  const searchStatus = document.getElementById('searchStatus');

  // FIX 8: explicit keyword dictionary so the requested vocabulary always works.
  const PROJECT_KEYWORDS = {
    'project-echo': [
      'project 01', 'echo', 'echo ritual', 'ritual', 'memorial', 'grief',
      'blender', 'service design', 'speculative', 'emotional', 'spatial'
    ],
    'project-glow': [
      'project 02', 'helensburgh', 'glow worm', 'glow', 'microsite',
      'html', 'css', 'web design', 'responsive', 'tunnel', 'eco',
      'information architecture', 'front-end'
    ],
    'project-ai': [
      'project 03', 'ai', 'ai music', 'music', 'music learning',
      'generative ai', 'figma', 'interaction design', 'product design',
      'feedback', 'practice', 'learning system', 'app'
    ]
  };

  function setStatus(msg) {
    if (!searchStatus) return;
    if (msg) {
      searchStatus.textContent = msg;
      searchStatus.classList.add('show');
    } else {
      searchStatus.textContent = '';
      searchStatus.classList.remove('show');
    }
  }

  function matchedProjects(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return Object.keys(PROJECT_KEYWORDS); // empty => all
    return Object.keys(PROJECT_KEYWORDS).filter(id => {
      const kws = PROJECT_KEYWORDS[id];
      // match if any keyword contains query OR query contains a keyword token
      return kws.some(k => k.includes(q) || q.includes(k));
    });
  }

  function applySearch(query, { jump = false } = {}) {
    const matched = matchedProjects(query);
    const matchSet = new Set(matched);

    // toggle CONTENTS rows
    document.querySelectorAll('.contents-list .content-row').forEach(row => {
      const href = row.getAttribute('href');
      const id = href ? href.slice(1) : '';
      // map content row's anchor (#project-echo) directly
      const projId = href?.startsWith('#') ? href.slice(1) : null;
      const isMatch = !query || matchSet.has(projId);
      row.classList.toggle('hide', !isMatch);
    });

    // dim non-matching project sections
    document.querySelectorAll('.project-section').forEach(sec => {
      const isMatch = !query || matchSet.has(sec.id);
      sec.style.opacity = isMatch ? '' : '.35';
    });

    if (!query) { setStatus(''); return; }

    if (matched.length === 0) {
      setStatus('No matching project found.');
      return;
    }
    setStatus(`${matched.length} match${matched.length > 1 ? 'es' : ''} found`);

    if (jump) {
      scrollToId(matched[0]);
    }
  }

  searchInput?.addEventListener('input', () => applySearch(searchInput.value));
  searchBtn?.addEventListener('click', () => applySearch(searchInput.value, { jump: true }));
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applySearch(searchInput.value, { jump: true });
    }
  });
  // Clear status when input loses focus and is empty
  searchInput?.addEventListener('blur', () => {
    if (!searchInput.value.trim()) setStatus('');
  });

  /* ----------------------------------------------------------------
     6. Start button toggles a floating Win98 start menu
  ---------------------------------------------------------------- */
  const startBtn = document.getElementById('startBtn');
  const startMenu = document.getElementById('startMenu');
  startBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    startMenu?.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!startMenu || !startMenu.classList.contains('open')) return;
    if (e.target.closest('#startMenu') || e.target.closest('#startBtn')) return;
    startMenu.classList.remove('open');
  });

  /* ----------------------------------------------------------------
     7. FIX 3 — Removed the random-character "glitch" effect on
                Contents rows. (The CSS hover scan/glow remains.)
  ---------------------------------------------------------------- */
  // No-op intentionally — see FIX 3.

  /* ----------------------------------------------------------------
     8. Cursor sparkle trail (subtle pixel glow following mouse)
  ---------------------------------------------------------------- */
  const sparkleLayer = document.createElement('div');
  sparkleLayer.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 50;
  `;
  document.body.appendChild(sparkleLayer);
  let lastSpark = 0;
  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    if (now - lastSpark < 70) return;
    lastSpark = now;
    const s = document.createElement('span');
    const colors = ['#00ffd5', '#ff5fd2', '#b66bff', '#aaff66'];
    const c = colors[Math.floor(Math.random() * colors.length)];
    s.style.cssText = `
      position:absolute; left:${e.clientX}px; top:${e.clientY}px;
      width:6px; height:6px; border-radius:50%;
      background:${c}; box-shadow:0 0 8px ${c};
      opacity:.9; transform: translate(-50%,-50%);
      transition: opacity .6s ease, transform .6s ease;
    `;
    sparkleLayer.appendChild(s);
    requestAnimationFrame(() => {
      s.style.opacity = '0';
      s.style.transform = `translate(-50%,-50%) translateY(-14px) scale(.4)`;
    });
    setTimeout(() => s.remove(), 700);
  }, { passive: true });

  /* ----------------------------------------------------------------
     9. Image fallback note for missing photos
  ---------------------------------------------------------------- */
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => {
      const parent = img.parentElement;
      if (!parent) return;
      if (parent.querySelector('.img-fallback')) return;
      const note = document.createElement('span');
      note.className = 'img-fallback';
      note.textContent = '⌧  ' + (img.getAttribute('src') || 'missing image');
      note.style.cssText = `
        display:flex;align-items:center;justify-content:center;
        padding:20px;font-family:'JetBrains Mono',monospace;font-size:11px;
        color:#ff5fd2;background:repeating-linear-gradient(45deg, rgba(255,95,210,.08) 0 10px, transparent 10px 20px);
        border:1px dashed rgba(255,95,210,.5);min-height:120px;text-align:center;
      `;
      parent.appendChild(note);
      img.style.display = 'none';
    });
  });

  /* ----------------------------------------------------------------
     10. FIX 8 — Audio code removed.
         The decorative music sphere is gone; the search input now sits
         in the same nav slot. Optional `assets/audio/bgm.mp3` is no
         longer auto-loaded — drop it back in and re-wire if you ever
         want music again.
  ---------------------------------------------------------------- */

})();
