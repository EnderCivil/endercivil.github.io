// Main menu interactions: news slider + bouncing balls interacting with menu elements + page transitions

/* ----- News Slider ----- */
const newsItems = Array.from(document.querySelectorAll(".news-item")) || [];
const track = document.getElementById("newsTrack");
const prevBtn = document.getElementById("newsPrev");
const nextBtn = document.getElementById("newsNext");
let newsIndex = 0;
const showNews = (i) => {
  const w = track.clientWidth;
  track.style.transform = `translateX(-${i * 100}%)`;
};
prevBtn?.addEventListener("click", () => {
  newsIndex = (newsIndex - 1 + newsItems.length) % newsItems.length;
  showNews(newsIndex);
});
nextBtn?.addEventListener("click", () => {
  newsIndex = (newsIndex + 1) % newsItems.length;
  showNews(newsIndex);
});
// auto advance
setInterval(() => { newsIndex = (newsIndex + 1) % newsItems.length; showNews(newsIndex); }, 4200);
window.addEventListener("resize", () => showNews(newsIndex));

/* ----- Page transition on links ----- */
document.querySelectorAll(".page-link").forEach(link => {
  link.addEventListener("click", function(e) {
    e.preventDefault();
    const url = this.getAttribute("href");
    document.body.style.opacity = 0;
    setTimeout(() => window.location.href = url, 380);
  });
});

/* ----- Bouncing balls in right stage that interact with menu elements ----- */
(function initBouncingBalls() {
  const canvas = document.getElementById("menuCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  const ctx = canvas.getContext("2d");
  ctx.scale(devicePixelRatio, devicePixelRatio);

  // elements to collide with (menu buttons + version badge)
  const collisionTargets = [];
  const menuBtns = document.querySelectorAll(".menu-btn");
  menuBtns.forEach(el => collisionTargets.push(el));
  const versionEl = document.getElementById("versionBadge");
  if (versionEl) collisionTargets.push(versionEl);

  // Ball data
  const balls = [
    { x: 60, y: 60, r: 16, vx: 180, vy: 140, color: '#ff7f50' },
    { x: 160, y: 130, r: 20, vx: -150, vy: -110, color: '#6ce0ff' }
  ];

  // utility: get target rect in canvas coords
  function targetRects() {
    return collisionTargets.map(el => {
      const r = el.getBoundingClientRect();
      const stageRect = canvas.getBoundingClientRect();
      return {
        el,
        left: r.left - stageRect.left,
        top: r.top - stageRect.top,
        right: r.right - stageRect.left,
        bottom: r.bottom - stageRect.top,
        width: r.width,
        height: r.height
      };
    });
  }

  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // clear
    ctx.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);

    // update & draw balls
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // stage bounds
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx *= -1; }
      if (b.y + b.r > H) { b.y = H - b.r; b.vy *= -1; }

      // ball-ball collision simple
      for (let j = i + 1; j < balls.length; j++) {
        const o = balls[j];
        const dx = o.x - b.x, dy = o.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minD = b.r + o.r;
        if (dist < minD && dist > 0) {
          // basic elastic collision
          const nx = dx / dist, ny = dy / dist;
          const p = 2 * (b.vx * nx + b.vy * ny - o.vx * nx - o.vy * ny) / 2;
          b.vx = b.vx - p * nx;
          b.vy = b.vy - p * ny;
          o.vx = o.vx + p * nx;
          o.vy = o.vy + p * ny;
          // separate overlap
          const overlap = (minD - dist) / 2;
          b.x -= nx * overlap; b.y -= ny * overlap;
          o.x += nx * overlap; o.y += ny * overlap;
        }
      }

      // collisions with menu elements (rect bounce)
      const rects = targetRects();
      rects.forEach(tr => {
        // closest point on rect to circle center
        const cx = Math.max(tr.left, Math.min(b.x, tr.right));
        const cy = Math.max(tr.top, Math.min(b.y, tr.bottom));
        const dx = b.x - cx, dy = b.y - cy;
        const d2 = dx*dx + dy*dy;
        if (d2 < b.r*b.r) {
          // reflect velocity based on collision normal
          const d = Math.sqrt(Math.max(1e-6, d2));
          const nx = dx / d, ny = dy / d;
          const dot = b.vx*nx + b.vy*ny;
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
          // push out
          const push = (b.r - d) + 1;
          b.x += nx * push;
          b.y += ny * push;
        }
      });

      // draw
      ctx.beginPath();
      ctx.fillStyle = b.color;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();

      // highlight bounce ring
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

  // resize handling
  const resizeObserver = new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * devicePixelRatio;
    canvas.height = r.height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  });
  resizeObserver.observe(canvas);
})();
