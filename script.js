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
     2. Desktop icon system + Win95 window manager + ambient canvas
  ---------------------------------------------------------------- */

  /* ── Clock ───────────────────────────────────────────────── */
  function updateClock() {
    const el = document.getElementById('desktopClock');
    if (!el) return;
    const n = new Date();
    el.textContent = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }
  updateClock();
  setInterval(updateClock, 30000);

  /* ── Win95 Window Manager ────────────────────────────────── */
  (function initWindowManager() {
    let zTop = 100;
    const taskbar = document.getElementById('taskbarWindows');

    function bringToFront(win) {
      win.style.zIndex = ++zTop;
      document.querySelectorAll('.taskbar-win-btn').forEach(b => b.classList.remove('active'));
      const btn = taskbar?.querySelector(`[data-tbwin="${win.id}"]`);
      if (btn) btn.classList.add('active');
    }

    function addTaskbarBtn(win) {
      if (!taskbar || taskbar.querySelector(`[data-tbwin="${win.id}"]`)) return;
      const title = win.querySelector('.win95-title')?.textContent || win.id;
      const icon  = win.querySelector('.win95-icon')?.textContent || '▣';
      const btn = document.createElement('button');
      btn.className = 'taskbar-win-btn';
      btn.dataset.tbwin = win.id;
      btn.innerHTML = `<span>${icon}</span><span>${title.slice(0,18)}</span>`;
      btn.addEventListener('click', () => {
        if (win.classList.contains('minimized')) {
          win.classList.remove('minimized');
          win.style.display = '';
          bringToFront(win);
        } else if (parseInt(win.style.zIndex) === zTop) {
          // minimize
          win.classList.add('minimized');
          btn.classList.remove('active');
        } else {
          bringToFront(win);
        }
      });
      taskbar.appendChild(btn);
    }

    function removeTaskbarBtn(winId) {
      taskbar?.querySelector(`[data-tbwin="${winId}"]`)?.remove();
    }

    function openWindow(winId) {
      const win = document.getElementById(winId);
      if (!win) return;

      if (win.style.display !== 'none' && !win.classList.contains('minimized')) {
        win.classList.remove('minimized');
        bringToFront(win);
        return;
      }

      if (!win._positioned) {
        win._positioned = true;
        win.style.transform = '';

        const desktop = document.getElementById('desktopScreen');
        const dW = desktop ? desktop.offsetWidth  : window.innerWidth;
        const dH = desktop ? desktop.offsetHeight : window.innerHeight;
        const taskbarH = 38;
        const iconsW   = 180; // left icons column width to avoid

        // Temporarily show to measure
        const prevDisplay = win.style.display;
        win.style.display = '';
        win.style.visibility = 'hidden';
        const wW = win.offsetWidth  || 520;
        const wH = win.offsetHeight || 420;
        win.style.visibility = '';
        if (prevDisplay === 'none') win.style.display = 'none';

        // Cascade offset
        const openCount = document.querySelectorAll('.win95:not([style*="display: none"])').length;
        const cascade   = Math.min(openCount * 18, 60);

        // Center in the available space to the right of icons
        const availW = dW - iconsW;
        const left   = Math.round(iconsW + (availW - wW) / 2) + cascade;
        const top    = Math.max(10, Math.round((dH - taskbarH - wH) / 2) + cascade);

        win.style.left = `${Math.max(iconsW + 10, left - 70)}px`;
        win.style.top  = `${Math.max(10, top - 60)}px`;
      }

      win.classList.remove('minimized');
      win.style.display = '';
      bringToFront(win);
      addTaskbarBtn(win);

      const icon = document.querySelector(`.dicon[data-win="${winId}"]`);
      icon?.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.15) translateY(-4px)' },
        { transform: 'scale(1)' }
      ], { duration: 280, easing: 'ease-out' });
    }

    // ── Titlebar drag ─────────────────────────────────────────
    function makeDraggable(win) {
      const titlebar = win.querySelector('.win95-titlebar');
      if (!titlebar) return;
      let startX, startY, startL, startT, dragging = false;

      titlebar.addEventListener('mousedown', e => {
        if (e.target.classList.contains('win95-btn')) return;
        if (win.classList.contains('maximized')) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startL = parseInt(win.style.left) || win.offsetLeft;
        startT = parseInt(win.style.top)  || win.offsetTop;
        bringToFront(win);
        e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        win.style.left = `${startL + e.clientX - startX}px`;
        win.style.top  = `${startT + e.clientY - startY}px`;
      });
      document.addEventListener('mouseup', () => { dragging = false; });

      // Mobile drag
      titlebar.addEventListener('touchstart', e => {
        if (e.target.classList.contains('win95-btn')) return;
        if (win.classList.contains('maximized')) return;
        const t = e.touches[0];
        dragging = true;
        startX = t.clientX; startY = t.clientY;
        startL = parseInt(win.style.left) || win.offsetLeft;
        startT = parseInt(win.style.top)  || win.offsetTop;
        bringToFront(win);
      }, { passive: true });
      document.addEventListener('touchmove', e => {
        if (!dragging) return;
        const t = e.touches[0];
        win.style.left = `${startL + t.clientX - startX}px`;
        win.style.top  = `${startT + t.clientY - startY}px`;
      }, { passive: true });
      document.addEventListener('touchend', () => { dragging = false; });

      // Bring to front on click
      win.addEventListener('mousedown', () => bringToFront(win));
    }

    // ── Resize handle ─────────────────────────────────────────
    function makeResizable(win) {
      const handle = win.querySelector('.win95-resize-handle');
      if (!handle) return;
      let dragging = false, startX, startY, startW, startH;
      handle.addEventListener('mousedown', e => {
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startW = win.offsetWidth; startH = win.offsetHeight;
        e.stopPropagation(); e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const newW = Math.max(260, startW + e.clientX - startX);
        const newH = Math.max(120, startH + e.clientY - startY);
        win.style.width  = `${newW}px`;
        win.style.height = `${newH}px`;
      });
      document.addEventListener('mouseup', () => { dragging = false; });
    }

    // ── Control buttons ───────────────────────────────────────
    function wireControls(win) {
      win.querySelectorAll('.win95-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const action = btn.dataset.action;
          if (action === 'close') {
            win.style.display = 'none';
            win.classList.remove('minimized', 'maximized');
            removeTaskbarBtn(win.id);
          } else if (action === 'min') {
            win.classList.add('minimized');
            win.style.display = 'none';
            const tb = taskbar?.querySelector(`[data-tbwin="${win.id}"]`);
            if (tb) tb.classList.remove('active');
          } else if (action === 'max') {
            if (win.classList.contains('maximized')) {
              win.classList.remove('maximized');
              if (win._preMaxLeft) { win.style.left = win._preMaxLeft; win.style.top  = win._preMaxTop; win.style.width = win._preMaxW; win.style.height = win._preMaxH; }
            } else {
              win._preMaxLeft = win.style.left; win._preMaxTop  = win.style.top;
              win._preMaxW    = win.style.width; win._preMaxH   = win.style.height;
              win.classList.add('maximized');
            }
          }
        });
      });
    }

    // ── Desktop icon click / dblclick ─────────────────────────
    let lastClick = {id: null, t: 0};
    document.querySelectorAll('.dicon').forEach(icon => {
      icon.addEventListener('click', () => {
        const winId = icon.dataset.win;
        if (!winId) return;
        const now = Date.now();
        if (lastClick.id === winId && now - lastClick.t < 400) {
          openWindow(winId);
          lastClick = {id: null, t: 0};
        } else {
          // single click — select
          document.querySelectorAll('.dicon').forEach(i => i.classList.remove('selected'));
          icon.classList.add('selected');
          lastClick = {id: winId, t: now};
        }
      });
      icon.addEventListener('dblclick', () => {
        openWindow(icon.dataset.win);
        lastClick = {id: null, t: 0};
      });
    });

    // Deselect icons when clicking desktop
    document.getElementById('desktopScreen')?.addEventListener('click', e => {
      if (e.target.closest('.dicon') || e.target.closest('.win95') || e.target.closest('.desktop-taskbar')) return;
      document.querySelectorAll('.dicon').forEach(i => i.classList.remove('selected'));
    });

    // ── Wire all windows ──────────────────────────────────────
    document.querySelectorAll('.win95').forEach(win => {
      makeDraggable(win);
      makeResizable(win);
      wireControls(win);
      // If visible on load, add to taskbar
      if (win.style.display !== 'none') addTaskbarBtn(win);
    });

    // Project file items close the projects window and scroll
    document.querySelectorAll('.win95-file-item[href^="#"]').forEach(a => {
      a.addEventListener('click', () => {
        const win = document.getElementById('win-projects');
        if (win) { win.style.display = 'none'; removeTaskbarBtn('win-projects'); }
      });
    });

    // About notepad link scrolls page
    document.querySelectorAll('.notepad-link[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        scrollToId(a.getAttribute('href').slice(1));
      });
    });

    // ── Music Player — expandable tracks ─────────────────────
    let currentAudio = null;
    let currentAudioBtn = null;

    function stopAllAudio() {
      if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
      if (currentAudioBtn) { currentAudioBtn.textContent = '▶ Play Audio'; }
      currentAudio = null; currentAudioBtn = null;
    }

    function stopAllVideos(exceptIdx) {
      document.querySelectorAll('.mp-video').forEach((v, i) => {
        if (i !== exceptIdx) { v.pause(); v.currentTime = 0; }
      });
      document.querySelectorAll('.mp-play-overlay').forEach((o, i) => {
        if (i !== exceptIdx) o.querySelector('.mp-play-icon').textContent = '▶';
      });
    }

    // Track row click — expand / collapse
    document.querySelectorAll('.mp-track-row').forEach(row => {
      row.addEventListener('click', () => {
        const track   = row.closest('.mp-track');
        const expand  = track.querySelector('.mp-expand');
        const chevron = row.querySelector('.mp-chevron');
        const isOpen  = track.classList.contains('open');

        // Close all others
        document.querySelectorAll('.mp-track.open').forEach(t => {
          t.classList.remove('open');
          t.querySelector('.mp-expand').style.maxHeight = '0';
          t.querySelector('.mp-chevron').textContent = '▶';
        });

        if (!isOpen) {
          track.classList.add('open');
          expand.style.maxHeight = expand.scrollHeight + 'px';
          chevron.textContent = '▼';
        } else {
          stopAllAudio();
          stopAllVideos(-1);
        }
      });
    });

    // Video play overlay click — with sound
    document.querySelectorAll('.mp-play-overlay').forEach((overlay, idx) => {
      overlay.addEventListener('click', e => {
        e.stopPropagation();
        const icon  = overlay.querySelector('.mp-play-icon');
        const video = overlay.closest('.mp-video-col').querySelector('.mp-video');
        if (video.paused) {
          stopAllVideos(idx);
          video.muted = false;
          video.play().catch(() => {});
          icon.textContent = '⏸';
        } else {
          video.pause();
          icon.textContent = '▶';
        }
      });
    });

    // Audio button click — play with sound
    document.querySelectorAll('.mp-audio-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const audioEl = document.getElementById(btn.dataset.audio);
        if (!audioEl) return;

        if (currentAudio === audioEl && !audioEl.paused) {
          audioEl.pause();
          btn.textContent = '▶ Play Audio';
          currentAudio = null; currentAudioBtn = null;
          return;
        }

        stopAllAudio();
        currentAudio = audioEl;
        currentAudioBtn = btn;
        audioEl.play().then(() => {
          btn.textContent = '⏸ Pause';
        }).catch(() => {
          btn.textContent = '▶ (no file yet)';
        });
        audioEl.onended = () => {
          btn.textContent = '▶ Play Audio';
          currentAudio = null; currentAudioBtn = null;
        };
      });
    });

    // ── Easter egg trigger ────────────────────────────────────
    document.getElementById('easterTrigger')?.addEventListener('click', () => {
      openWindow('win-secret');
    });

    // ── Expose openWindow for external use ────────────────────
    window.openDesktopWindow = openWindow;

  })();

  /* ── Ambient desktop background canvas ──────────────────── */
  (function initAmbientCanvas() {
    const canvas = document.getElementById('deskBgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Very subtle grid — design-canvas feel, warm not sci-fi
      const step = 52;
      ctx.strokeStyle = 'rgba(200,180,140,0.045)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x < W; x += step) { ctx.moveTo(x,0); ctx.lineTo(x,H); }
      for (let y = 0; y < H; y += step) { ctx.moveTo(0,y); ctx.lineTo(W,y); }
      ctx.stroke();

      // Soft warm vignette at corners — "late night desk lamp" feel
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }

    draw();
    window.addEventListener('resize', draw, { passive: true });
  })();


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
     10. Hamburger nav toggle (mobile)
  ---------------------------------------------------------------- */
  const navHamburger = document.getElementById('navHamburger');
  const navRight = document.querySelector('.nav-right');

  navHamburger?.addEventListener('click', () => {
    const isOpen = navRight.classList.toggle('nav-open');
    navHamburger.classList.toggle('is-open', isOpen);
    navHamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close nav when any link inside it is clicked
  navRight?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navRight.classList.remove('nav-open');
      navHamburger?.classList.remove('is-open');
      navHamburger?.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  /* ----------------------------------------------------------------
     11. FIX 8 — Audio code removed.
  ---------------------------------------------------------------- */

  /* ================================================================
     12. LANGUAGE SELECTOR — Win98 dialog + full-site i18n
  ================================================================ */

  // ── Translation dictionary ─────────────────────────────────────
  const I18N = {
    en: {
      // NAV (handled via data-en on elements)
      // Page title
      pageTitle: "EDEWEISS'S PORTFOLIO — Jiajing Ding",
      // About pills
      pill1: 'Human-Centred Design',
      pill2: 'Creative Technology',
      // About bio
      aboutBio1: 'I am a second-year Interaction Design student at the University of Sydney, interested in <u class="neon-u">UI/UX, music, creative technology, and digital systems</u>.',
      aboutBio2: 'My work combines human-centred design with prototyping, sound interaction, environmental experiences, and responsive digital systems.',
      aboutBio3: 'I aim to design playful and emotionally engaging experiences across both digital and physical contexts.',
      aboutIntro: 'Alongside interaction design, I work with DAWs and Max/MSP to explore music production, sound interaction, and experimental creative coding systems.',
      aboutToolsH: 'DESIGN TOOLS',
      aboutInterestsH: 'MY INTERESTS :',
      interests: ['Sound Interaction','Sketching','Creative Coding','Environmental UX','Music + Digital Systems'],
      // Contents section
      contentsH: 'CONTENTS',
      // Experience
      expH: 'SELECTED EXPERIENCE',
      expSub: 'Early experience across media, design, events, and creative technology.',
      // Contact
      contactReady: 'READY TO<br>CONNECT?',
      connectBtn: "Let's Connect!",
      footer: '© Jiajing (Edeweiss) Ding · 2026 · Built with HTML / CSS / JS · pixel love',
      // Start menu
      startAbout: '📁 About',
      startProjects: '📁 Projects',
      startExperience: '⭐ Selected Experience',
      startContact: '✉ Contact',
      startShutdown: '⏻ Shut Down...',
      // Search placeholder (handled via data-placeholder-en)
      navLangLabel: 'EN',
      // Home tag
      homeTag: 'edeweiss@outlook.com',
    },
    zh: {
      pageTitle: 'EDEWEISS 作品集 — 丁嘉晶',
      pill1: '以人为本设计',
      pill2: '创意技术',
      aboutBio1: '我是悉尼大学交互设计专业二年级学生，专注于 <u class="neon-u">UI/UX、音乐、创意技术与数字系统</u>。',
      aboutBio2: '我的作品将以人为本的设计方法与原型制作、声音交互、环境体验和响应式数字系统相结合。',
      aboutBio3: '我致力于在数字与实体语境中设计富有趣味性和情感共鸣的体验。',
      aboutIntro: '除交互设计外，我使用 DAW 和 Max/MSP 探索音乐制作、声音交互与实验性创意编程系统。',
      aboutToolsH: '设计工具',
      aboutInterestsH: '我的兴趣：',
      interests: ['声音交互','手绘素描','创意编程','环境用户体验','音乐 + 数字系统'],
      contentsH: '目录',
      expH: '工作经历',
      expSub: '涵盖媒体、设计、活动与创意技术的早期实践经验。',
      contactReady: '准备好<br>联系我了吗？',
      connectBtn: '联系我！',
      footer: '© 丁嘉晶 (Edeweiss) · 2026 · HTML / CSS / JS 构建 · pixel love',
      startAbout: '📁 关于我',
      startProjects: '📁 项目',
      startExperience: '⭐ 工作经历',
      startContact: '✉ 联系方式',
      startShutdown: '⏻ 关机...',
      navLangLabel: '中',
      homeTag: 'edeweiss@outlook.com',
    }
  };

  // ── Apply language to the entire page ─────────────────────────
  function applyLanguage(lang) {
    const t = I18N[lang];
    const isZh = lang === 'zh';

    // html lang attribute + page title
    document.documentElement.lang = isZh ? 'zh-CN' : 'en';
    document.title = t.pageTitle;

    // ── Universal sweep: every element with data-en / data-zh ──
    // Uses innerHTML so <br>, <b>, <u> tags inside translations work correctly
    document.querySelectorAll('[data-en][data-zh]').forEach(el => {
      const val = el.dataset[lang];
      if (!val) return;
      // Use innerHTML only when the translation contains HTML tags
      if (val.includes('<') || val.includes('&')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    // ── data-placeholder-en / data-placeholder-zh on inputs ───
    document.querySelectorAll('[data-placeholder-en]').forEach(el => {
      el.placeholder = isZh
        ? (el.dataset.placeholderZh || '')
        : (el.dataset.placeholderEn || '');
    });

    // ── Nav lang toggle label ──────────────────────────────────
    const lbl = document.getElementById('navLangLabel');
    if (lbl) lbl.textContent = t.navLangLabel;

    // ── About pills ───────────────────────────────────────────
    const pills = document.querySelectorAll('.pill-purple');
    if (pills[0]) pills[0].textContent = t.pill1;
    if (pills[1]) pills[1].textContent = t.pill2;

    // ── About bio paragraphs ──────────────────────────────────
    const bioPara = document.querySelectorAll('.about-text p');
    if (bioPara[0]) bioPara[0].innerHTML = t.aboutBio1;
    if (bioPara[1]) bioPara[1].textContent = t.aboutBio2;
    if (bioPara[2]) bioPara[2].textContent = t.aboutBio3;

    // ── About intro ───────────────────────────────────────────
    const intro = document.querySelector('.about-intro');
    if (intro) intro.textContent = t.aboutIntro;

    // ── About side headings ───────────────────────────────────
    const sideHs = document.querySelectorAll('.side-h');
    if (sideHs[0]) sideHs[0].textContent = t.aboutToolsH;
    if (sideHs[1]) sideHs[1].textContent = t.aboutInterestsH;

    // ── Interests list ────────────────────────────────────────
    const intItems = document.querySelectorAll('.interests li');
    t.interests.forEach((txt, i) => { if (intItems[i]) intItems[i].textContent = txt; });

    // ── Contents heading ──────────────────────────────────────
    const contH = document.querySelector('.contents-h');
    if (contH) contH.textContent = t.contentsH;

    // ── Experience heading + sub ──────────────────────────────
    const expH = document.querySelector('.exp-h');
    if (expH) expH.textContent = t.expH;
    const expSub = document.querySelector('.exp-sub');
    if (expSub) expSub.textContent = t.expSub;

    // ── Contact ───────────────────────────────────────────────
    const readyH = document.querySelector('.ready-h');
    if (readyH) readyH.innerHTML = t.contactReady;
    const connBtn = document.querySelector('.connect-btn');
    if (connBtn) { connBtn.childNodes[0].textContent = t.connectBtn + ' '; }
    const footer = document.querySelector('.footer-note');
    if (footer) footer.textContent = t.footer;

    // ── Start menu items ──────────────────────────────────────
    const startItems = document.querySelectorAll('.start-menu li a');
    const startMap = [
      { href: '#about',      text: t.startAbout },
      { href: '#projects',   text: t.startProjects },
      { href: '#experience', text: t.startExperience },
      { href: '#contact',    text: t.startContact },
    ];
    startItems.forEach(a => {
      const match = startMap.find(m => a.getAttribute('href') === m.href);
      if (match) a.textContent = match.text;
      if (a.getAttribute('href') === 'mailto:edeweiss@outlook.com') a.textContent = t.startShutdown;
    });

    // ── Desktop icon labels ───────────────────────────────────
    const iconLabels = document.querySelectorAll('.icon-label');
    const iconMap = isZh
      ? ['关于', '项目', '联系']
      : ['About', 'Projects', 'Contact'];
    iconLabels.forEach((el, i) => { if (iconMap[i]) el.textContent = iconMap[i]; });

    // ── Home email tag ────────────────────────────────────────
    const homeTag = document.querySelector('.home-deco-right .home-tag');
    if (homeTag) homeTag.textContent = t.homeTag;
  }

  // ── Dialog logic ───────────────────────────────────────────────
  const langOverlay   = document.getElementById('langOverlay');
  const btnZh         = document.getElementById('btnZh');
  const btnEn         = document.getElementById('btnEn');
  const navLangToggle = document.getElementById('navLangToggle');

  let currentLang = 'en';

  function closeLangDialog(lang) {
    currentLang = lang;
    applyLanguage(lang);
    langOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Always lock scroll and show dialog on every page load — no skip
  document.body.style.overflow = 'hidden';

  // Block ALL pointer events behind the overlay (click, scroll, keyboard nav)
  // The overlay itself has pointer-events:all via CSS; body is locked via overflow:hidden
  // Extra: intercept any attempt to interact with content behind
  langOverlay.addEventListener('click', (e) => {
    // Only close if user clicked one of the two language buttons
    // Clicking the backdrop does nothing — forces a choice
    e.stopPropagation();
  });

  // Prevent keyboard Tab from reaching page content while dialog is open
  document.addEventListener('keydown', (e) => {
    if (langOverlay.classList.contains('hidden')) return;
    // Allow Tab/Shift+Tab only within the dialog buttons
    if (e.key === 'Tab') {
      const focusable = [btnZh, btnEn].filter(Boolean);
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    }
    // Block all other navigation keys (arrows, space, enter on page) except within dialog
    if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)) {
      if (!e.target.closest('#langDialog')) e.preventDefault();
    }
  }, true); // capture phase — fires before anything else

  // Focus first button when page loads so keyboard users can act immediately
  btnZh?.focus();

  btnZh?.addEventListener('click', () => closeLangDialog('zh'));
  btnEn?.addEventListener('click', () => closeLangDialog('en'));

  // Nav toggle button — switch between languages
  navLangToggle?.addEventListener('click', () => {
    const next = currentLang === 'en' ? 'zh' : 'en';
    closeLangDialog(next);
  });

  /* ================================================================
     14. SKETCHBOOK — lightbox + video hover
  ================================================================ */
  (function initSketchbook() {

    /* ── Lightbox data ──────────────────────────────────────── */
    const cells = [...document.querySelectorAll('#sbGrid .sb-cell')];
    let currentIdx = 0;

    const lb        = document.getElementById('sbLightbox');
    const lbMedia   = document.getElementById('sbLbMedia');
    const lbTitle   = document.getElementById('sbLbTitle');
    const lbMeta    = document.getElementById('sbLbMeta');
    const lbCounter = document.getElementById('sbLbCounter');
    const lbClose   = document.getElementById('sbLbClose');
    const lbPrev    = document.getElementById('sbLbPrev');
    const lbNext    = document.getElementById('sbLbNext');
    const lbBg      = document.getElementById('sbLbBackdrop');

    function showLightbox(idx) {
      currentIdx = ((idx % cells.length) + cells.length) % cells.length;
      const cell  = cells[currentIdx];
      const type  = cell.dataset.type;
      const src   = cell.dataset.src;
      const title = cell.dataset.title;
      const year  = cell.dataset.year;
      const med   = cell.dataset.medium;

      // Build media element
      lbMedia.innerHTML = '';
      if (type === 'video') {
        const v = document.createElement('video');
        v.src = src; v.controls = true; v.autoplay = true;
        v.muted = false; v.loop = true; v.playsinline = true;
        lbMedia.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = src; img.alt = title;
        lbMedia.appendChild(img);
      }

      lbTitle.textContent   = title;
      lbMeta.textContent    = `${year} · ${med}`;
      lbCounter.textContent = `${currentIdx + 1} / ${cells.length}`;

      lb.classList.add('active');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Update selected info bar
      const info = document.getElementById('sbSelectedInfo');
      if (info) info.textContent = `${title} — ${year}`;
    }

    function closeLightbox() {
      // Stop any video
      const v = lbMedia.querySelector('video');
      if (v) { v.pause(); v.src = ''; }
      lb.classList.remove('active');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function prevItem() { showLightbox(currentIdx - 1); }
    function nextItem() { showLightbox(currentIdx + 1); }

    // ── Cell interactions ────────────────────────────────────
    let lastCellClick = { idx: -1, t: 0 };

    cells.forEach((cell, i) => {
      // Single click = select
      cell.addEventListener('click', () => {
        const now = Date.now();
        cells.forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        const info = document.getElementById('sbSelectedInfo');
        if (info) info.textContent = `${cell.dataset.title} — ${cell.dataset.year} · ${cell.dataset.medium}`;

        // Double-click detection (within 350ms)
        if (lastCellClick.idx === i && now - lastCellClick.t < 350) {
          showLightbox(i);
          lastCellClick = { idx: -1, t: 0 };
        } else {
          lastCellClick = { idx: i, t: now };
        }
      });

      cell.addEventListener('dblclick', () => showLightbox(i));

      // Video hover play/pause
      const vid = cell.querySelector('video');
      if (vid) {
        cell.addEventListener('mouseenter', () => vid.play().catch(() => {}));
        cell.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
      }
    });

    // ── Lightbox controls ────────────────────────────────────
    lbClose?.addEventListener('click', closeLightbox);
    lbBg?.addEventListener('click', closeLightbox);
    lbPrev?.addEventListener('click', (e) => { e.stopPropagation(); prevItem(); });
    lbNext?.addEventListener('click', (e) => { e.stopPropagation(); nextItem(); });

    document.addEventListener('keydown', e => {
      if (!lb?.classList.contains('active')) return;
      if (e.key === 'Escape')      closeLightbox();
      if (e.key === 'ArrowLeft')  prevItem();
      if (e.key === 'ArrowRight') nextItem();
    });

  })();


})();