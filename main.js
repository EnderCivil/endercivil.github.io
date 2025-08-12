// main.js: news slider (fixed), full-screen bouncing balls that interact with menu elements, and page transitions

/* ---------- News Slider ---------- */
(() => {
  const track = document.getElementById('newsTrack');
  const items = track ? Array.from(track.children) : [];
  const prev = document.getElementById('newsPrev');
  const next = document.getElementById('newsNext');
  let index = 0;

  function updateTrack() {
    if (!track) return;
    track.style.width = `${items.length * 100}%`;
    items.forEach(it => it.style.width = `${100 / items.length}%`);
    track.style.transform = `translateX(-${index * (100 / items.length)}%)`;
  }
  window.addEventListener('load', updateTrack);
  window.addEventListener('resize', updateTrack);

  prev?.addEventListener('click', () => {
    index = (index - 1 + items.length) % items.length;
    updateTrack();
  });
  next?.addEventListener('click', () => {
    index = (index + 1) % items.length;
    updateTrack();
  });

  // auto-advance
  setInterval(() => {
    index = (index + 1) % items.length;
    updateTrack();
  }, 4200);
})();

/* ---------- Page link transitions ---------- */
document.querySelectorAll('.page-link').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    const url = this.href;
    document.body.style.transition = 'opacity .28s ease';
    document.body.style.opacity = 0;
    setTimeout(() => location.href = url, 300);
  });
});

/* ---------- Full-screen bouncing balls (background) ---------- */
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

  // targets to bounce off (dynamic query on each frame)
  function getTargets() {
    const selectors = ['.menu-btn', '.menu-header', '.news-viewport', '.version-badge', '.menu-footer', '.right-stage'];
    const els = [];
    selectors.forEach(sel => document.querySelectorAll(sel).forEach(e => els.push(e)));
    return els;
  }

  // initial balls
  const balls = [
    { x: 100, y: 140, r: 18, vx: 160, vy: 120, color: '#ff7f50' },
    { x: 260, y: 240, r: 22, vx: -140, vy: -100, color: '#6ce0ff' }
  ];

  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    // update
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // edges (entire viewport)
      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }
      if (b.x + b.r > innerWidth) { b.x = innerWidth - b.r; b.vx *= -1; }
      if (b.y + b.r > innerHeight) { b.y = innerHeight - b.r; b.vy *= -1; }

      // ball-ball collisions
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

      // collide with UI rects
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

    // draw
    for (const b of balls) {
      ctx.beginPath();
      ctx.fillStyle = b.color;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.stroke();
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
})();
