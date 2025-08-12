// battles.js
// Full battle page logic: editor, preview, simulation, weapons, warnings, and fixes.

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

  const weaponModal = document.getElementById('weaponModal');
  const weaponFile = document.getElementById('weaponFile');
  const weaponDamage = document.getElementById('weaponDamage');
  const weaponRot = document.getElementById('weaponRot');
  const weaponParry = document.getElementById('weaponParry');
  const weaponWidth = document.getElementById('weaponWidth');
  const weaponLength = document.getElementById('weaponLength');
  const weaponApply = document.getElementById('weaponApply');
  const weaponCancel = document.getElementById('weaponCancel');
  const weaponCanvas = document.getElementById('weaponCanvas');
  const weaponCtx = weaponCanvas.getContext('2d');

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
  const previewTitle = document.getElementById('previewTitle');

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

  // data model
  const MAX_BALLS = 10;
  let balls = []; // {id, name, color, img (dataURL), _imgObj, maxHP, hpType, regen, damage, x,y,r, hpCur, segments, speed, weapon}
  let createdCount = 0;
  let selectedIconTarget = null;
  let currentWeaponTarget = null; // ball id that weapon modal edits

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
      id, name, color: randColor(), img: null, _imgObj: null,
      maxHP: 100, hpType: 'normal', regen: 0, damage: 10,
      speed: 120,
      x: pos.x, y: pos.y, r,
      alive: true, hpCur: 100, segments: 5,
      weapon: {
        img: null, _imgObj: null, damage: 8, rotSpeed: 180, parry: 20, width: 10, length: 48, angle: 0
      }
    };
    balls.push(b);
    renderBallCard(b);
    updateAddButton();
    drawPreview();
  }

  function updateAddButton(){
    addBtn.disabled = balls.length >= MAX_BALLS;
  }

  // attribute warnings thresholds
  const WARN = {
    maxHP: 2000,
    damage: 800,
    speed: 1200,
    rotSpeed: 1200
  };

  function computeWarnings(b) {
    const warns = [];
    if (b.maxHP > WARN.maxHP) warns.push('HP');
    if (b.damage > WARN.damage) warns.push('Damage');
    if (b.speed > WARN.speed) warns.push('Speed');
    if (b.weapon && b.weapon.rotSpeed > WARN.rotSpeed) warns.push('Rotation Speed');
    return warns;
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
        <div class="name-row">
          <input class="name-input" value="${b.name}" data-id="${b.id}" />
          <span class="attr-warn" data-warn="${b.id}"></span>
        </div>
        <div class="controls-row">
          <div class="field"><label>HP:</label>
            <input class="small-input" type="number" value="${b.maxHP}" data-prop="maxHP" data-id="${b.id}" />
            <select class="small-input" data-prop="hpType" data-id="${b.id}">
              <option value="normal"${b.hpType==='normal'?' selected':''}>Normal</option>
              <option value="segmented"${b.hpType==='segmented'?' selected':''}>Segmented</option>
            </select>
            <input class="small-input" type="number" min="1" max="10" value="${b.segments}" data-prop="segments" data-id="${b.id}" style="width:70px;margin-left:6px;" />
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
          <div class="field"><label>Speed:</label>
            <input class="small-input" type="number" value="${b.speed}" data-prop="speed" data-id="${b.id}" />
            <span class="faq-dot" data-faq="speed">?</span>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="add-btn weapon-btn" data-id="${b.id}">Weapons</button>
        </div>

      </div>
    `;

    // delete
    card.querySelector('.delete-btn').addEventListener('click', () => {
      const idx = balls.findIndex(x => x.id === b.id);
      if (idx >= 0) {
        balls.splice(idx,1);
        card.remove();
        updateAddButton();
        drawPreview();
      }
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
          if (val === 'segmented') {
            b.segments = Math.max(1, Math.min(10, Math.floor(Number(b.segments || 5))));
            b.hpCur = b.segments;
          } else {
            b.hpCur = Number(b.maxHP);
          }
        } else if (p === 'segments') {
          let v = Math.floor(Number(val) || 1);
          if (v > 10) v = 10;
          if (v < 1) v = 1;
          b.segments = v;
          if (b.hpType === 'segmented') b.hpCur = b.segments;
          e.target.value = v;
        } else {
          b[p] = Number(val);
          if (p === 'maxHP') {
            if (b.hpType === 'segmented') { b.segments = Math.max(1, Math.min(10, Math.floor(Number(b.maxHP)))); b.hpCur = b.segments; }
            else b.hpCur = Number(b.maxHP);
          }
        }

        // cap segments to 10
        if (b.segments > 10) { b.segments = 10; }

        // compute warnings
        const warnSpan = document.querySelector(`.attr-warn[data-warn="${b.id}"]`);
        const warns = computeWarnings(b);
        warnSpan.innerText = warns.length ? `Excessive ${warns.join(', ')} can cause FPS issues` : '';
        warnSpan.style.color = warns.length ? 'var(--warn)' : '';

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

    // weapon button
    card.querySelector('.weapon-btn').addEventListener('click', () => {
      currentWeaponTarget = b.id;
      // populate modal with current weapon values
      const w = b.weapon || {img:null, damage:8, rotSpeed:180, parry:20, width:10, length:48};
      weaponDamage.value = w.damage || 8;
      weaponRot.value = w.rotSpeed || 180;
      weaponParry.value = w.parry || 20;
      weaponWidth.value = w.width || 10;
      weaponLength.value = w.length || 48;
      weaponFile.value = '';
      weaponModal.classList.remove('hidden');
      renderWeaponPreview(w);
    });

    ballListEl.appendChild(card);
    updateIconPreview(b);
    // compute warnings initially
    const warnSpan = document.querySelector(`.attr-warn[data-warn="${b.id}"]`);
    const warns = computeWarnings(b);
    warnSpan.innerText = warns.length ? `Excessive ${warns.join(', ')} can cause FPS issues` : '';
    warnSpan.style.color = warns.length ? 'var(--warn)' : '';
  }

  // FAQ popup
  let faqEl = null;
  function showFaq(dot) {
    hideFaq();
    const key = dot.getAttribute('data-faq');
    const text = {
      hp: 'Segmented HP removes whole segments per hit (no decimals). Normal HP is numeric with finer granularity.',
      regen: 'HP Regen is how much HP the ball regains per second (0 = no regen).',
      damage: 'Damage is how much HP (or segments) this ball deals when hitting another ball.',
      speed: 'Speed controls initial movement speed of the ball when the match starts.'
    }[key] || 'No info.';
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

  // MODAL: icon apply
  modalApply.addEventListener('click', () => {
    if (!selectedIconTarget) return;
    const b = balls.find(x => x.id === selectedIconTarget);
    if (!b) return;
    const file = modalFile.files && modalFile.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        b.img = reader.result;
        // cache Image object to avoid disappear bug
        b._imgObj = new Image();
        b._imgObj.src = b.img;
        b.color = null;
        updateIconPreview(b);
        drawPreview();
      };
      reader.readAsDataURL(file);
    } else {
      b.img = null;
      b._imgObj = null;
      b.color = modalColor.value;
      updateIconPreview(b);
      drawPreview();
    }
    closeIconModal();
  });
  modalCancel.addEventListener('click', closeIconModal);
  function closeIconModal(){ iconModal.classList.add('hidden'); selectedIconTarget = null; modalFile.value = ''; }

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

  // Draw preview (arena, grid, balls, healthbars, weapon preview on balls)
  function drawPreview() {
    if (!ctx) ctx = spawnCanvas.getContext('2d');
    const cw = spawnCanvas.clientWidth,
          ch = spawnCanvas.clientHeight;
    ctx.clearRect(0,0,spawnCanvas.width/DPR, spawnCanvas.height/DPR);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,cw,ch);

    // grid
    ctx.strokeStyle = 'rgba(15,30,45,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 40) { ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,ch); ctx.stroke(); }
    for (let y = 0; y < ch; y += 40) { ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(cw,y+0.5); ctx.stroke(); }

    // draw balls
    balls.forEach(b => {
      if (!b.alive) return;
      ctx.beginPath();
      ctx.fillStyle = b.color || '#bfbfbf';
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#e6eef6'; ctx.stroke();

      // image inside - use cached image if available
      if (b._imgObj) {
        const img = b._imgObj;
        if (img.complete) {
          ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,b.r-1,0,Math.PI*2); ctx.clip();
          ctx.drawImage(img, b.x - b.r, b.y - b.r, b.r*2, b.r*2); ctx.restore();
        }
      } else if (b.img) {
        // fallback: create and cache
        b._imgObj = new Image();
        b._imgObj.onload = () => { drawPreview(); };
        b._imgObj.src = b.img;
      }

      // name
      ctx.fillStyle = '#07202a'; ctx.font='12px Inter, Arial'; ctx.textAlign='center';
      ctx.fillText(b.name, b.x, b.y + b.r + 14);

      // health bar
      const barW = Math.max(50, b.r * 3);
      const barH = 8;
      const bx = b.x - barW/2;
      const by = b.y + b.r + 18;
      ctx.fillStyle = '#e6eef6';
      ctx.fillRect(bx, by, barW, barH);

      if (b.hpType === 'segmented') {
        const seg = Math.max(1, Math.min(10, b.segments || 5));
        const segW = Math.max(6, barW / seg);
        for (let i=0;i<seg;i++){
          const fill = (i < b.hpCur) ? '#6ce0ff' : '#ffffff';
          ctx.fillStyle = fill;
          ctx.fillRect(bx + i*segW + 1, by + 1, segW - 2, barH - 2);
        }
      } else {
        const pct = Math.max(0, Math.min(1, (b.hpCur||0) / (b.maxHP||1)));
        const rcol = Math.floor(255 * (1 - pct));
        const gcol = Math.floor(200 * pct);
        ctx.fillStyle = `rgb(${rcol}, ${gcol}, 40)`;
        ctx.fillRect(bx + 1, by + 1, (barW - 2) * pct, barH - 2);
      }
      ctx.strokeStyle = '#cfeaf6'; ctx.strokeRect(bx, by, barW, barH);

      // weapon preview on ball: draw simple rotated rectangle (tip)
      if (b.weapon) {
        const w = b.weapon;
        // update angle for visual only (small step)
        // but do not modify here — rotation updated by simulation when running
        const angle = w.angle || 0;
        const tipX = b.x + Math.cos(angle * Math.PI/180) * (b.r + (w.length || 48));
        const tipY = b.y + Math.sin(angle * Math.PI/180) * (b.r + (w.length || 48));
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(tipX, tipY);
        ctx.lineWidth = w.width || 8;
        ctx.strokeStyle = 'rgba(20,30,40,0.95)';
        ctx.stroke();

        // draw weapon sprite if present
        if (w._imgObj && w._imgObj.complete) {
          ctx.save();
          ctx.translate(tipX, tipY);
          ctx.rotate((angle) * Math.PI/180);
          const sw = (w.width || 10) * 1.5;
          const sh = (w.length || 48) * 1.0;
          ctx.drawImage(w._imgObj, -sw/2, -sh/2, sw, sh);
          ctx.restore();
        }
      }
    });
  }

  // color helper
  function colorToHex(c) {
    if (!c) return '#ff7f50';
    if (c[0] === '#') return c;
    try {
      const ctx2 = document.createElement('canvas').getContext('2d');
      ctx2.fillStyle = c;
      return ctx2.fillStyle;
    } catch(e) { return '#ff7f50'; }
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
    // hide editor and change preview label
    const editorMain = document.querySelector('.editor-area');
    if (editorMain) editorMain.classList.add('hidden');
    previewTitle.innerText = 'Battle Arena';

    // initialize velocities and weapon angles
    balls.forEach(b => {
      b.alive = true;
      if (b.hpType === 'segmented') { b.segments = Math.max(1, Math.min(10, Math.floor(b.segments || 5))); b.hpCur = b.segments; }
      else b.hpCur = Number(b.maxHP) || 100;

      // set velocities based on speed attribute (random direction)
      const angle = Math.random()*Math.PI*2;
      const sp = Number(b.speed) || 120;
      b.vx = Math.cos(angle) * sp;
      b.vy = Math.sin(angle) * sp;

      // ensure weapon angle exists
      if (b.weapon) {
        b.weapon.angle = b.weapon.angle || 0;
      }
    });

    simRunning = true;
    last = performance.now();
    requestAnimationFrame(simLoop);
  }

  function simLoop(now) {
    const dt = Math.min(0.04, (now - last)/1000);
    last = now;
    const w = spawnCanvas.clientWidth, h = spawnCanvas.clientHeight;

    // update pos
    for (const b of balls) {
      if (!b.alive) continue;
      b.x += (b.vx || 0) * dt;
      b.y += (b.vy || 0) * dt;

      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -1; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }
      if (b.x + b.r > w) { b.x = w - b.r; b.vx *= -1; }
      if (b.y + b.r > h) { b.y = h - b.r; b.vy *= -1; }
    }

    // update weapon rotation
    for (const b of balls) {
      if (!b.alive || !b.weapon) continue;
      const wpn = b.weapon;
      // rotation speed degrees/sec; direction preserved
      wpn.angle = (wpn.angle || 0) + (wpn.rotSpeed || 0) * dt;
      // keep angle in range
      if (wpn.angle > 360) wpn.angle -= 360;
      if (wpn.angle < -360) wpn.angle += 360;
    }

    // ball-ball collisions -> elastic + damage from impacts
    for (let i=0;i<balls.length;i++){
      const A = balls[i]; if (!A.alive) continue;
      for (let j=i+1;j<balls.length;j++){
        const B = balls[j]; if (!B.alive) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const dist = Math.hypot(dx,dy);
        const minD = A.r + B.r;
        if (dist < minD && dist > 0) {
          const nx = dx / dist, ny = dy / dist;
          const p = 2 * (A.vx*nx + A.vy*ny - B.vx*nx - B.vy*ny) / 2;
          A.vx -= p*nx; A.vy -= p*ny;
          B.vx += p*nx; B.vy += p*ny;
          const overlap = (minD - dist)/2;
          A.x -= nx*overlap; A.y -= ny*overlap;
          B.x += nx*overlap; B.y += ny*overlap;

          const key = pairKey(A,B);
          const nowMs = performance.now();
          if (!pairCooldown.has(key) || nowMs - pairCooldown.get(key) > 250) {
            // collisions deal base damage (as before)
            applyDamage(A,B);
            pairCooldown.set(key, nowMs);
          }
        }
      }
    }

    // weapon-weapon and weapon-ball interactions
    // For each weapon compute tip position and treat tip as circle; check collisions
    const toRemove = [];
    for (const A of balls) {
      if (!A.alive || !A.weapon) continue;
      const wA = A.weapon;
      const tipAx = A.x + Math.cos(wA.angle*Math.PI/180) * (A.r + wA.length);
      const tipAy = A.y + Math.sin(wA.angle*Math.PI/180) * (A.r + wA.length);

      // weapon hitting other balls
      for (const B of balls) {
        if (!B.alive || A.id === B.id) continue;
        // check tip distance to ball center
        const d = Math.hypot(tipAx - B.x, tipAy - B.y);
        if (d < (wA.width || 8) + B.r - 4) {
          // check parry by B's weapon if any
          const wB = B.weapon;
          if (wB) {
            // compute B's tip pos
            const tipBx = B.x + Math.cos(wB.angle*Math.PI/180) * (B.r + wB.length);
            const tipBy = B.y + Math.sin(wB.angle*Math.PI/180) * (B.r + wB.length);
            const weaponDist = Math.hypot(tipAx - tipBx, tipAy - tipBy);
            // if weapons collide nearby, chance to parry
            if (weaponDist < ( (wA.width||8) + (wB.width||8)) * 0.9) {
              // parry roll based on parry chance
              const roll = Math.random()*100;
              if (roll < Math.max(wA.parry||0, wB.parry||0)) {
                // parry -> reverse rotation of both weapons (simple)
                wA.rotSpeed = - (wA.rotSpeed || 180);
                wB.rotSpeed = - (wB.rotSpeed || 180);
                continue; // parry prevents damage this contact
              }
            }
          }
          // no parry -> apply weapon damage to B
          const dmg = Number(wA.damage) || 1;
          if (B.hpType === 'segmented') {
            const loss = Math.max(1, Math.floor(dmg));
            B.hpCur = Math.max(0, B.hpCur - loss);
            if (B.hpCur <= 0) B.alive = false;
          } else {
            B.hpCur = Math.max(0, B.hpCur - dmg);
            if (B.hpCur <= 0) B.alive = false;
          }
        }
      }
    }

    // regen
    for (const b of balls) {
      if (!b.alive) continue;
      if (b.hpType !== 'segmented' && b.regen) b.hpCur = Math.min(b.maxHP, b.hpCur + b.regen * dt);
    }

    // remove dead balls from arrays & DOM (disappear)
    for (let i = balls.length - 1; i >= 0; i--) {
      if (!balls[i].alive) {
        // remove DOM card
        const card = document.querySelector(`.ball-card[data-id="${balls[i].id}"]`);
        if (card) card.remove();
        balls.splice(i, 1);
      }
    }

    drawPreview();

    const alive = balls.filter(b => b.alive);
    if (alive.length <= 1) {
      // simulation end
      simRunning = false;
      overlay.classList.add('hidden');
      showWinner(alive[0] || null);
      return;
    }

    requestAnimationFrame(simLoop);
  }

  function applyDamage(A, B) {
    const dmgA = Number(A.damage) || 1;
    const dmgB = Number(B.damage) || 1;
    deal(A, B, dmgA);
    deal(B, A, dmgB);
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

  // winner popup
  function showWinner(b) {
    winnerPopup.classList.remove('hidden');
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
    // bring back editor
    const editorMain = document.querySelector('.editor-area');
    if (editorMain) editorMain.classList.remove('hidden');
    // stop movement
    balls.forEach(bb => { bb.vx = bb.vy = 0; });
    drawPreview();
  });
  exitMenu.addEventListener('click', () => location.href = 'index.html');

  // Start button flow (loading -> countdown -> run)
  startBtn.addEventListener('click', () => {
    if (balls.length < 2) { alert('Need at least 2 balls to start.'); return; }
    overlay.classList.remove('hidden');
    loadingText.innerText = 'Initializing...';
    countdownEl.classList.add('hidden');
    setTimeout(() => {
      loadingText.innerText = '';
      runCountdown(3, () => {
        overlay.classList.add('hidden');
        startSimulation();
      });
    }, 650);
  });

  function runCountdown(n, cb) {
    countdownEl.classList.remove('hidden');
    let count = n;
    countdownEl.innerText = count;
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

  // preview toggle (mobile)
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

  // weapon modal handlers
  function renderWeaponPreview(w) {
    weaponCtx.clearRect(0,0,weaponCanvas.width, weaponCanvas.height);
    const cx = weaponCanvas.width/2, cy = weaponCanvas.height/2;
    // draw ball
    weaponCtx.beginPath(); weaponCtx.fillStyle = '#6ce0ff'; weaponCtx.arc(cx, cy, 28, 0, Math.PI*2); weaponCtx.fill();
    // draw weapon as rotated rectangle at angle 0 for preview
    const angle = 0;
    const tipX = cx + Math.cos(angle) * (28 + (w.length||48));
    const tipY = cy + Math.sin(angle) * (28 + (w.length||48));
    weaponCtx.beginPath(); weaponCtx.moveTo(cx, cy); weaponCtx.lineTo(tipX, tipY);
    weaponCtx.lineWidth = w.width || 10; weaponCtx.strokeStyle = '#2b3b44'; weaponCtx.stroke();
    if (w._imgObj && w._imgObj.complete) {
      weaponCtx.save();
      weaponCtx.translate(tipX, tipY);
      weaponCtx.rotate(angle);
      const sw = (w.width || 10) * 1.5;
      const sh = (w.length || 48) * 1.0;
      weaponCtx.drawImage(w._imgObj, -sw/2, -sh/2, sw, sh);
      weaponCtx.restore();
    }
  }

  weaponFile.addEventListener('change', () => {
    const file = weaponFile.files && weaponFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // preview the selected image in preview canvas
      const img = new Image();
      img.onload = () => {
        // draw preview with temporary weapon object
        renderWeaponPreview({ _imgObj: img, width: Number(weaponWidth.value), length: Number(weaponLength.value) });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  weaponApply.addEventListener('click', () => {
    if (!currentWeaponTarget) { weaponModal.classList.add('hidden'); return; }
    const b = balls.find(x => x.id === currentWeaponTarget);
    if (!b) { weaponModal.classList.add('hidden'); return; }
    // set weapon fields
    const file = weaponFile.files && weaponFile.files[0];
    const w = b.weapon || {};
    w.damage = Number(weaponDamage.value) || 8;
    w.rotSpeed = Number(weaponRot.value) || 180;
    w.parry = Math.max(0, Math.min(100, Number(weaponParry.value) || 0));
    w.width = Number(weaponWidth.value) || 10;
    w.length = Number(weaponLength.value) || 48;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        w.img = reader.result;
        w._imgObj = new Image();
        w._imgObj.src = w.img;
        b.weapon = w;
        weaponModal.classList.add('hidden');
        drawPreview();
      };
      reader.readAsDataURL(file);
    } else {
      // no file, keep previous img if present
      if (!w._imgObj && !w.img) {
        // default sword asset '34.png' if none
        w.img = '34.png';
        w._imgObj = new Image();
        w._imgObj.src = w.img;
      }
      b.weapon = w;
      weaponModal.classList.add('hidden');
      drawPreview();
    }
  });

  weaponCancel.addEventListener('click', () => {
    weaponModal.classList.add('hidden');
    currentWeaponTarget = null;
  });

  // global click for icon pick and weapon button etc
  document.addEventListener('click', (e) => {
    const ip = e.target.closest('.icon-picker');
    if (ip) {
      const id = ip.getAttribute('data-id');
      if (!id) return;
      selectedIconTarget = id;
      iconModal.classList.remove('hidden');
      const b = balls.find(x => x.id === id);
      modalColor.value = colorToHex(b && b.color) || '#ff7f50';
      modalFile.value = '';
    }
    // weapon buttons handled earlier (card rendered attaches handler)
  });

  // modalIcon apply behaviour (already above) - repeated for safety
  modalApply.addEventListener('click', () => {
    if (!selectedIconTarget) return;
    const b = balls.find(x => x.id === selectedIconTarget);
    if (!b) return;
    const file = modalFile.files && modalFile.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        b.img = reader.result;
        b._imgObj = new Image();
        b._imgObj.src = b.img;
        b.color = null;
        updateIconPreview(b);
        drawPreview();
      };
      reader.readAsDataURL(file);
    } else {
      b.img = null;
      b._imgObj = null;
      b.color = modalColor.value;
      updateIconPreview(b);
      drawPreview();
    }
    closeIconModal();
  });

  // ensure icon updates periodically
  setInterval(() => { balls.forEach(updateIconPreview); }, 800);

  // expose drawPreview for SPA loader or debug
  window.drawPreview = drawPreview;

})();
