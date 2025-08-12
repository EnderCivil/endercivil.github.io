// main.js
(() => {
  // patch notes modal
  const newsBtn = document.getElementById('newsBtn');
  const newsModal = document.getElementById('newsModal');
  const newsClose = document.getElementById('newsClose');
  newsBtn?.addEventListener('click', () => { newsModal.classList.remove('hidden'); newsModal.setAttribute('aria-hidden','false'); });
  newsClose?.addEventListener('click', () => { newsModal.classList.add('hidden'); newsModal.setAttribute('aria-hidden','true'); });

  // SPA-ish internal navigation: intercept .page-link clicks and fetch the page, replace #app
  async function loadPage(url, push=true){
    try {
      const res = await fetch(url, {cache:'no-store'});
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const newApp = doc.getElementById('app') || doc.body;
      if(newApp){
        document.getElementById('app').innerHTML = newApp.innerHTML;
        if(push) history.pushState({url},'',url);
        // ensure dynamic scripts (battles.js) run when needed: if path ends with battles.html, re-add script if not present
        if(url.endsWith('battles.html')){
          if(!window.__battlesLoaded){
            const s = document.createElement('script');
            s.src = 'battles.js';
            s.onload = ()=>{ window.__battlesLoaded = true; };
            document.body.appendChild(s);
          } else {
            // if already loaded, call drawPreview if present
            setTimeout(()=>{ if(window.drawPreview) window.drawPreview(); }, 30);
          }
        }
      } else {
        location.href = url;
      }
    } catch(e){
      console.error('loadPage failed', e);
      location.href = url;
    }
  }

  // intercept links
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a.page-link');
    if(a){
      ev.preventDefault();
      const url = a.getAttribute('href');
      document.body.style.transition = 'opacity .25s ease';
      document.body.style.opacity = 0;
      setTimeout(()=>{ loadPage(url).then(()=> document.body.style.opacity = 1); }, 220);
    }
  });

  // handle back/forward
  window.addEventListener('popstate', (ev)=> {
    const url = (ev.state && ev.state.url) || location.pathname;
    loadPage(url, false);
  });

  // bouncing background (viewport)
  (function bounce(){
    const canvas = document.getElementById('bgBounce');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = devicePixelRatio || 1;
    function resize(){ canvas.width = innerWidth * DPR; canvas.height = innerHeight * DPR; canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'; ctx.setTransform(DPR,0,0,DPR,0,0); }
    resize(); window.addEventListener('resize', resize);

    const balls = [
      {x:120,y:160,r:20,vx:160,vy:120,color:'#ff7f50'},
      {x:260,y:260,r:22,vx:-140,vy:-100,color:'#6ce0ff'}
    ];

    let last = performance.now();
    function step(now){
      const dt = Math.min(0.05,(now-last)/1000); last = now;
      ctx.clearRect(0,0,innerWidth,innerHeight);
      const rectEls = Array.from(document.querySelectorAll('.menu-btn, .menu-header, .version-badge, .menu-footer, .discord-btn')).map(e=>e.getBoundingClientRect());
      for(let i=0;i<balls.length;i++){
        const b = balls[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if(b.x-b.r<0){b.x=b.r;b.vx*=-1;} if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}
        if(b.x+b.r>innerWidth){b.x=innerWidth-b.r;b.vx*=-1;} if(b.y+b.r>innerHeight){b.y=innerHeight-b.r; b.vy*=-1;}
        for(let j=i+1;j<balls.length;j++){
          const o=balls[j]; const dx=o.x-b.x, dy=o.y-b.y; const dist=Math.hypot(dx,dy); const minD=b.r+o.r;
          if(dist<minD && dist>0){ const nx=dx/dist, ny=dy/dist; const p=2*(b.vx*nx + b.vy*ny - o.vx*nx - o.vy*ny)/2; b.vx-=p*nx; b.vy-=p*ny; o.vx+=p*nx; o.vy+=p*ny; const overlap=(minD-dist)/2; b.x-=nx*overlap; b.y-=ny*overlap; o.x+=nx*overlap; o.y+=ny*overlap; }
        }
        rectEls.forEach(r=>{
          const cx = Math.max(r.left, Math.min(b.x, r.right));
          const cy = Math.max(r.top, Math.min(b.y, r.bottom));
          const dx = b.x - cx, dy = b.y - cy; const d2 = dx*dx + dy*dy;
          if(d2 < b.r*b.r){ const d=Math.sqrt(Math.max(1e-6,d2)); const nx=dx/d, ny=dy/d; const dot = b.vx*nx + b.vy*ny; b.vx -= 2*dot*nx; b.vy -= 2*dot*ny; const push=(b.r-d)+1; b.x += nx*push; b.y += ny*push; }
        });
      }
      for(const b of balls){
        ctx.beginPath(); ctx.fillStyle = b.color; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.stroke();
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  })();

})();
