/* Cleaned & fixed battles.js
 - consistent variables
 - ensure canvas sizing before initial spawn
 - enforce MAX_BALLS
 - preview toggle only used on mobile (hidden via CSS on desktop)
 - start game: loading -> countdown -> simulation (damage applied, healthbars update, winner popup)
*/

(() => {
  // DOM refs
  const addBtn = document.getElementById('addBallBtn');
  const ballListEl = document.getElementById('ballList');
  const spawnCanvas = document.getElementById('spawnCanvas');
  const startBtn = document.getElementById('startGameBtn');
  const backBtn = document.getElementById('backBtn');
  const iconModal = document.getElementById('iconModal');
  const modalColor = document.getElementById('modalColor');
  const modalFile = document.getElementById('modalFile');
  const modalApply = document.getElementById('modalApply');
  const modalCancel = document.getElementById('modalCancel');
  const overlay = document.getElementById('gameOverlay');
  const loadingText = document.getElementById('loadingText');
  const countdownEl = document.getElementById('countdown');
  const winnerPopup = document.getElementById('winnerPopup');
  const winnerIcon = document.getElementById('winnerIcon');
  const winnerText = document.getElementById('winnerText');
  const exitEditor = document.getElementById('exitEditor');
  const exitMenu = document.getElementById('exitMenu');
  const previewToggle = document.getElementById('previewToggle');
  const previewWrap = document.getElementById('previewWrap');

  // canvas & scale
  let DPR = devicePixelRatio || 1;
  let ctx = null;
  function resizeCanvas() {
    const r = spawnCanvas.getBoundingClientRect();
    spawnCanvas.width = Math.max(300, Math.round(r.width)) * DPR;
    spawnCanvas.height = Math.max(200, Math.round(r.height)) * DPR;
    spawnCanvas.style.width = `${r.width}px`;
    spawnCanvas.style.height = `${r.height}px`;
    ctx = spawnCanvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', () => { resizeCanvas(); drawPreview(); });

  // data
  const MAX_BALLS = 10;
  let balls = []; // model
  let createdCount = 0;
  let selectedIconTarget = null;

  // helpers
  const uid = () => Math.random().toString(36).slice(2,9);
  const randColor = () => {
    const h = Math.floor(Math.random()*360);
    const s = 60 + Math.floor(Math.random()*25);
    return `hsl(${h} ${s}% 55%)`;
  };

  // spawn non-overlap
  function randomSpawn(r) {
    const pw = spawnCanvas.clientWidth, ph = spawnCanvas.clientHeight;
    for (let tries=0; tries<250; tries++) {
      const x = Math.random()*(pw-2*r)+r;
      const y = Math.random()*(ph-2*r)+r;
      let ok = true;
      for (const b of balls) if (Math.hypot(b.x-x,b.y-y) < b.r + r + 6) { ok = false; break; }
      if (ok) return {x,y};
    }
    return { x: Math.max(r, pw/2 + (Math.random()*60-30)), y: Math.max(r, ph/2 + (Math.random()*60-30)) };
  }

  // create ball
  function createBall() {
    if (balls.length >= MAX_BALLS) return;
    createdCount++;
    const id = uid();
    const name = `Ball ${createdCount}`;
    const r = 20;
    const pos = randomSpawn(r);
    const b = {
      id, name, color: randColor(), img: null,
      maxHP: 100, hpType: 'normal', regen: 0, damage: 10,
      x: pos.x, y: pos.y, r,
      alive: true, hpCur: 100, segments: 5
    };
    balls.push(b);
    renderBallCard(b);
    updateAddButton();
    drawPreview();
  }

  function updateAddButton(){
    addBtn.disabled = balls.length >= MAX_BALLS;
  }

  // render a card
  function renderBallCard(b) {
    const card = document.createElement('div');
    card.className = 'ball-card';
    card.dataset.id = b.id;
    card.innerHTML = `
      <button class="delete-btn" title="Delete">✕</button>
      <div class="icon-picker" data-id="${b.id}" title="Click to set color or upload image">
        <div class="icon-preview" style="background:${b.color};"></div>
      </div>
      <div class="card-main">
        <div class="name-row"><input class="name-input" value="${b.name}" data-id="${b.id}" /></div>
        <div class="controls-row">
          <div class="field"><label>HP:</label>
            <input class="small-input" type="number" value="${b.maxHP}" data-prop="maxHP" data-id="${b.id}" />
            <select class="small-input" data-prop="hpType" data-id="${b.id}">
              <option value="normal"${b.hpType==='normal'?' selected':''}>Normal</option>
              <option value="segmented"${b.hpType==='segmented'?' selected':''}>Segmented</option>
            </select>
            <span class="faq-dot" data-faq="hp">?</span>
          </div>
          <div class="field"><label>Regen/s:</label>
            <input class="small-input" type="number" value="${b.regen}" data-prop="regen" data-id="${b.id}" />
            <span class="faq-dot" data-faq="regen">?</span>
          </div>
          <div class="field"><label>Damage:</label>
            <input class="small-input" type="number" value="${b.damage}" data-prop="damage" data-id="${b.id}" />
            <span class="faq-dot" data-faq="damage">?</span>
          </div>
        </div>
      </div>
    `;

    // delete
    card.querySelector('.delete-btn').addEventListener('click', () => {
      const idx = balls.findIndex(x => x.id === b.id);
      if (idx >= 0) { balls.splice(idx,1); card.remove(); updateAddButton(); drawPreview(); }
    });

    // name input
    card.querySelector('.name-input').addEventListener('input', (e) => { b.name = e.target.value; drawPreview(); });

    // props
    card.querySelectorAll('[data-prop]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const p = e.target.getAttribute('data-prop');
        const val = e.target.value;
        if (p === 'hpType') {
          b.hpType = val;
          if (val === 'segmented') { b.segments = Math.max(1, Math.floor(Number(b.maxHP))); b.hpCur = b.segments; }
          else { b.hpCur = Number(b.maxHP); }
        } else {
          b[p] = Number(val);
          if (p === 'maxHP') {
            if (b.hpType === 'segmented') { b.segments = Math.max(1, Math.floor(Number(b.maxHP))); b.hpCur = b.segments; }
            else b.hpCur = Number(b.maxHP);
          }
        }
        drawPreview();
      });
    });

    // faq
    card.querySelectorAll('.faq-dot').forEach(d => {
      d.addEventListener('mouseenter', () => showFaq(d));
      d.addEventListener('mouseleave', hideFaq);
    });

    // icon-picker
    card.querySelector('.icon-picker').addEventListener('click', () => {
      selectedIconTarget = b.id;
      iconModal.classList.remove('hidden');
      modalColor.value = colorToHex(b.color) || '#ff7f50';
      modalFile.value = '';
    });

    ballListEl.appendChild(card);
    updateIconPreview(b);
  }

  // faq
  let faqEl = null;
  function showFaq(el) {
    hideFaq();
    const key = el.getAttribute('data-faq');
    const txt = { hp: 'Segmented removes whole segments. Normal is numeric HP.', regen: 'HP per second.', damage: 'Damage dealt on impact.' }[key] || 'Info';
    faqEl = document.createElement('div');
    faqEl.className = 'faq-popup';
    faqEl.style.position='absolute';
    faqEl.style.background='#fff'; faqEl.style.padding='8px 10px'; faqEl.style.border='1px solid #e5eef8'; faqEl.style.borderRadius='8px';
    faqEl.innerText = txt;
    document.body.appendChild(faqEl);
    const r = el.getBoundingClientRect();
    faqEl.style.left = (r.right + 8) + 'px';
    faqEl.style.top = (r.top - 4) + 'px';
  }
  function hideFaq(){ if (faqEl) { faqEl.remove(); faqEl = null; } }

  // modal apply
  modalApply.addEventListener('click', () => {
    if (!selectedIconTarget) return;
    const b = balls.find(x => x.id === selectedIconTarget);
    if (!b) return;
    const file = modalFile.files && modalFile.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => { b.img = reader.result; b.color = null; updateIconPreview(b); drawPreview(); };
      reader.readAsDataURL(file);
    } else {
      b.img = null; b.color = modalColor.value; updateIconPreview(b); drawPreview();
    }
    closeModal();
  });
  modalCancel.addEventListener('click', closeModal);
  function closeModal(){ iconModal.classList.add('hidden'); selectedIconTarget = null; modalFile.value = ''; }

  function updateIconPreview(b) {
    const el = document.querySelector(`.icon-picker[data-id="${b.id}"] .icon-preview`);
    if (!el) return;
    if (b.img) { el.style.backgroundImage = `url(${b.img})`; el.style.backgroundSize='cover'; el.style.backgroundPosition='center'; el.style.backgroundColor='transparent'; }
    else { el.style.backgroundImage=''; el.style.backgroundColor = b.color; }
  }

  // draw preview (grid, balls, health bars)
  function drawPreview() {
    if (!ctx) ctx = spawnCanvas.getContext('2d');
    const cw = spawnCanvas.clientWidth, ch = spawnCanvas.clientHeight;
    ctx.clearRect(0,0,spawnCanvas.width/DPR, spawnCanvas.height/DPR);
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,cw,ch);

    // grid
    ctx.strokeStyle = 'rgba(15,30,45,0.03)';
    ctx.lineWidth = 1;
    for (let x=0;x<cw;x+=40){ ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,ch); ctx.stroke(); }
    for (let y=0;y<ch;y+=40){ ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(cw,y+0.5); ctx.stroke(); }

    // balls
    balls.forEach(b=>{
      ctx.beginPath(); ctx.fillStyle = b.color || '#ccc'; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.lineWidth=2; ctx.strokeStyle = '#e6eef6'; ctx.stroke();
      if (b.img) {
        const img = new Image();
        img.onload = () => { ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,b.r-1,0,Math.PI*2); ctx.clip(); ctx.drawImage(img,b.x-b.r,b.y-b.r,b.r*2,b.r*2); ctx.restore(); };
        img.src = b.img;
      }
      ctx.fillStyle = '#07202a'; ctx.font='12px Inter, Arial'; ctx.textAlign='center';
      ctx.fillText(b.name, b.x, b.y + b.r + 14);

      // health bar
      const barW = Math.max(50, b.r*3), barH=8, bx=b.x-barW/2, by=b.y+b.r+18;
      ctx.fillStyle='#e6eef6'; ctx.fillRect(bx,by,barW,barH);
      if (b.hpType === 'segmented') {
        const seg = b.segments || Math.max(1, Math.floor(b.maxHP));
        const segW = Math.max(6, barW/seg);
        for (let i=0;i<seg;i++){
          ctx.fillStyle = (i < b.hpCur) ? '#6ce0ff' : '#ffffff';
          ctx.fillRect(bx + i*segW + 1, by + 1, segW - 2, barH - 2);
        }
      } else {
        const pct = Math.max(0, Math.min(1, (b.hpCur||0) / (b.maxHP||1)));
        const rcol = Math.floor(255*(1-pct)), gcol = Math.floor(200*pct);
        ctx.fillStyle = `rgb(${rcol}, ${gcol}, 40)`;
        ctx.fillRect(bx + 1, by + 1, (barW - 2) * pct, barH - 2);
      }
      ctx.strokeStyle = '#cfeaf6'; ctx.strokeRect(bx,by,barW,barH);
    });
  }

  // color helper
  function colorToHex(c) {
    if (!c) return '#ff7f50';
    if (c[0] === '#') return c;
    try { const ctx2 = document.createElement('canvas').getContext('2d'); ctx2.fillStyle = c; return ctx2.fillStyle; } catch(e){ return '#ff7f50'; }
  }

  // dragging
  let dragging=null, dragOff={x:0,y:0};
  spawnCanvas.addEventListener('pointerdown', (e) => {
    const rect = spawnCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (Math.hypot(b.x - x, b.y - y) <= b.r + 6) {
        dragging = b; dragOff.x = x - b.x; dragOff.y = y - b.y;
        spawnCanvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  });
  spawnCanvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = spawnCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    dragging.x = Math.max(dragging.r, Math.min(spawnCanvas.clientWidth - dragging.r, x - dragOff.x));
    dragging.y = Math.max(dragging.r, Math.min(spawnCanvas.clientHeight - dragging.r, y - dragOff.y));
    drawPreview();
  });
  spawnCanvas.addEventListener('pointerup', (e) => { if (dragging) { spawnCanvas.releasePointerCapture(e.pointerId); dragging=null; } });

  // Game simulation
  let simRunning = false;
  let last = 0;
  const pairCooldown = new Map();
  function pairKey(a,b){ return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`; }

  function startSimulation() {
    simRunning = true;
    last = performance.now();
    requestAnimationFrame(simLoop);
  }

  function simLoop(now) {
    const dt = Math.min(0.04, (now - last)/1000);
    last = now;
    const w = spawnCanvas.clientWidth, h = spawnCanvas.clientHeight;

    for (const b of balls) {
      if (!b.alive) continue;
      b.x += (b.vx || 0) * dt;
      b.y += (b.vy || 0) * dt;
      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }
      if (b.x + b.r > w) { b.x = w - b.r; b.vx *= -1; }
      if (b.y + b.r > h) { b.y = h - b.r; b.vy *= -1; }
    }

    // collisions & damage
    for (let i=0;i<balls.length;i++){
      const A = balls[i]; if (!A.alive) continue;
      for (let j=i+1;j<balls.length;j++){
        const B = balls[j]; if (!B.alive) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const dist = Math.hypot(dx,dy);
        const minD = A.r + B.r;
        if (dist < minD && dist > 0) {
          const nx = dx/dist, ny=dy/dist;
          const p = 2 * (A.vx*nx + A.vy*ny - B.vx*nx - B.vy*ny) / 2;
          A.vx -= p*nx; A.vy -= p*ny;
          B.vx += p*nx; B.vy += p*ny;
          const overlap = (minD - dist)/2;
          A.x -= nx*overlap; A.y -= ny*overlap;
          B.x += nx*overlap; B.y += ny*overlap;

          const key = pairKey(A,B);
          const nowMs = performance.now();
          if (!pairCooldown.has(key) || nowMs - pairCooldown.get(key) > 250) {
            applyDamage(A,B); pairCooldown.set(key, nowMs);
          }
        }
      }
    }

    // regen (normal HP only)
    for (const b of balls) {
      if (!b.alive) continue;
      if (b.hpType !== 'segmented' && b.regen) b.hpCur = Math.min(b.maxHP, b.hpCur + b.regen * dt);
    }

    drawPreview();

    const alive = balls.filter(x=>x.alive);
    if (alive.length <= 1) { simRunning = false; showWinner(alive[0] || null); return; }
    requestAnimationFrame(simLoop);
  }

  function applyDamage(A,B) {
    const dmgA = Number(A.damage) || 1;
    const dmgB = Number(B.damage) || 1;
    deal(A,B,dmgA); deal(B,A,dmgB);
  }
  function deal(attacker, victim, dmg) {
    if (!victim.alive) return;
    if (victim.hpType === 'segmented') {
      const loss = Math.max(1, Math.floor(dmg));
      victim.hpCur = Math.max(0, victim.hpCur - loss);
      if (victim.hpCur <= 0) victim.alive = false;
    } else {
      victim.hpCur = Math.max(0, victim.hpCur - dmg);
      if (victim.hpCur <= 0) victim.alive = false;
    }
  }

  // show winner
  function showWinner(b) {
    overlay.classList.add('hidden');
    winnerPopup.classList.remove('hidden');
    if (!b) { winnerText.innerText = 'No winner'; winnerIcon.style.background='#fff'; }
    else {
      winnerText.innerText = `${b.name} WON!`;
      if (b.img) { winnerIcon.style.backgroundImage = `url(${b.img})`; winnerIcon.style.backgroundSize='cover'; }
      else { winnerIcon.style.backgroundImage=''; winnerIcon.style.backgroundColor = b.color || '#ddd'; }
    }
  }

  exitEditor.addEventListener('click', () => {
    winnerPopup.classList.add('hidden');
    balls.forEach(bb => { bb.vx = bb.vy = 0; });
    drawPreview();
  });
  exitMenu.addEventListener('click', () => location.href = 'index.html');

  // Start button flow
  startBtn.addEventListener('click', () => {
    if (balls.length < 2) { alert('Need at least 2 balls to start.'); return; }
    // initialize stats & velocities
    balls.forEach(b => {
      b.alive = true;
      if (b.hpType === 'segmented') { b.segments = Math.max(1, Math.floor(b.maxHP)); b.hpCur = b.segments; }
      else b.hpCur = Number(b.maxHP) || 100;
      b.vx = (Math.random()*240 - 120);
      b.vy = (Math.random()*240 - 120);
    });

    overlay.classList.remove('hidden');
    loadingText.innerText = 'Initializing...';
    countdownEl.classList.add('hidden');

    // short init, then countdown
    setTimeout(() => {
      loadingText.innerText = '';
      runCountdown(3, () => { overlay.classList.add('hidden'); startSimulation(); });
    }, 600);
  });

  // countdown visuals
  function runCountdown(n, cb) {
    countdownEl.classList.remove('hidden');
    let count = n;
    countdownEl.innerText = count;
    const tick = setInterval(() => {
      count--;
      if (count > 0) { animateNumber(count); countdownEl.innerText = count; }
      else {
        animateNumber('GO!');
        countdownEl.innerText = 'GO!';
        setTimeout(()=> { countdownEl.classList.add('hidden'); clearInterval(tick); cb && cb(); }, 700);
      }
    }, 900);
  }
  function animateNumber(txt) {
    countdownEl.innerText = txt;
    countdownEl.animate([{ transform:'scale(1.4)', opacity:0 },{ transform:'scale(1.0)', opacity:1 },{ transform:'scale(0.85)', opacity:0.1 }], { duration:700, easing:'ease-out' });
  }

  // preview toggle (mobile only - element hidden on desktop by CSS)
  previewToggle?.addEventListener('click', () => {
    if (!previewWrap) return;
    previewWrap.classList.toggle('expanded');
    resizeCanvas(); drawPreview();
  });

  // back button
  backBtn?.addEventListener('click', () => { document.body.style.opacity = 0; setTimeout(()=> location.href='index.html', 260); });

  // ensure canvas ready then initialize defaults
  resizeCanvas();
  createBall(); createBall();
  updateAddButton();
  drawPreview();

  // Add ball button
  addBtn?.addEventListener('click', () => { createBall(); });

  // global click for icon pick (cards are dynamic)
  document.addEventListener('click', (e) => {
    const ip = e.target.closest('.icon-picker');
    if (ip) {
      const id = ip.getAttribute('data-id'); if (!id) return;
      selectedIconTarget = id;
      iconModal.classList.remove('hidden');
      modalColor.value = '#ff7f50';
      modalFile.value = '';
    }
  });

  // ensure icon updates periodically for safety
  setInterval(() => { balls.forEach(updateIconPreview); }, 600);

  // expose drawPreview (for debugging)
  window.drawPreview = drawPreview;
})();
