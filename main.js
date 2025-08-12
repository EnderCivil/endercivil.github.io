// main.js
// - Persistent audio control (bgAudio + audioToggle)
// - SPA-ish navigation for internal links (page-link) so audio keeps playing across pages
// - Bouncing background canvas (unchanged core) but works with SPA
// - Patch notes modal

(() => {
  // AUDIO: persistent player
  const audio = document.getElementById('bgAudio');
  const audioToggle = document.getElementById('audioToggle');

  // restore previous playback state
  const prevState = sessionStorage.getItem('bgAudioPlaying') === '1';
  if (prevState && audio) {
    // don't auto-play without user gesture in some browsers: show toggle in 'playing' visual but require an initial click if autoplay blocked
    try { audio.play().then(()=> { audioToggle.innerText = '⏸ Music'; audioToggle.setAttribute('aria-pressed','true'); sessionStorage.setItem('bgAudioPlaying','1'); }).catch(()=>{}); } catch(e){}
  }

  audioToggle?.addEventListener('click', () => {
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => {
        audioToggle.innerText = '⏸ Music'; audioToggle.setAttribute('aria-pressed','true'); sessionStorage.setItem('bgAudioPlaying','1');
      }).catch(()=> {
        // playback blocked — still set flagged so next user gesture works
        audioToggle.innerText = '▶ Music'; audioToggle.setAttribute('aria-pressed','false');
      });
    } else {
      audio.pause(); audioToggle.innerText = '▶ Music'; audioToggle.setAttribute('aria-pressed','false'); sessionStorage.setItem('bgAudioPlaying','0');
    }
  });

  // SPA navigation for internal same-origin links (page-link)
  async function loadPage(url, push = true) {
    try {
      const res = await fetch(url, {cache: 'no-store'});
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const newApp = doc.getElementById('app') || doc.body;
      const target = document.getElementById('app');
      if (newApp && target) {
        target.innerHTML = newApp.innerHTML;
        // run any inline initialization for new page
        if (url.endsWith('battles.html')) {
          // ensure battles.js is loaded (if not already)
          if (!window.__battlesLoaded) {
            const s = document.createElement('script');
            s.src = 'battles.js';
            s.onload = () => { window.__battlesLoaded = true; };
            document.body.appendChild(s);
          } else if (window.drawPreview) {
            // redraw if necessary
            window.drawPreview();
          }
        }
        // update history
        if (push) history.pushState({url}, '', url);
      } else {
        // fallback full navigation
        location.href = url;
      }
    } catch (err) {
      console.error('Page load failed, fallback to normal navigation', err);
      location.href = url;
    }
  }

  // intercept page-link clicks
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.page-link');
    if (a) {
      e.preventDefault();
      const url = a.getAttribute('href');
      // fade out then load
      document.body.style.transition = 'opacity .25s ease';
      document.body.style.opacity = 0;
      setTimeout(() => {
        loadPage(url).then(()=> {
          document.body.style.opacity = 1;
        });
      }, 240);
    }
  });

  // handle browser back/forward
  window.addEventListener('popstate', (ev) => {
    const url = (ev.state && ev.state.url) || location.pathname;
    loadPage(url, false);
  });

  // Patch notes modal
  (function patchModal() {
    const newsBtn = document.getElementById('newsBtn');
    const newsModal = document.getElementById('newsModal');
    const newsClose = document.getElementById('newsClose');
    newsBtn?.addEventListener('click', () => { newsModal.classList.remove('hidden'); newsModal.setAttribute('aria-hidden','false'); });
    newsClose?.addEventListener('click', () => { newsModal.classList.add('hidden'); newsModal.setAttribute('aria-hidden','true'); });
  })();

  // Bouncing background (full-screen)
  (function bouncingBackground() {
    const canvas = document.getElementById('bgBounce');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let DPR = devicePixelRatio || 1;

    function resize() {
      canvas.width = innerWidth * DPR;
      canvas.height = innerHeight * DPR;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function getTargets() {
      const selectors = ['.menu-btn', '.menu-header', '.version-badge', '.menu-footer', '.discord-btn'];
      const els = [];
      selectors.forEach(sel => document.querySelectorAll(sel).forEach(e => els.push(e)));
      return els;
    }

    const balls = [
      { x: 100, y: 160, r: 20, vx: 160, vy: 120, color: '#ff7f50' },
      { x: 260, y: 260, r: 22, vx: -140, vy: -100, color: '#6ce0ff' }
    ];

    let last = performance.now();
    function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);

      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
        if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }
        if (b.x + b.r > innerWidth) { b.x = innerWidth - b.r; b.vx *= -1; }
        if (b.y + b.r > innerHeight) { b.y = innerHeight - b.r; b.vy *= -1; }

        for (let j = i + 1; j < balls.length; j++) {
          const o = balls[j];
          const dx = o.x - b.x, dy = o.y - b.y;
          const dist = Math.hypot(dx, dy);
          const minD = b.r + o.r;
          if (dist < minD && dist > 0) {
            const nx = dx / dist, ny = dy / dist;
            const p = 2 * (b.vx * nx + b.vy * ny - o.vx * nx - o.vy * ny) / 2;
            b.vx -= p * nx; b.vy -= p * ny;
            o.vx += p * nx; o.vy += p * ny;
            const overlap = (minD - dist) / 2;
            b.x -= nx * overlap; b.y -= ny * overlap;
            o.x += nx * overlap; o.y += ny * overlap;
          }
        }

        const rects = getTargets().map(el => el.getBoundingClientRect());
        rects.forEach(r => {
          const cx = Math.max(r.left, Math.min(b.x, r.right));
          const cy = Math.max(r.top, Math.min(b.y, r.bottom));
          const dx = b.x - cx, dy = b.y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 < b.r * b.r) {
            const d = Math.sqrt(Math.max(1e-6, d2));
            const nx = dx / d, ny = dy / d;
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx;
            b.vy -= 2 * dot * ny;
            const push = (b.r - d) + 1;
            b.x += nx * push; b.y += ny * push;
          }
        });
      }

      for (const b of balls) {
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.stroke();
      }

      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  })();

})();
