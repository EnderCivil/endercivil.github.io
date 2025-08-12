/* battles.js
  - editor UI + spawn preview + drag
  - start game: loading -> countdown -> physics battle
  - segmented & regular HP visualization & damage on collision
  - winner popup + exit buttons
  - mobile preview toggle + non-overlap spawn + max 10 balls
*/

(() => {
  // DOM
  const addBtn = document.getElementById('addBallBtn');
  const ballList = document.getElementById('ballList');
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
  const ballPanel = document.getElementById('ballPanel');
  const addBallBtn = document.getElementById('addBallBtn');

  // canvas setup & scale
  let DPR = devicePixelRatio || 1;
  function resizeCanvas() {
    const r = spawnCanvas.getBoundingClientRect();
    spawnCanvas.width = Math.max(300, r.width) * DPR;
    spawnCanvas.height = Math.max(200, r.height) * DPR;
    spawnCanvas.style.width = `${r.width}px`;
    spawnCanvas.style.height = `${r.height}px`;
    ctx = spawnCanvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);

  let ctx = null;
  resizeCanvas();

  // data model
  let balls = []; // {id,name,color,img,maxHP,hpType,regen,damage,x,y,r, currentHP or segments}
  let selectedIconTarget = null;
  let createdCount = 0;
  const MAX_BALLS = 10;

  // helpers
  const randColor = () => {
    const h = Math.floor(Math.random() * 360);
    const s = 65 + Math.floor(Math.random() * 20);
    return `hsl(${h} ${s}% 55%)`;
  };
  const uid = () => Math.random().toString(36).slice(2,9);

  // spawn position generator (non-overlapping)
  function randomSpawn(r) {
    const pw = spawnCanvas.clientWidth, ph = spawnCanvas.clientHeight;
    for (let tries = 0; tries < 200; tries++) {
      const x = Math.random() * (pw - 2*r) + r;
      const y = Math.random() * (ph - 2*r) + r;
      let ok = true;
      for (const b of balls) {
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < b.r + r + 6) { ok = false; break; }
      }
      if (ok) return {x,y};
    }
    // fallback: place near center
    return { x: pw/2 + (Math.random()*60-30), y: ph/2 + (Math.random()*60-30) };
  }

  // create ball
  function createBall() {
    if (balls.length >= MAX_BALLS) return;
    createdCount++;
    const id = uid();
    const name = `Ball ${createdCount}`;
    const color = randColor();
    const r = 20;
    const pos = randomSpawn(r);
    const b = {
      id, name, color, img: null,
      maxHP: 100, hpType: 'normal', regen: 0,
      damage: 10, x: pos.x, y: pos.y, r,
      alive: true,
      hpCur: 100,
      segments: 5
    };
    if (b.hpType === 'segmented') { b.segments = Math.max(1, Math.floor(b.maxHP)); b.hpCur = b.segments; }
    balls.push(b);
    renderBallCard(b);
    updateAddButton();
    drawPreview();
  }

  // update add button (limit)
  function updateAddButton() {
    if (balls.length >= MAX_BALLS) addBallBtn.disabled = true;
    else addBallBtn.disabled = false;
  }

  // render card
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
        <div class="name-row">
          <input class="name-input" value="${b.name}" data-id="${b.id}" />
        </div>
        <div class="controls-row">
          <div class="field">
            <label>HP:</label>
            <input class="small-input" type="number" value="${b.maxHP}" data-prop="maxHP" data-id="${b.id}" />
            <select class="small-input" data-prop="hpType" data-id="${b.id}">
              <option value="normal"${b.hpType==='normal'?' selected':''}>Normal</option>
              <option value="segmented"${b.hpType==='segmented'?' selected':''}>Segmented</option>
            </select>
            <span class="faq-dot" data-faq="hp">?</span>
          </div>
          <div class="field">
            <label>Regen/s:</label>
            <input class="small-input" type="number" value="${b.regen}" data-prop="regen" data-id="${b.id}" />
            <span class="faq-dot" data-faq="regen">?</span>
          </div>
          <div class="field">
            <label>Damage:</label>
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

    // name edit
    const nameInput = card.querySelector('.name-input');
    nameInput.addEventListener('input', e => { b.name = e.target.value; drawPreview(); });

    // props
    card.querySelectorAll('[data-prop]').forEach(inp => {
      inp.addEventListener('input', e => {
        const prop = e.target.getAttribute('data-prop');
        const val = e.target.value;
        if (prop === 'hpType') {
          b.hpType = val;
          if (val === 'segmented') { b.segments = Math.max(1, Math.floor(Number(b.maxHP) / 20) || 5); b.hpCur = b.segments; }
          else { b.hpCur = Number(b.maxHP); }
        } else {
          b[prop] = Number(val);
          if (prop === 'maxHP') {
            if (b.hpType === 'segmented') { b.segments = Math.max(1, Math.floor(Number(b.maxHP))); b.hpCur = b.segments; }
            else b.hpCur = Number(b.maxHP);
          }
        }
        drawPreview();
      });
    });

    // faq tooltips
    card.querySelectorAll('.faq-dot').forEach(d => {
      d.addEventListener('mouseenter', () => showFaq(d));
      d.addEventListener('mouseleave', hideFaq);
    });

    // icon picker
    card.querySelector('.icon-picker').addEventListener('click', () => {
      selectedIconTarget = b.id;
      iconModal.classList.remove('hidden');
      iconModal.setAttribute('aria-hidden','false');
      modalColor.value = colorToHex(b.color) || '#ff7f50';
      modalFile.value = '';
    });

    ballList.appendChild(card);
  }

  // FAQ popup
  let faqEl = null;
  function showFaq(dot) {
    hideFaq();
    const key = dot.getAttribute('data-faq');
    const text = {
      hp: 'Segmented HP: damage removes whole segments (no decimals). Normal HP: smooth numeric hitpoints.',
      regen: 'HP Regen: how much HP the ball regains per second.',
      damage: 'Damage: how much HP (or segments) this ball deals on impact.'
    }[key] || 'Info.';
    faqEl = document.createElement('div');
    faqEl.className = 'faq-popup';
    faqEl.style.position = 'absolute';
    faqEl.style.background = '#fff';
    faqEl.style.color = '#10202b';
    faqEl.style.padding = '8px 10px';
    faqEl.style.border = '1px solid #e5eef8';
    faqEl.style.borderRadius = '8px';
    faqEl.style.boxShadow = '0 8px 24px rgba(12,24,40,0.06)';
    faqEl.style.fontSize = '13px';
    faqEl.innerText = text;
    document.body.appendChild(faqEl);
    const r = dot.getBoundingClientRect();
    faqEl.style.left = (r.right + 8) + 'px';
    faqEl.style.top = (r.top - 4) + 'px';
  }
  function hideFaq(){ if (faqEl) { faqEl.remove(); faqEl = null; } }

  // modal (apply color or image)
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
      b.img = null;
      b.color = modalColor.value;
      updateIconPreview(b);
      drawPreview();
    }
    closeModal();
  });
  modalCancel.addEventListener('click', closeModal);
  function closeModal() { iconModal.classList.add('hidden'); selectedIconTarget = null; modalFile.value = ''; }

  function updateIconPreview(b) {
    const el = document.querySelector(`.icon-picker[data-id="${b.id}"] .icon-preview`);
    if (!el) return;
    if (b.img) {
      el.style.backgroundImage = `url(${b.img})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundColor = 'transparent';
    } else {
      el.style.backgroundImage = '';
      el.style.backgroundColor = b.color;
    }
  }

  // draw preview (arena white background, grid, balls + health)
  function drawPreview() {
    if (!ctx) ctx = spawnCanvas.getContext('2d');
    const cw = spawnCanvas.clientWidth;
    const ch = spawnCanvas.clientHeight;
    ctx.clearRect(0,0,spawnCanvas.width/DPR, spawnCanvas.height/DPR);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,cw,ch);

    // light grid
    ctx.strokeStyle = 'rgba(15,30,45,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 40) { ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,ch); ctx.stroke(); }
    for (let y = 0; y < ch; y += 40) { ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(cw,y+0.5); ctx.stroke(); }

    // draw balls
    balls.forEach(b => {
      // circle
      ctx.beginPath();
      ctx.fillStyle = b.color || '#bfbfbf';
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#e6eef6'; ctx.stroke();

      // image inside
      if (b.img) {
        const img = new Image();
        img.onload = () => {
          ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r-1, 0, Math.PI*2); ctx.clip();
          ctx.drawImage(img, b.x - b.r, b.y - b.r, b.r*2, b.r*2); ctx.restore();
        };
        img.src = b.img;
      }

      // name
      ctx.fillStyle = '#07202a'; ctx.font = '12px Inter, Arial'; ctx.textAlign='center';
      ctx.fillText(b.name, b.x, b.y + b.r + 14);

      // health bar
      const barW = Math.max(50, b.r * 3);
      const barH = 8;
      const bx = b.x - barW/2;
      const by = b.y + b.r + 18;
      ctx.fillStyle = '#e6eef6';
      ctx.fillRect(bx, by, barW, barH);
      if (b.hpType === 'segmented') {
        const seg = b.segments || Math.max(1, Math.floor(b.maxHP));
        const segW = Math.max(6, barW / seg);
        for (let i=0;i<seg;i++) {
          const fill = (i < b.hpCur) ? '#6ce0ff' : '#ffffff';
          ctx.fillStyle = fill;
          ctx.fillRect(bx + i*segW + 1, by + 1, segW - 2, barH - 2);
        }
      } else {
        const pct = Math.max(0, Math.min(1, (b.hpCur||0) / (b.maxHP||1)));
        // color gradient green -> yellow -> red
        const rcol = Math.floor(255 * (1 - pct));
        const gcol = Math.floor(200 * pct);
        ctx.fillStyle = `rgb(${rcol}, ${gcol}, 40)`;
        ctx.fillRect(bx + 1, by + 1, (barW - 2) * pct, barH - 2);
      }
      // border
      ctx.strokeStyle = '#cfeaf6'; ctx.strokeRect(bx, by, barW, barH);
    });
  }

  // convert CSS color to hex for modal color input
  function colorToHex(c) {
    if (!c) return '#ff7f50';
    if (c[0] === '#') return c;
    try {
      const ctx2 = document.createElement('canvas').getContext('2d');
      ctx2.fillStyle = c;
      return ctx2.fillStyle;
    } catch(e) { return '#ff7f50'; }
  }

  // dragging in preview (pointer capture)
  let dragging = null, dragOffset = {x:0,y:0};
  spawnCanvas.addEventListener('pointerdown', (e) => {
    const rect = spawnCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      const d = Math.hypot(b.x - x, b.y - y);
      if (d <= b.r + 6) {
        dragging = b;
        dragOffset.x = x - b.x; dragOffset.y = y - b.y;
        spawnCanvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  });
  spawnCanvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = spawnCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    dragging.x = Math.max(dragging.r, Math.min(spawnCanvas.clientWidth - dragging.r, x - dragOffset.x));
    dragging.y = Math.max(dragging.r, Math.min(spawnCanvas.clientHeight - dragging.r, y - dragOffset.y));
    drawPreview();
  });
  spawnCanvas.addEventListener('pointerup', (e) => {
    if (dragging) { spawnCanvas.releasePointerCapture(e.pointerId); dragging = null; }
  });

  // start game flow (loading -> countdown -> simulation)
  let simInterval = null;
  startBtn.addEventListener('click', () => {
    if (balls.length < 2) { alert('Need at least 2 balls to start.'); return; }
    // initialize stats, current HP
    balls.forEach(b => {
      b.alive = true;
      if (b.hpType === 'segmented') {
        b.segments = Math.max(1, Math.floor(b.maxHP));
        b.hpCur = b.segments;
      } else {
        b.hpCur = Number(b.maxHP) || 100;
      }
      // give initial random velocity
      b.vx = (Math.random() * 200 - 100);
      b.vy = (Math.random() * 200 - 100);
    });

    // show loading overlay
    overlay.classList.remove('hidden');
    overlay.style.pointerEvents = 'auto';
    countdownEl.classList.add('hidden');
    loadingText.innerText = 'Initializing...';
    // simulate a short load
    setTimeout(() => {
      loadingText.innerText = '';
      runCountdown(3, () => { overlay.classList.add('hidden'); startSimulation(); });
    }, 700);
  });

  function runCountdown(n, cb) {
    countdownEl.classList.remove('hidden');
    let count = n;
    countdownEl.innerText = count;
    countdownEl.style.opacity = 1;
    const tick = setInterval(() => {
      count--;
      if (count > 0) {
        animateNumber(count);
        countdownEl.innerText = count;
      } else {
        animateNumber('GO!');
        countdownEl.innerText = 'GO!';
        setTimeout(()=> {
          countdownEl.classList.add('hidden');
          clearInterval(tick);
          cb && cb();
        }, 700);
      }
    }, 900);
  }
  function animateNumber(txt) {
    countdownEl.innerText = txt;
    countdownEl.animate([
      { transform:'scale(1.4)', opacity:0 },
      { transform:'scale(1.0)', opacity:1 },
      { transform:'scale(0.85)', opacity:0.1 }
    ], { duration:700, easing:'ease-out' });
  }

  // simulation loop
  let last = 0;
  function startSimulation() {
    last = performance.now();
    simStep(last);
  }

  // collision cooldown map to avoid repeated damage each frame
  const pairCooldown = new Map();
  function pairKey(a,b){ return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`; }

  function simStep(now) {
    const dt = Math.min(0.04, (now - last)/1000);
    last = now;
    const w = spawnCanvas.clientWidth, h = spawnCanvas.clientHeight;

    // update positions
    for (const b of balls) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // bounds bounce
      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }
      if (b.x + b.r > w) { b.x = w - b.r; b.vx *= -1; }
      if (b.y + b.r > h) { b.y = h - b.r; b.vy *= -1; }
    }

    // ball collisions -> elastic + damage
    for (let i=0;i<balls.length;i++){
      const A = balls[i];
      if (!A.alive) continue;
      for (let j=i+1;j<balls.length;j++){
        const B = balls[j]; if (!B.alive) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const dist = Math.hypot(dx,dy);
        const minD = A.r + B.r;
        if (dist < minD && dist > 0) {
          // elastic response
          const nx = dx / dist, ny = dy / dist;
          const p = 2 * (A.vx*nx + A.vy*ny - B.vx*nx - B.vy*ny) / 2;
          A.vx -= p * nx; A.vy -= p * ny;
          B.vx += p * nx; B.vy += p * ny;
          // separate
          const overlap = (minD - dist) / 2;
          A.x -= nx * overlap; A.y -= ny * overlap;
          B.x += nx * overlap; B.y += ny * overlap;

          // damage once per cooldown
          const key = pairKey(A,B);
          const nowMs = performance.now();
          if (!pairCooldown.has(key) || nowMs - pairCooldown.get(key) > 250) {
            applyDamage(A, B);
            pairCooldown.set(key, nowMs);
          }
        }
      }
    }

    // regen
    for (const b of balls) {
      if (!b.alive) continue;
      if (b.hpType === 'segmented') { /* regen for segmented not implemented (could increase segments slowly) */ }
      else { if (b.regen) b.hpCur = Math.min(b.maxHP, b.hpCur + b.regen * dt); }
    }

    drawPreview();

    // check alive count
    const alive = balls.filter(b => b.alive);
    if (alive.length <= 1) {
      // stop simulation
      showWinner(alive[0] || null);
      return;
    }

    requestAnimationFrame(simStep);
  }

  function applyDamage(A, B) {
    // Both deal damage to the other on collision (symmetric)
    // A deals to B:
    deal(A, B);
    deal(B, A);
  }
  function deal(attacker, victim) {
    if (!victim.alive) return;
    const dmg = Number(attacker.damage) || 1;
    if (victim.hpType === 'segmented') {
      const loss = Math.max(1, Math.floor(dmg)); // damage subtracts segments
      victim.hpCur = Math.max(0, victim.hpCur - loss);
      if (victim.hpCur <= 0) victim.alive = false;
    } else {
      victim.hpCur = Math.max(0, victim.hpCur - dmg);
      if (victim.hpCur <= 0) victim.alive = false;
    }
  }

  // winner popup
  function showWinner(b) {
    // stop overlay
    overlay.classList.add('hidden');
    // show popup
    winnerPopup.classList.remove('hidden');
    winnerPopup.setAttribute('aria-hidden','false');
    if (!b) {
      winnerText.innerText = 'No winner';
      winnerIcon.style.background = '#fff';
    } else {
      winnerText.innerText = `${b.name} WON!`;
      if (b.img) {
        winnerIcon.style.backgroundImage = `url(${b.img})`;
        winnerIcon.style.backgroundSize = 'cover';
        winnerIcon.style.backgroundPosition = 'center';
      } else {
        winnerIcon.style.backgroundImage = '';
        winnerIcon.style.backgroundColor = b.color || '#ddd';
      }
    }
  }

  exitEditor.addEventListener('click', () => {
    winnerPopup.classList.add('hidden');
    // re-open editor: just redraw preview (we're already on editor)
    balls.forEach(bb => { bb.vx = bb.vy = 0; });
    drawPreview();
  });
  exitMenu.addEventListener('click', () => {
    location.href = 'index.html';
  });

  // start with two default balls
  createBall(); createBall();

  // hook add button
  addBtn.addEventListener('click', createBall);

  // update icon preview of all balls on change
  setInterval(() => {
    balls.forEach(updateIconPreview);
  }, 500);

  // helper: update icon preview (if card exists)
  function updateIconPreview(b) {
    const el = document.querySelector(`.icon-picker[data-id="${b.id}"] .icon-preview`);
    if (!el) return;
    if (b.img) {
      el.style.backgroundImage = `url(${b.img})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundColor = 'transparent';
    } else {
      el.style.backgroundImage = '';
      el.style.backgroundColor = b.color;
    }
  }

  // back button
  backBtn?.addEventListener('click', () => { document.body.style.opacity = 0; setTimeout(()=> location.href='index.html', 260); });

  // preview toggle (mobile)
  previewToggle?.addEventListener('click', () => {
    if (previewWrap.classList.contains('expanded')) {
      previewWrap.classList.remove('expanded');
      previewToggle.innerText = 'Preview ▸';
    } else {
      previewWrap.classList.add('expanded');
      previewToggle.innerText = 'Preview ▾';
    }
    resizeCanvas();
    drawPreview();
  });

  // ensure canvas ready
  resizeCanvas();
  drawPreview();

  // utility: prevent accidental deletion on small scrolls (fix reported bug)
  // nothing in this code deletes off scroll; ensure ballList scroll doesn't trigger create/delete events

  // wire modal apply/cancel previously set up
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
    closeIconModal();
  });
  modalCancel.addEventListener('click', closeIconModal);
  function closeIconModal(){ iconModal.classList.add('hidden'); selectedIconTarget = null; modalFile.value = ''; }

  // when icon-picker clicked we set selectedIconTarget to target id (handled in render)
  // but we must handle clicks that were attached earlier - ensure document-level handler to pick up dynamic items
  document.addEventListener('click', (e) => {
    const ip = e.target.closest('.icon-picker');
    if (ip) {
      const id = ip.getAttribute('data-id');
      if (!id) return;
      selectedIconTarget = id;
      iconModal.classList.remove('hidden');
      modalColor.value = '#ff7f50';
      modalFile.value = '';
    }
  });

  // expose drawPreview to global loop during simulation or editor
  window.drawPreview = drawPreview;

})();
