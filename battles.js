// battles.js — updated: fixes + powerups + zone visuals + weapon toggles + robust start/end
(() => {
  // DOM refs
  const addBtn = document.getElementById('addBallBtn');
  const ballListEl = document.getElementById('ballList');
  const spawnCanvas = document.getElementById('spawnCanvas');
  const startBtn = document.getElementById('startGameBtn');
  const endBtn = document.getElementById('endGameBtn');
  const backBtn = document.getElementById('backBtn');
  const iconModal = document.getElementById('iconModal');
  const modalColor = document.getElementById('modalColor');
  const modalFile = document.getElementById('modalFile');
  const modalApply = document.getElementById('modalApply');
  const modalCancel = document.getElementById('modalCancel');

  // weapon modal refs
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

  const selBalls = document.getElementById('selBalls');
  const selZone = document.getElementById('selZone');
  const selPowerups = document.getElementById('selPowerups');
  const ballPanel = document.getElementById('ballPanel');
  const zonePanel = document.getElementById('zonePanel');
  const powerupsPanel = document.getElementById('powerupsPanel');

  // zone inputs
  const zoneStart = document.getElementById('zoneStart');
  const zoneSpawnDelay = document.getElementById('zoneSpawnDelay'); // spawn visibility delay
  const zoneDelay = document.getElementById('zoneDelay');
  const zoneDuration = document.getElementById('zoneDuration');
  const zoneDPS = document.getElementById('zoneDPS');
  const zoneDamageDelay = document.getElementById('zoneDamageDelay');

  // powerups DOM
  const addPowerupBtn = document.getElementById('addPowerupBtn');
  const powerupListEl = document.getElementById('powerupList');

  // defensive: stop main bounce if it's running (covers direct load)
  if (window.bgBounceController && typeof window.bgBounceController.stop === 'function') {
    window.bgBounceController.stop();
  }

  // canvas & scale
  let DPR = devicePixelRatio || 1;
  let ctx = null;
  function resizeCanvas(){
    if (!spawnCanvas) return;
    const r = spawnCanvas.getBoundingClientRect();
    spawnCanvas.width = Math.max(320, Math.round(r.width)) * DPR;
    spawnCanvas.height = Math.max(240, Math.round(r.height)) * DPR;
    spawnCanvas.style.width = `${r.width}px`;
    spawnCanvas.style.height = `${r.height}px`;
    ctx = spawnCanvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', ()=>{ resizeCanvas(); drawPreview(); });

  // data model
  const MAX_BALLS = 10;
  let balls = [];
  let powerups = [];
  let selectedIconTarget = null;
  let currentWeaponTarget = null;

  let rafId = null;

  const WARN = { maxHP:2000, damage:800, speed:1200, rotSpeed:1200 };

  // zone runtime state
  let zone = {
    startPct:100, spawnDelay:1, delay:8, duration:30, dps:4, damageDelay:0.5,
    centerX:0.5, centerY:0.5, running:false, startTime:0, visible:false
  };

  // helpers
  const uid = ()=> Math.random().toString(36).slice(2,9);

  function getNextBallNumber(){
    const used = new Set();
    for(const b of balls){
      const m = (b.name || '').match(/^Ball\s+(\d+)$/);
      if(m) used.add(Number(m[1]));
    }
    for(let i=1;;i++){ if(!used.has(i)) return i; }
  }

  const defaultWeaponPreset = 'https://raw.githubusercontent.com/EnderCivil/endercivil.github.io/main/34.png';

  function randColor(){ const h = Math.floor(Math.random()*360); const s = 60 + Math.floor(Math.random()*25); return `hsl(${h} ${s}% 55%)`; }

  function randomSpawn(r){
    const pw = spawnCanvas.clientWidth, ph = spawnCanvas.clientHeight;
    for(let tries=0;tries<300;tries++){
      const x = Math.random()*(pw-2*r)+r;
      const y = Math.random()*(ph-2*r)+r;
      let ok=true;
      for(const b of balls) if(Math.hypot(b.x-x,b.y-y) < b.r + r + 6){ ok=false; break; }
      if(ok) return {x,y};
    }
    return { x: Math.max(r,pw/2 + (Math.random()*60-30)), y: Math.max(r, ph/2 + (Math.random()*60-30)) };
  }

  // create ball (name uses smallest available Ball N)
  function createBall(){
    if(balls.length >= MAX_BALLS) return;
    const id = uid();
    const name = `Ball ${getNextBallNumber()}`;
    const r = 20;
    const pos = (spawnCanvas && spawnCanvas.clientWidth) ? randomSpawn(r) : { x: 40 + balls.length*60, y: 80 + balls.length*40 };
    const b = {
      id, name, color: randColor(), img:null, _imgObj:null,
      maxHP:100, hpType:'normal', regen:0, damage:10, speed:120,
      x: pos.x, y: pos.y, r,
      alive:true, defeated:false, hpCur:100, segments:5,
      weaponEnabled: false,
      weapon: { img: defaultWeaponPreset, _imgObj: new Image(), damage:8, rotSpeed:180, parry:20, width:10, length:48, angle:0 }
    };
    b.weapon._imgObj.src = b.weapon.img;
    balls.push(b);
    renderBallCard(b);
    updateAddButton();
    drawPreview();
  }

  function updateAddButton(){ if(addBtn) addBtn.disabled = balls.length >= MAX_BALLS; }

  function computeWarnings(b){
    const warns = [];
    if(b.maxHP > WARN.maxHP) warns.push('HP');
    if(b.damage > WARN.damage) warns.push('Damage');
    if(b.speed > WARN.speed) warns.push('Speed');
    if(b.weapon && b.weapon.rotSpeed > WARN.rotSpeed) warns.push('Rotation Speed');
    return warns;
  }

  // render ball card with weapon toggle
  function renderBallCard(b){
    // preserve existing card if it exists
    let card = document.querySelector(`.ball-card[data-id="${b.id}"]`);
    if(card) return; // already rendered (prevents duplicates)

    card = document.createElement('div');
    card.className = 'ball-card';
    card.dataset.id = b.id;
    // use details / simple structure; UI styling handled by CSS you already have
    card.innerHTML = `
      <button class="delete-btn" title="Delete">✕</button>
      <div class="icon-picker" data-id="${b.id}" title="Click to set color or upload image">
        <div class="icon-preview" style="background:${b.color}; width:48px;height:48px;border-radius:8px; display:inline-block;"></div>
      </div>
      <div class="card-main">
        <div class="name-row" style="display:flex;gap:8px;align-items:center;">
          <input class="name-input" value="${b.name}" data-id="${b.id}" />
          <span class="attr-warn" data-warn="${b.id}" style="font-size:12px;color:var(--warn)"></span>
        </div>

        <div class="controls-row" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
          <div class="field"><label>HP:</label>
            <input class="small-input" type="number" value="${b.maxHP}" data-prop="maxHP" data-id="${b.id}" />
            <select class="small-input" data-prop="hpType" data-id="${b.id}">
              <option value="normal"${b.hpType==='normal'?' selected':''}>Normal</option>
              <option value="segmented"${b.hpType==='segmented'?' selected':''}>Segmented</option>
            </select>
            <input class="small-input" type="number" min="1" max="10" value="${b.segments}" data-prop="segments" data-id="${b.id}" style="width:68px;margin-left:6px;" />
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

        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
          <div class="toggle ${b.weaponEnabled ? 'on' : ''}" data-toggle="${b.id}" style="cursor:pointer;">
<label class="switch">
  <input type="checkbox">
  <span class="slider round"></span>
</label>
          </div>
          <div style="font-size:13px;color:#24343e;font-weight:700;">Weapon</div>
          <button class="weapon-btn" data-id="${b.id}">Weapons</button>
          <div style="flex:1;"></div>
        </div>

        <div style="margin-top:8px;"><small class="defeated-label" data-def="${b.id}" style="color:#b33;display:none">DEFEATED</small></div>
      </div>
    `;
    // attach
    ballListEl.appendChild(card);

    // delete handler
    card.querySelector('.delete-btn').addEventListener('click', ()=>{
      const idx = balls.findIndex(x=>x.id===b.id);
      if(idx>=0){
        balls.splice(idx,1);
        // remove card
        card.remove();
        updateAddButton();
        drawPreview();
      }
    });

    // name input
    card.querySelector('.name-input').addEventListener('input', (e)=>{ b.name = e.target.value; drawPreview(); });

    // props binding
    card.querySelectorAll('[data-prop]').forEach(inp=>{
      inp.addEventListener('input', (e)=>{
        const p = e.target.getAttribute('data-prop');
        let val = e.target.value;
        if(p === 'hpType'){
          b.hpType = val;
          if(val === 'segmented'){ b.segments = Math.max(1, Math.min(10, Math.floor(Number(b.segments||5)))); b.hpCur = b.segments; }
          else { b.hpCur = Number(b.maxHP); }
        } else if(p === 'segments'){
          let v = Math.floor(Number(val) || 1);
          v = Math.max(1, Math.min(10, v));
          b.segments = v;
          if(b.hpType==='segmented') b.hpCur = b.segments;
          e.target.value = v;
        } else {
          b[p] = Number(val);
          if(p === 'maxHP'){ if(b.hpType==='segmented'){ b.segments = Math.max(1, Math.min(10, Math.floor(Number(b.maxHP)))); b.hpCur = b.segments; } else b.hpCur = Number(b.maxHP); }
        }
        // warnings UI
        const warnSpan = document.querySelector(`.attr-warn[data-warn="${b.id}"]`);
        const warns = computeWarnings(b);
        warnSpan.innerText = warns.length ? `Excessive ${warns.join(', ')} can cause FPS issues` : '';
        warnSpan.style.color = warns.length ? 'var(--warn)' : '';
        drawPreview();
      });
    });

    // faq popups
    card.querySelectorAll('.faq-dot').forEach(d=>{ d.addEventListener('mouseenter', ()=>showFaq(d)); d.addEventListener('mouseleave', hideFaq); });

    // icon picker
    card.querySelector('.icon-picker').addEventListener('click', ()=>{ selectedIconTarget = b.id; iconModal.classList.remove('hidden'); modalFile.value=''; modalColor.value = colorToHex(b.color) || '#ff7f50'; });

    // weapon toggle + enable/disable weapon button
    const toggle = card.querySelector(`.toggle[data-toggle="${b.id}"]`);
    const weaponBtn = card.querySelector(`.weapon-btn[data-id="${b.id}"]`);
    function setWeaponState(enabled){
      b.weaponEnabled = !!enabled;
      if(enabled){ toggle.classList.add('on'); weaponBtn.disabled = false; }
      else { toggle.classList.remove('on'); weaponBtn.disabled = true; }
    }
    setWeaponState(b.weaponEnabled);
    toggle.addEventListener('click', ()=>{
      setWeaponState(!b.weaponEnabled);
    });

    // open weapon modal
    weaponBtn.addEventListener('click', ()=>{
      if(weaponBtn.disabled) return;
      currentWeaponTarget = b.id;
      const w = b.weapon || {};
      weaponDamage.value = w.damage || 8;
      weaponRot.value = w.rotSpeed || 180;
      weaponParry.value = w.parry || 20;
      weaponWidth.value = w.width || 10;
      weaponLength.value = w.length || 48;
      weaponFile.value = '';
      weaponModal.classList.remove('hidden');
      renderWeaponPreview(w);
    });
  }

  // FAQ popup
  let faqEl = null;
  function showFaq(dot){ hideFaq(); const key = dot.getAttribute('data-faq'); const text = { hp:'Segmented HP = whole segments lost per hit. Normal = numeric HP.', regen:'HP per second regen', damage:'Damage dealt on hit', speed:'Movement speed at battle start' }[key] || 'Info'; faqEl = document.createElement('div'); faqEl.className='faq-popup'; faqEl.style.position='absolute'; faqEl.style.background='#fff'; faqEl.style.padding='8px 10px'; faqEl.style.border='1px solid #e5eef8'; faqEl.style.borderRadius='8px'; faqEl.innerText = text; document.body.appendChild(faqEl); const r = dot.getBoundingClientRect(); faqEl.style.left = (r.right + 8) + 'px'; faqEl.style.top = (r.top - 4) + 'px'; }
  function hideFaq(){ if(faqEl){ faqEl.remove(); faqEl=null; } }

  // icon modal apply
  modalApply.addEventListener('click', ()=>{
    if(!selectedIconTarget) return;
    const b = balls.find(x=>x.id===selectedIconTarget);
    if(!b) return;
    const file = modalFile.files && modalFile.files[0];
    if(file){
      const reader = new FileReader();
      reader.onload = ()=>{ b.img = reader.result; b._imgObj = new Image(); b._imgObj.src = b.img; b.color = null; updateIconPreview(b); drawPreview(); };
      reader.readAsDataURL(file);
    } else {
      b.img = null; b._imgObj = null; b.color = modalColor.value; updateIconPreview(b); drawPreview();
    }
    closeIconModal();
  });
  modalCancel.addEventListener('click', closeIconModal);
  function closeIconModal(){ iconModal.classList.add('hidden'); selectedIconTarget=null; modalFile.value=''; }

  function updateIconPreview(b){
    const el = document.querySelector(`.icon-picker[data-id="${b.id}"] .icon-preview`);
    if(!el) return;
    if(b.img){ el.style.backgroundImage = `url(${b.img})`; el.style.backgroundSize='cover'; el.style.backgroundPosition='center'; el.style.backgroundColor='transparent'; }
    else { el.style.backgroundImage=''; el.style.backgroundColor = b.color; }
  }

  // draw preview (arena) — with distinct safe/unsafe fills
  function drawPreview(){
    if(!ctx) ctx = spawnCanvas.getContext('2d');
    const cw = spawnCanvas.clientWidth, ch = spawnCanvas.clientHeight;
    ctx.clearRect(0,0,spawnCanvas.width/DPR, spawnCanvas.height/DPR);
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,cw,ch);

    // grid
    ctx.strokeStyle = 'rgba(15,30,45,0.03)'; ctx.lineWidth = 1;
    for(let x=0;x<cw;x+=40){ ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,ch); ctx.stroke(); }
    for(let y=0;y<ch;y+=40){ ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(cw,y+0.5); ctx.stroke(); }

    // zone visual
    const centerX = cw * zone.centerX, centerY = ch * zone.centerY;
    const minDim = Math.min(cw,ch);
    const startR = (minDim/2) * (zone.startPct/100);

    if(zone.visible){
      const elapsed = (performance.now() - zone.startTime)/1000;
      const rNow = computeZoneRadius(elapsed, startR);

      // Draw outside (unsafe) overlay first
      ctx.save();
      ctx.fillStyle = 'rgba(255,230,230,0.20)'; // unsafe (storm) color
      ctx.fillRect(0,0,cw,ch);

      // then draw safe circle to reveal safe area (composite)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(centerX, centerY, rNow, 0, Math.PI*2);
      ctx.fill();

      // reset composite and draw a subtle safe color ring/overlay
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.fillStyle = 'rgba(200,255,230,0.16)'; // safe color (inner)
      ctx.arc(centerX, centerY, rNow, 0, Math.PI*2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(30,120,80,0.14)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, rNow, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // draw balls & weapons
    balls.forEach(b=>{
      // arena: only show balls that are alive and not defeated
      if(b.alive && !b.defeated){
        ctx.beginPath(); ctx.fillStyle = b.color || '#ccc'; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#e6eef6'; ctx.stroke();
        if(b._imgObj && b._imgObj.complete){
          ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,b.r-1,0,Math.PI*2); ctx.clip(); ctx.drawImage(b._imgObj, b.x-b.r, b.y-b.r, b.r*2, b.r*2); ctx.restore();
        }
      }
      // name label (always drawn so editor stays informative)
      ctx.fillStyle = '#07202a'; ctx.font='12px Inter, Arial'; ctx.textAlign='center';
      ctx.fillText(b.name, b.x, b.y + b.r + 14);

      // health bar (shows current hp or segments even if defeated show 0)
      const barW = Math.max(50, b.r*3), barH = 8; const bx = b.x - barW/2, by = b.y + b.r + 18;
      ctx.fillStyle = '#e6eef6'; ctx.fillRect(bx,by,barW,barH);
      if(b.hpType === 'segmented'){
        const seg = Math.max(1, Math.min(10, b.segments || 5));
        const segW = Math.max(6, barW/seg);
        for(let i=0;i<seg;i++){
          ctx.fillStyle = (i < Math.max(0, Math.floor(b.hpCur || 0))) ? '#6ce0ff' : '#ffffff';
          ctx.fillRect(bx + i*segW + 1, by + 1, segW - 2, barH - 2);
        }
      } else {
        const pct = Math.max(0, Math.min(1, (b.hpCur||0) / (b.maxHP||1)));
        const rcol = Math.floor(255*(1-pct)), gcol = Math.floor(200*pct);
        ctx.fillStyle = `rgb(${rcol}, ${gcol}, 40)`;
        ctx.fillRect(bx + 1, by + 1, (barW - 2) * pct, barH - 2);
      }
      ctx.strokeStyle = '#cfeaf6'; ctx.strokeRect(bx,by,barW,barH);

      // weapon drawing if enabled and ball alive
      if(b.weaponEnabled && b.alive && !b.defeated){
        const w = b.weapon;
        const angle = ((w.angle || 0) + 90) * Math.PI/180; // default asset rotated so it appears to the right
        const tipX = b.x + Math.cos(angle) * (b.r + (w.length||48));
        const tipY = b.y + Math.sin(angle) * (b.r + (w.length||48));
        ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(tipX, tipY); ctx.lineWidth = w.width || 8; ctx.strokeStyle = 'rgba(20,30,40,0.95)'; ctx.stroke();
        if(w._imgObj && w._imgObj.complete){
          ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(angle); const sw = (w.width||10)*1.5, sh = (w.length||48); ctx.drawImage(w._imgObj, -sw/2, -sh/2, sw, sh); ctx.restore();
        }
      }
    });
  }

  function colorToHex(c){ if(!c) return '#ff7f50'; if(c[0]==='#') return c; try{ const ctx2=document.createElement('canvas').getContext('2d'); ctx2.fillStyle=c; return ctx2.fillStyle; }catch(e){ return '#ff7f50'; } }

  // dragging
  let dragging = null, dragOffset = {x:0,y:0};
  spawnCanvas.addEventListener('pointerdown', (e)=>{
    const rect = spawnCanvas.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    for(let i=balls.length-1;i>=0;i--){
      const b = balls[i];
      if(Math.hypot(b.x-x,b.y-y) <= b.r + 6 && b.alive && !b.defeated){
        dragging = b; dragOffset.x = x - b.x; dragOffset.y = y - b.y;
        spawnCanvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  });
  spawnCanvas.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const rect = spawnCanvas.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    dragging.x = Math.max(dragging.r, Math.min(spawnCanvas.clientWidth - dragging.r, x - dragOffset.x));
    dragging.y = Math.max(dragging.r, Math.min(spawnCanvas.clientHeight - dragging.r, y - dragOffset.y));
    drawPreview();
  });
  spawnCanvas.addEventListener('pointerup', (e)=>{ if(dragging){ spawnCanvas.releasePointerCapture(e.pointerId); dragging = null; } });

  // simulation runtime
  let simRunning = false;
  let last = 0;
  const pairCooldown = new Map();

  function startSimulationFlow(){
    if(simRunning) return;
    if(balls.length < 2){ alert('Need at least 2 balls to start.'); return; }

    // grey-out editor and disable interactions
    const editorArea = document.querySelector('.editor-area');
    if(editorArea) editorArea.classList.add('disabled');

    // UI button states
    startBtn.disabled = true;
    endBtn.disabled = false;

    // zone config
    zone.startPct = Number(zoneStart.value) || 100;
    zone.spawnDelay = Number(zoneSpawnDelay.value) || 1;
    zone.delay = Number(zoneDelay.value) || 8;
    zone.duration = Number(zoneDuration.value) || 30;
    zone.dps = Number(zoneDPS.value) || 4;
    zone.damageDelay = Number(zoneDamageDelay.value) || 0.5;
    zone.startTime = performance.now();
    zone.visible = false;
    zone.running = true;

    // initialize ball stats & velocities
    balls.forEach(b=>{
      b.defeated = false;
      b.alive = true;
      if(b.hpType === 'segmented'){ b.segments = Math.max(1, Math.min(10, Math.floor(b.segments || 5))); b.hpCur = b.segments; }
      else b.hpCur = Number(b.maxHP) || 100;
      const ang = Math.random() * Math.PI * 2; const sp = Number(b.speed) || 120;
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      if(b.weapon && b.weapon.img && !b.weapon._imgObj){ b.weapon._imgObj = new Image(); b.weapon._imgObj.src = b.weapon.img; }
    });

    overlay.classList.remove('hidden'); loadingText.innerText = 'Initializing...'; countdownEl.classList.add('hidden');
    setTimeout(()=>{
      loadingText.innerText = '';
      runCountdown(3, ()=>{
        overlay.classList.add('hidden');
        simRunning = true;
        last = performance.now();
        zone.startTime = performance.now(); // reset
        // delayed zone appearance
        setTimeout(()=>{ zone.visible = true; }, zone.spawnDelay * 1000);
        rafId = requestAnimationFrame(simLoop);
      });
    }, 600);
  }

  function computeZoneRadius(elapsed, startR){
    if(elapsed <= zone.delay) return startR;
    const t = Math.min(zone.duration, Math.max(0, elapsed - zone.delay));
    const frac = t / zone.duration;
    const rNow = startR * (1 - frac);
    return Math.max(0, rNow);
  }

  function simLoop(now){
    if(!simRunning){
      if(rafId) { cancelAnimationFrame(rafId); rafId = null; }
      return;
    }
    const dt = Math.min(0.04, (now - last)/1000);
    last = now;
    const w = spawnCanvas.clientWidth, h = spawnCanvas.clientHeight;

    // update positions
    for(const b of balls){
      if(!b.alive || b.defeated) continue;
      b.x += (b.vx || 0) * dt;
      b.y += (b.vy || 0) * dt;
      if(b.x - b.r < 0){ b.x = b.r; b.vx *= -1; }
      if(b.y - b.r < 0){ b.y = b.r; b.vy *= -1; }
      if(b.x + b.r > w){ b.x = w - b.r; b.vx *= -1; }
      if(b.y + b.r > h){ b.y = h - b.r; b.vy *= -1; }
    }

    // update weapon angles
    for(const b of balls){ if(!b.alive || b.defeated) continue; if(b.weaponEnabled) b.weapon.angle = ((b.weapon.angle||0) + (b.weapon.rotSpeed||180) * dt) % 360; }

    // collisions & damage (ball-ball)
    for(let i=0;i<balls.length;i++){
      const A = balls[i]; if(!A.alive || A.defeated) continue;
      for(let j=i+1;j<balls.length;j++){
        const B = balls[j]; if(!B.alive || B.defeated) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const dist = Math.hypot(dx,dy); const minD = A.r + B.r;
        if(dist < minD && dist > 0){
          const nx = dx/dist, ny = dy/dist;
          const p = 2*(A.vx*nx + A.vy*ny - B.vx*nx - B.vy*ny)/2;
          A.vx -= p*nx; A.vy -= p*ny; B.vx += p*nx; B.vy += p*ny;
          const overlap = (minD - dist)/2;
          A.x -= nx*overlap; A.y -= ny*overlap; B.x += nx*overlap; B.y += ny*overlap;

          const key = pairKey(A,B); const nowMs = performance.now();
          if(!pairCooldown.has(key) || nowMs - pairCooldown.get(key) > 250){
            applyDamage(A,B); pairCooldown.set(key, nowMs);
          }
        }
      }
    }

    // weapon tip collisions + parry
    for(const A of balls){
      if(!A.alive || A.defeated || !A.weaponEnabled) continue;
      const wA = A.weapon;
      const angleA = ((wA.angle || 0) + 90) * Math.PI/180;
      const tipAx = A.x + Math.cos(angleA) * (A.r + (wA.length||48));
      const tipAy = A.y + Math.sin(angleA) * (A.r + (wA.length||48));
      for(const B of balls){
        if(!B.alive || B.defeated || B.id === A.id) continue;
        const dToBall = Math.hypot(tipAx - B.x, tipAy - B.y);
        if(dToBall < (wA.width||8) + B.r - 4){
          if(B.weaponEnabled){
            const wB = B.weapon;
            const angleB = ((wB.angle || 0) + 90) * Math.PI/180;
            const tipBx = B.x + Math.cos(angleB) * (B.r + (wB.length||48));
            const tipBy = B.y + Math.sin(angleB) * (B.r + (wB.length||48));
            const wdist = Math.hypot(tipAx - tipBx, tipAy - tipBy);
            if(wdist < ((wA.width||8) + (wB.width||8)) * 0.9){
              const roll = Math.random()*100;
              if(roll < Math.max(wA.parry||0, wB.parry||0)){
                wA.rotSpeed = -(wA.rotSpeed||180);
                wB.rotSpeed = -(wB.rotSpeed||180);
                continue;
              }
            }
          }
          const dmg = Number(wA.damage) || 1;
          if(B.hpType === 'segmented'){ const loss = Math.max(1, Math.floor(dmg)); B.hpCur = Math.max(0, B.hpCur - loss); if(B.hpCur <= 0) B.defeated = true; }
          else { B.hpCur = Math.max(0, B.hpCur - dmg); if(B.hpCur <= 0) B.defeated = true; }
        }
      }
    }

    // regen
    for(const b of balls){ if(!b.alive || b.defeated) continue; if(b.hpType !== 'segmented' && b.regen) b.hpCur = Math.min(b.maxHP, b.hpCur + b.regen * dt); }

    // zone damage
    const elapsed = (performance.now() - zone.startTime)/1000;
    const minDim = Math.min(spawnCanvas.clientWidth, spawnCanvas.clientHeight);
    const startR = (minDim/2) * (zone.startPct/100);
    if(zone.visible && elapsed >= zone.delay + zone.damageDelay){
      const rNow = computeZoneRadius(elapsed, startR);
      for(const b of balls){
        if(!b.alive || b.defeated) continue;
        const cx = spawnCanvas.clientWidth * zone.centerX, cy = spawnCanvas.clientHeight * zone.centerY;
        const d = Math.hypot(b.x - cx, b.y - cy);
        if(d > rNow){
          const dmg = (zone.dps || 0) * dt;
          if(b.hpType === 'segmented'){ const loss = Math.max(1, Math.floor(dmg)); b.hpCur = Math.max(0, b.hpCur - loss); if(b.hpCur <= 0) b.defeated = true; }
          else { b.hpCur = Math.max(0, b.hpCur - dmg); if(b.hpCur <= 0) b.defeated = true; }
        }
      }
    }

    // mark defeated
    balls.forEach(b=>{
      const label = document.querySelector(`.defeated-label[data-def="${b.id}"]`);
      if(b.defeated){ b.alive = false; if(label) label.style.display = 'block'; }
      else if(label) label.style.display = 'none';
    });

    drawPreview();

    const aliveCount = balls.filter(x => x.alive && !x.defeated).length;
    if(aliveCount <= 1){
      simRunning = false;
      overlay.classList.add('hidden');
      const editorArea = document.querySelector('.editor-area');
      if(editorArea) editorArea.classList.remove('disabled');
      startBtn.disabled = false;
      endBtn.disabled = true;
      const winner = balls.find(x=>x.alive && !x.defeated) || null;
      showWinner(winner);
      // cancel RAF if present
      if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
      return;
    }
    rafId = requestAnimationFrame(simLoop);
  }

  function pairKey(a,b){ return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`; }

  function applyDamage(A,B){
    const dmgA = Number(A.damage) || 1;
    const dmgB = Number(B.damage) || 1;
    deal(A,B,dmgA); deal(B,A,dmgB);
  }
  function deal(attacker, victim, dmg){
    if(!victim.alive || victim.defeated) return;
    if(victim.hpType === 'segmented'){ const loss = Math.max(1, Math.floor(dmg)); victim.hpCur = Math.max(0, victim.hpCur - loss); if(victim.hpCur <= 0) victim.defeated = true; }
    else { victim.hpCur = Math.max(0, victim.hpCur - dmg); if(victim.hpCur <= 0) victim.defeated = true; }
  }

  function showWinner(b){
    winnerPopup.classList.remove('hidden');
    if(!b){ winnerText.innerText = 'No winner'; winnerIcon.style.background = '#fff'; }
    else {
      winnerText.innerText = `${b.name} WON!`;
      if(b._imgObj){ winnerIcon.style.backgroundImage = `url(${b.img})`; winnerIcon.style.backgroundSize = 'cover'; winnerIcon.style.backgroundPosition = 'center'; }
      else { winnerIcon.style.backgroundImage = ''; winnerIcon.style.backgroundColor = b.color || '#ddd'; }
    }
  }

  exitEditor.addEventListener('click', ()=>{
    winnerPopup.classList.add('hidden');
    drawPreview();
  });
  exitMenu.addEventListener('click', ()=>{ location.href = 'index.html'; });

  // End Game button (stops simulation immediately)
  endBtn.addEventListener('click', ()=>{
    if(!simRunning) return;
    simRunning = false;
    if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    overlay.classList.add('hidden');
    // re-enable editor
    const editorArea = document.querySelector('.editor-area');
    if(editorArea) editorArea.classList.remove('disabled');
    zone.running = false; zone.visible = false;
    // stop motion but keep defeated flags
    balls.forEach(b=>{ b.vx = b.vy = 0; });
    startBtn.disabled = false;
    endBtn.disabled = true;
    drawPreview();
  });

  // Start button
  startBtn.addEventListener('click', startSimulationFlow);

  // countdown
  function runCountdown(n, cb){
    countdownEl.classList.remove('hidden'); let count = n; countdownEl.innerText = count;
    const tick = setInterval(()=>{
      count--;
      if(count>0){ animateNumber(count); countdownEl.innerText = count; }
      else {
        animateNumber('GO!'); countdownEl.innerText = 'GO!';
        setTimeout(()=>{ countdownEl.classList.add('hidden'); clearInterval(tick); cb && cb(); }, 700);
      }
    }, 900);
  }
  function animateNumber(txt){ countdownEl.innerText = txt; countdownEl.animate([{transform:'scale(1.4)',opacity:0},{transform:'scale(1.0)',opacity:1},{transform:'scale(0.85)',opacity:0.1}],{duration:700,easing:'ease-out'}); }

  // preview toggle (mobile)
  previewToggle?.addEventListener('click', ()=>{
    if(!previewWrap) return; previewWrap.classList.toggle('expanded'); resizeCanvas(); drawPreview();
  });

  // back button
  backBtn?.addEventListener('click', ()=>{ document.body.style.opacity = 0; setTimeout(()=> location.href='index.html', 260); });

  // initial canvas and create default balls
  resizeCanvas();
  if(balls.length === 0){ createBall(); createBall(); }
  updateAddButton();
  drawPreview();

  // add ball
  addBtn?.addEventListener('click', ()=>{ createBall(); });

  // global click: icon picker delegation
  document.addEventListener('click', (e)=>{
    const ip = e.target.closest('.icon-picker');
    if(ip){ selectedIconTarget = ip.getAttribute('data-id'); iconModal.classList.remove('hidden'); modalFile.value=''; modalColor.value='#ff7f50'; }
  });

  // ensure icon updates periodically
  setInterval(()=>{ balls.forEach(b=>updateIconPreview(b)); }, 800);

  // weapon modal preview
  function renderWeaponPreview(w){
    weaponCtx.clearRect(0,0,weaponCanvas.width,weaponCanvas.height);
    const cx = weaponCanvas.width/2, cy = weaponCanvas.height/2;
    weaponCtx.beginPath(); weaponCtx.fillStyle = '#6ce0ff'; weaponCtx.arc(cx,cy,28,0,Math.PI*2); weaponCtx.fill();
    const angle = 0;
    const tipX = cx + Math.cos(angle) * (28 + (w.length||48));
    const tipY = cy + Math.sin(angle) * (28 + (w.length||48));
    weaponCtx.beginPath(); weaponCtx.moveTo(cx,cy); weaponCtx.lineTo(tipX,tipY); weaponCtx.lineWidth = w.width || 10; weaponCtx.strokeStyle = '#2b3b44'; weaponCtx.stroke();
    if(w._imgObj && w._imgObj.complete){ weaponCtx.save(); weaponCtx.translate(tipX,tipY); weaponCtx.rotate(angle); const sw=(w.width||10)*1.5, sh=(w.length||48); weaponCtx.drawImage(w._imgObj,-sw/2,-sh/2,sw,sh); weaponCtx.restore(); }
  }

  weaponFile.addEventListener('change', ()=>{
    const file = weaponFile.files && weaponFile.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{ renderWeaponPreview({ _imgObj: img, width: Number(weaponWidth.value), length: Number(weaponLength.value) }); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  weaponApply.addEventListener('click', ()=>{
    if(!currentWeaponTarget){ weaponModal.classList.add('hidden'); return; }
    const b = balls.find(x=>x.id === currentWeaponTarget); if(!b){ weaponModal.classList.add('hidden'); return; }
    const file = weaponFile.files && weaponFile.files[0];
    const w = b.weapon || {};
    w.damage = Number(weaponDamage.value) || 8;
    w.rotSpeed = Number(weaponRot.value) || 180;
    w.parry = Math.max(0, Math.min(100, Number(weaponParry.value) || 0));
    w.width = Number(weaponWidth.value) || 10;
    w.length = Number(weaponLength.value) || 48;
    if(file){
      const reader = new FileReader();
      reader.onload = ()=>{
        w.img = reader.result; w._imgObj = new Image(); w._imgObj.src = w.img; b.weapon = w; weaponModal.classList.add('hidden'); drawPreview();
      };
      reader.readAsDataURL(file);
    } else {
      if(!w._imgObj && !w.img){ w.img = defaultWeaponPreset; w._imgObj = new Image(); w._imgObj.src = w.img; }
      b.weapon = w; weaponModal.classList.add('hidden'); drawPreview();
    }
  });
  weaponCancel.addEventListener('click', ()=>{ weaponModal.classList.add('hidden'); currentWeaponTarget = null; });

  // Panel selector animations (Balls / Zone / Powerups) using WAAPI (no CSS changes required)
  function animatePanelSwitch(hideEl, showEl){
    if(hideEl === showEl) return;
    // animate out
    if(hideEl && !hideEl.classList.contains('hidden')){
      hideEl.animate([{ opacity:1, transform:'translateX(0px)' }, { opacity:0, transform:'translateX(-6px)' }], { duration:200, easing:'ease-out' }).onfinish = () => { hideEl.classList.add('hidden'); hideEl.setAttribute('aria-hidden','true'); };
    }
    // animate in
    if(showEl){
      showEl.classList.remove('hidden');
      showEl.setAttribute('aria-hidden','false');
      showEl.animate([{ opacity:0, transform:'translateX(6px)' }, { opacity:1, transform:'translateX(0px)' }], { duration:240, easing:'ease-out' });
    }
  }

  selBalls?.addEventListener('click', ()=>{
    selBalls.classList.add('sel-active'); selZone.classList.remove('sel-active'); selPowerups.classList.remove('sel-active');
    animatePanelSwitch(zonePanel, ballPanel);
    animatePanelSwitch(powerupsPanel, ballPanel);
  });
  selZone?.addEventListener('click', ()=>{
    selZone.classList.add('sel-active'); selBalls.classList.remove('sel-active'); selPowerups.classList.remove('sel-active');
    animatePanelSwitch(ballPanel, zonePanel);
    animatePanelSwitch(powerupsPanel, zonePanel);
  });
  selPowerups?.addEventListener('click', ()=>{
    selPowerups.classList.add('sel-active'); selBalls.classList.remove('sel-active'); selZone.classList.remove('sel-active');
    animatePanelSwitch(ballPanel, powerupsPanel);
    animatePanelSwitch(zonePanel, powerupsPanel);
  });

  // POWERUPS UI logic
  function renderPowerupCard(p){
    let card = document.querySelector(`.powerup-card[data-id="${p.id}"]`);
    if(card) return;
    card = document.createElement('div');
    card.className = 'powerup-card';
    card.dataset.id = p.id;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="icon-preview" style="width:48px;height:48px;border-radius:8px;background:${p.color || '#ddd'}; background-size:cover; background-position:center; ${p.img ? `background-image:url(${p.img});` : '' }"></div>
        <div style="flex:1;">
          <input class="powerup-name" value="${p.name}" />
          <div style="font-size:12px;color:#556">Type: ${p.type || 'Generic'}</div>
        </div>
        <button class="delete-powerup">Delete</button>
      </div>
      <details style="margin-top:8px;">
        <summary>HP</summary>
        <div style="display:flex;flex-direction:column;gap:6px;padding:8px;">
          <label>HP Change (immediate): <input class="pu-hp-change" type="number" value="${p.hpChange||0}" /></label>
          <label>HP/s (over time): <input class="pu-hp-per-s" type="number" value="${p.hpPerS||0}" /></label>
          <label>HP/s Time (s): <input class="pu-hp-time" type="number" value="${p.hpTime||0}" /></label>
        </div>
      </details>
      <details>
        <summary>Speed</summary>
        <div style="display:flex;flex-direction:column;gap:6px;padding:8px;">
          <label>Speed Change (immediate): <input class="pu-speed-change" type="number" value="${p.speedChange||0}" /></label>
          <label>Temporary Speed Change: <input class="pu-temp-speed" type="number" value="${p.tempSpeed||0}" /></label>
          <label>Temporary Speed Time (s): <input class="pu-temp-time" type="number" value="${p.tempTime||0}" /></label>
        </div>
      </details>
      <details>
        <summary>Damage Buff</summary>
        <div style="display:flex;flex-direction:column;gap:6px;padding:8px;">
          <label>Damage Change (immediate): <input class="pu-damage-change" type="number" value="${p.damageChange||0}" /></label>
          <label>Damage/s (over time): <input class="pu-damage-per-s" type="number" value="${p.damagePerS||0}" /></label>
          <label>Duration (s): <input class="pu-damage-time" type="number" value="${p.damageTime||0}" /></label>
        </div>
      </details>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
        <label>Image: <input class="pu-img-file" type="file" accept="image/*" /></label>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
        <label>Spawn Tmin: <input class="pu-spawn-min" type="number" value="${p.spawnMin||1}" /></label>
        <label>Spawn Tmax: <input class="pu-spawn-max" type="number" value="${p.spawnMax||5}" /></label>
        <label>Pickup Size: <input class="pu-size" type="number" value="${p.pickupSize||28}" /></label>
        <label>Decay Time (s): <input class="pu-decay" type="number" value="${p.decay||12}" /></label>
      </div>
    `;
    powerupListEl.appendChild(card);

    card.querySelector('.delete-powerup').addEventListener('click', ()=>{
      const idx = powerups.findIndex(x=>x.id===p.id);
      if(idx>=0) { powerups.splice(idx,1); card.remove(); }
    });

    // wire file upload
    const fileInput = card.querySelector('.pu-img-file');
    fileInput.addEventListener('change', ()=>{
      const f = fileInput.files && fileInput.files[0];
      if(!f) return;
      const r = new FileReader();
      r.onload = ()=>{ p.img = r.result; card.querySelector('.icon-preview').style.backgroundImage = `url(${p.img})`; };
      r.readAsDataURL(f);
    });

    // wire simple inputs to model (live updates)
    const wire = (sel, prop, cast=Number) => {
      const el = card.querySelector(sel);
      if(!el) return;
      el.addEventListener('input', ()=>{ p[prop] = cast === Number ? (Number(el.value)||0) : el.value; });
    };
    wire('.powerup-name','name', String);
    wire('.pu-hp-change','hpChange', Number); wire('.pu-hp-per-s','hpPerS', Number); wire('.pu-hp-time','hpTime', Number);
    wire('.pu-speed-change','speedChange', Number); wire('.pu-temp-speed','tempSpeed', Number); wire('.pu-temp-time','tempTime', Number);
    wire('.pu-damage-change','damageChange', Number); wire('.pu-damage-per-s','damagePerS', Number); wire('.pu-damage-time','damageTime', Number);
    wire('.pu-spawn-min','spawnMin', Number); wire('.pu-spawn-max','spawnMax', Number); wire('.pu-size','pickupSize', Number); wire('.pu-decay','decay', Number);
  }

  addPowerupBtn?.addEventListener('click', ()=>{
    const id = uid();
    const p = { id, name: `Powerup ${powerups.length+1}`, type:'Generic', img:null, color:'#f4f4f4' };
    powerups.push(p);
    renderPowerupCard(p);
  });

  // expose drawPreview for debugging
  window.drawPreview = drawPreview;

})();
