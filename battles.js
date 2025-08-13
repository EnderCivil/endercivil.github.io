// battles.js - extended: zone toggle, powerups spawning, physics toggles, melee+ranged weapons, random weapon directions
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

  // panels
  const selBalls = document.getElementById('selBalls');
  const selZone = document.getElementById('selZone');
  const selPowerups = document.getElementById('selPowerups');
  const ballPanel = document.getElementById('ballPanel');
  const zonePanel = document.getElementById('zonePanel');
  const powerupsPanel = document.getElementById('powerupsPanel');
  const physicsPanel = document.getElementById('physicsPanel');

  // zone DOM
  const zoneEnabledInput = document.getElementById('zoneEnabled');
  const zoneStart = document.getElementById('zoneStart');
  const zoneSpawnDelay = document.getElementById('zoneSpawnDelay');
  const zoneDelay = document.getElementById('zoneDelay');
  const zoneDuration = document.getElementById('zoneDuration');
  const zoneDPS = document.getElementById('zoneDPS');
  const zoneDamageDelay = document.getElementById('zoneDamageDelay');

  // powerups DOM
  const addPowerupBtn = document.getElementById('addPowerupBtn');
  const powerupListEl = document.getElementById('powerupList');

  // weapon modal DOM (plus ranged files)
  const weaponModal = document.getElementById('weaponModal');
  const weaponFile = document.getElementById('weaponFile');
  const weaponGunFile = document.getElementById('weaponGunFile');
  const weaponBulletFile = document.getElementById('weaponBulletFile');
  const weaponDamage = document.getElementById('weaponDamage');
  const weaponRot = document.getElementById('weaponRot');
  const weaponParry = document.getElementById('weaponParry');
  const weaponWidth = document.getElementById('weaponWidth');
  const weaponLength = document.getElementById('weaponLength');

  // ranged DOM
  const weaponLockRange = document.getElementById('weaponLockRange');
  const weaponFireCooldown = document.getElementById('weaponFireCooldown');
  const weaponProjSpeed = document.getElementById('weaponProjSpeed');
  const weaponProjDmg = document.getElementById('weaponProjDmg');
  const weaponProjHomingRange = document.getElementById('weaponProjHomingRange');
  const weaponProjTurn = document.getElementById('weaponProjTurn');

  const weaponApply = document.getElementById('weaponApply');
  const weaponCancel = document.getElementById('weaponCancel');
  const weaponCanvas = document.getElementById('weaponCanvas');
  const weaponCtx = weaponCanvas && weaponCanvas.getContext ? weaponCanvas.getContext('2d') : null;
  const weaponTypeMelee = document.getElementById('weaponTypeMelee');
  const weaponTypeRanged = document.getElementById('weaponTypeRanged');
  const weaponRangedBlock = document.getElementById('weaponRanged');
  const weaponCommonBlock = document.getElementById('weaponCommon');

  // physics controls
  const physicsSpeedTransfer = document.getElementById('physicsSpeedTransfer');
  const physicsElasticity = document.getElementById('physicsElasticity');
  const physicsFriction = document.getElementById('physicsFriction');

  // overlay / winner / preview
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
  function resizeCanvas(){
    if(!spawnCanvas) return;
    const r = spawnCanvas.getBoundingClientRect();
    spawnCanvas.width = Math.max(320, Math.round(r.width)) * DPR;
    spawnCanvas.height = Math.max(240, Math.round(r.height)) * DPR;
    spawnCanvas.style.width = `${r.width}px`;
    spawnCanvas.style.height = `${r.height}px`;
    ctx = spawnCanvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', ()=>{ resizeCanvas(); drawPreview(); });

  // Data
  const MAX_BALLS = 10;
  let balls = [];
  let powerupTemplates = [];      // templates (config)
  let powerupInstances = [];      // active spawned pickups in arena
  let projectiles = [];           // active projectiles (for ranged weapons)
  let selectedIconTarget = null;
  let currentWeaponTarget = null;
  let currentWeaponType = 'melee'; // 'melee' | 'ranged'

  let rafId = null;
  let simRunning = false;
  let last = 0;

  const defaultWeaponPreset = 'https://raw.githubusercontent.com/EnderCivil/endercivil.github.io/main/34.png';
  const defaultGunPreset = 'https://ik.imagekit.io/ztc9bh2wdx/images/344.02.46_product_image_left.png?tr=n-ux_tn_w750_v00';
  const defaultBulletPreset = 'https://img.pikbest.com/png-images/20240503/spirited-mothers-day-holiday-wishes-222024-png-images-png_10546173.png!sw800';

  // zone state
  let zone = {
    enabled: true,
    startPct:100, spawnDelay:1, delay:8, duration:30, dps:4, damageDelay:0.5,
    centerX:0.5, centerY:0.5, running:false, startTime:0, visible:false
  };

  // helpers
  const uid = ()=> Math.random().toString(36).slice(2,9);
  function randColor(){ const h = Math.floor(Math.random()*360); const s = 60 + Math.floor(Math.random()*25); return `hsl(${h} ${s}% 55%)`; }

  function getNextBallNumber(){
    const used = new Set();
    for(const b of balls){
      const m = (b.name || '').match(/^Ball\s+(\d+)$/);
      if(m) used.add(Number(m[1]));
    }
    for(let i=1;;i++){ if(!used.has(i)) return i; }
  }

  function randomSpawnPos(r){
    const pw = spawnCanvas.clientWidth, ph = spawnCanvas.clientHeight;
    const x = Math.random()*(pw-2*r)+r;
    const y = Math.random()*(ph-2*r)+r;
    return {x,y};
  }

  // ---------------- Ball creation / UI ----------------
  function createBall(){
    if(balls.length >= MAX_BALLS) return;
    const id = uid();
    const name = `Ball ${getNextBallNumber()}`;
    const r = 20;
    const pos = (spawnCanvas && spawnCanvas.clientWidth) ? randomSpawnPos(r) : { x: 60 + balls.length*60, y: 80 + balls.length*40 };
    const b = {
      id, name, color: randColor(), img:null, _imgObj:null,
      maxHP:100, hpType:'normal', regen:0, damage:10, speed:120,
      x: pos.x, y: pos.y, r,
      alive:true, defeated:false, hpCur:100, segments:5,
      weaponEnabled: false,
      weapon: {
        type:'melee', // 'melee' or 'ranged'
        img: defaultWeaponPreset, _imgObj: new Image(),
        // ranged gun/bullet
        gunImg: defaultGunPreset, gunObj: new Image(),
        bulletImg: defaultBulletPreset, bulletObj: new Image(),
        // melee props
        damage:8, rotSpeed:180, parry:20, width:10, length:48, angle: Math.random()*360,
        // ranged props
        lockRange:220, fireCooldown:0.7, lastFired:0,
        projSpeed:420, projDmg:12, projHomingRange:0, projTurn:0,
        magazine:999
      }
    };
    // pre-load images
    b.weapon._imgObj.src = b.weapon.img;
    b.weapon.gunObj.src = b.weapon.gunImg;
    b.weapon.bulletObj.src = b.weapon.bulletImg;

    balls.push(b);
    renderBallCard(b);
    updateAddButton();
    drawPreview();
  }

  function updateAddButton(){ if(addBtn) addBtn.disabled = balls.length >= MAX_BALLS; }

  // ---------------- Ball card UI ----------------
  function renderBallCard(b){
    // if already rendered, skip (we keep cards across matches)
    if(document.querySelector(`.ball-card[data-id="${b.id}"]`)) return;

    const card = document.createElement('div');
    card.className = 'ball-card';
    card.dataset.id = b.id;
    card.innerHTML = `
      <button class="delete-btn" title="Delete">✕</button>
      <div class="icon-picker" data-id="${b.id}">
        <div class="icon-preview" style="background:${b.color}; width:48px;height:48px;border-radius:8px; display:inline-block;"></div>
      </div>
      <div class="card-main">
        <div class="name-row">
          <input class="name-input" value="${b.name}" data-id="${b.id}" />
          <span class="attr-warn" data-warn="${b.id}"></span>
        </div>
        <div class="controls-row">
          <div class="field"><label>HP:</label><input class="small-input" type="number" value="${b.maxHP}" data-prop="maxHP" data-id="${b.id}" /></div>
          <div class="field"><label>Damage:</label><input class="small-input" type="number" value="${b.damage}" data-prop="damage" data-id="${b.id}" /></div>
          <div class="field"><label>Speed:</label><input class="small-input" type="number" value="${b.speed}" data-prop="speed" data-id="${b.id}" /></div>
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
          <div class="toggle ${b.weaponEnabled ? 'on' : ''}" data-toggle="${b.id}" style="cursor:pointer;"></div>
          <div style="font-size:13px;color:#24343e;font-weight:700;">Weapon</div>
          <button class="weapon-btn" data-id="${b.id}">Weapons</button>
          <div style="flex:1;"></div>
        </div>

        <div style="margin-top:8px;"><small class="defeated-label" data-def="${b.id}" style="color:#b33;display:none">DEFEATED</small></div>
      </div>
    `;
    ballListEl.appendChild(card);

    // delete
    card.querySelector('.delete-btn').addEventListener('click', ()=>{
      const idx = balls.findIndex(x=>x.id===b.id);
      if(idx>=0){
        balls.splice(idx,1);
        card.remove();
        updateAddButton();
        drawPreview();
      }
    });

    card.querySelector('.name-input').addEventListener('input', (e)=>{ b.name = e.target.value; drawPreview(); });

    // icon picker
    card.querySelector('.icon-picker').addEventListener('click', ()=>{ selectedIconTarget = b.id; iconModal.classList.remove('hidden'); modalFile.value=''; modalColor.value = '#ff7f50'; });

    // weapon toggle + button
    const toggle = card.querySelector(`.toggle[data-toggle="${b.id}"]`);
    const weaponBtn = card.querySelector(`.weapon-btn[data-id="${b.id}"]`);
    function setWeaponState(enabled){
      b.weaponEnabled = !!enabled;
      if(enabled){ toggle.classList.add('on'); weaponBtn.disabled = false; weaponBtn.classList.remove('disabled'); }
      else { toggle.classList.remove('on'); weaponBtn.disabled = true; weaponBtn.classList.add('disabled'); }
    }
    setWeaponState(b.weaponEnabled);
    toggle.addEventListener('click', ()=>{ setWeaponState(!b.weaponEnabled); });

    // open weapon modal
    weaponBtn.addEventListener('click', ()=>{
      if(!b.weaponEnabled) return;
      currentWeaponTarget = b.id;
      currentWeaponType = b.weapon.type || 'melee';
      // populate fields
      weaponDamage.value = b.weapon.damage || 8;
      weaponRot.value = b.weapon.rotSpeed || 180;
      weaponParry.value = b.weapon.parry || 20;
      weaponWidth.value = b.weapon.width || 10;
      weaponLength.value = b.weapon.length || 48;

      // ranged populate
      weaponLockRange.value = b.weapon.lockRange || 220;
      weaponFireCooldown.value = b.weapon.fireCooldown || 0.7;
      weaponProjSpeed.value = b.weapon.projSpeed || 420;
      weaponProjDmg.value = b.weapon.projDmg || 12;
      weaponProjHomingRange.value = b.weapon.projHomingRange || 0;
      weaponProjTurn.value = b.weapon.projTurn || 0;

      // show/hide ranged block
      if(b.weapon.type === 'ranged'){ weaponRangedBlock.classList.remove('hidden'); weaponTypeRanged.classList.add('active'); weaponTypeMelee.classList.remove('active'); }
      else { weaponRangedBlock.classList.add('hidden'); weaponTypeMelee.classList.add('active'); weaponTypeRanged.classList.remove('active'); }

      weaponModal.classList.remove('hidden');
      renderWeaponPreview(b.weapon);
    });
  }

  // ---------------- Icon modal apply ----------------
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

  // ---------------- Powerups - templates & instances ----------------
  function createPowerupTemplate(){
    const id = uid();
    const tpl = {
      id, name: `Powerup ${powerupTemplates.length+1}`, img: null, _imgObj: null,
      // default simple HP buff template
      hpChange: +25, hpPerSec: 0, hpTime: 0,
      speedChange: 0, tempSpeedChange: 0, tempSpeedTime: 0,
      damageChange: 0,
      // spawn settings
      spawnMin: 3, spawnMax: 6, pickupSize: 28, decayTime: 12,
      nextSpawnAt: Date.now() + (Math.random()*2000 + 2000)
    };
    powerupTemplates.push(tpl);
    renderPowerupCard(tpl);
    return tpl;
  }

  function renderPowerupCard(tpl){
    const card = document.createElement('div');
    card.className = 'powerup-card';
    card.dataset.id = tpl.id;
    card.innerHTML = `
      <button class="delete-btn">✕</button>
      <div class="powerup-thumbnail" data-id="${tpl.id}">
        <img class="powerup-thumb-img" src="${tpl.img || ''}" alt="" />
      </div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${tpl.name}</strong>
          <div>
            <button class="small configure">Configure</button>
          </div>
        </div>
        <div style="margin-top:8px; font-size:13px;">
          Spawn every <strong>${tpl.spawnMin}</strong>–<strong>${tpl.spawnMax}</strong>s · Pickup size <strong>${tpl.pickupSize}</strong> · Decay <strong>${tpl.decayTime}s</strong>
        </div>
      </div>
    `;
    powerupListEl.appendChild(card);

    card.querySelector('.delete-btn').addEventListener('click', ()=>{
      const idx = powerupTemplates.findIndex(x=>x.id===tpl.id);
      if(idx>=0){ powerupTemplates.splice(idx,1); card.remove(); }
    });

    card.querySelector('.powerup-thumbnail').addEventListener('click', ()=>{
      // open small modal to upload image (reuse iconModal)
      selectedIconTarget = tpl.id + '|powerup';
      iconModal.classList.remove('hidden');
      modalFile.value = '';
    });
  }

  // call this in your initialization to create a default powerup
  function ensureDefaultPowerups(){
    if(powerupTemplates.length === 0){
      createPowerupTemplate();
    }
  }

  // spawn a powerup instance in the arena
  function spawnPowerupInstance(tpl){
    const r = tpl.pickupSize || 24;
    const pos = randomSpawnPos(r);
    const inst = {
      tplId: tpl.id, id: uid(),
      x: pos.x, y: pos.y, r,
      spawnTime: Date.now(),
      expiresAt: Date.now() + (tpl.decayTime || 10) * 1000,
      picked: false
    };
    powerupInstances.push(inst);
  }

  // powerup pickup application (simple - apply hpChange / speed buffs)
  function applyPowerupToBall(tpl, ball){
    if(tpl.hpChange) {
      if(ball.hpType === 'segmented') {
        ball.hpCur = Math.min(ball.segments, (ball.hpCur || 0) + Math.floor(tpl.hpChange / 10));
      } else {
        ball.hpCur = Math.min(ball.maxHP, (ball.hpCur || 0) + tpl.hpChange);
      }
    }
    if(tpl.tempSpeedChange) {
      // simple speed buff: temporarly increase speed by percent for tpl.tempSpeedTime seconds
      const original = ball.speed || 100;
      ball.speed = original + tpl.tempSpeedChange;
      // schedule revert after time
      setTimeout(()=>{ ball.speed = original; }, (tpl.tempSpeedTime || 1)*1000);
    }
    // You can expand to other effects here.
  }

  // ---------------- Drawing / preview ----------------
  function drawPreview(){
    if(!ctx) ctx = spawnCanvas.getContext('2d');
    const cw = spawnCanvas.clientWidth, ch = spawnCanvas.clientHeight;
    ctx.clearRect(0,0,spawnCanvas.width/DPR, spawnCanvas.height/DPR);
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,cw,ch);

    // grid
    ctx.strokeStyle = 'rgba(15,30,45,0.03)'; ctx.lineWidth = 1;
    for(let x=0;x<cw;x+=40){ ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,ch); ctx.stroke(); }
    for(let y=0;y<ch;y+=40){ ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(cw,y+0.5); ctx.stroke(); }

    // zone visual (only draw if enabled)
    if(zone.enabled && zone.visible){
      const centerX = cw * zone.centerX, centerY = ch * zone.centerY;
      const minDim = Math.min(cw,ch);
      const startR = (minDim/2) * (zone.startPct/100);
      const elapsed = (performance.now() - zone.startTime)/1000;
      const rNow = computeZoneRadius(elapsed, startR);

      // Draw outside unsafe region
      ctx.save();
      ctx.fillStyle = 'rgba(255,200,200,0.22)';
      ctx.fillRect(0,0,cw,ch);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(centerX, centerY, rNow, 0, Math.PI*2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // safe inner area overlay
      ctx.beginPath(); ctx.fillStyle = 'rgba(200,255,230,0.14)'; ctx.arc(centerX, centerY, rNow, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,120,80,0.12)'; ctx.beginPath(); ctx.arc(centerX, centerY, rNow, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // draw powerup instances
    for(const p of powerupInstances){
      // fade as they near expiry
      const ttl = Math.max(0, p.expiresAt - Date.now());
      const alpha = Math.max(0.15, Math.min(1, ttl / 5000));
      ctx.beginPath(); ctx.fillStyle = `rgba(140,240,120,${alpha})`; ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(20,150,60,${alpha})`; ctx.stroke();
      // if template has image draw it
      const tpl = powerupTemplates.find(t=>t.id===p.tplId);
      if(tpl && tpl._imgObj && tpl._imgObj.complete){
        ctx.save(); ctx.beginPath(); ctx.arc(p.x,p.y,p.r-2,0,Math.PI*2); ctx.clip();
        ctx.drawImage(tpl._imgObj, p.x-p.r, p.y-p.r, p.r*2, p.r*2);
        ctx.restore();
      }
    }

    // draw balls & weapons
    balls.forEach(b=>{
      if(b.alive && !b.defeated){
        ctx.beginPath(); ctx.fillStyle = b.color || '#ccc'; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#e6eef6'; ctx.stroke();
        if(b._imgObj && b._imgObj.complete){
          ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,b.r-1,0,Math.PI*2); ctx.clip(); ctx.drawImage(b._imgObj, b.x-b.r, b.y-b.r, b.r*2, b.r*2); ctx.restore();
        }
      }

      // name
      ctx.fillStyle = '#07202a'; ctx.font='12px Inter, Arial'; ctx.textAlign='center';
      ctx.fillText(b.name, b.x, b.y + b.r + 14);

      // healthbar
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

      // weapon drawing
      if(b.weaponEnabled && b.alive && !b.defeated){
        const w = b.weapon;
        if(w.type === 'melee'){
          // angle is in degrees
          const angle = ((w.angle || 0) + 90) * Math.PI/180;
          const tipX = b.x + Math.cos(angle) * (b.r + (w.length||48));
          const tipY = b.y + Math.sin(angle) * (b.r + (w.length||48));
          ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(tipX, tipY); ctx.lineWidth = w.width || 8; ctx.strokeStyle = 'rgba(20,30,40,0.95)'; ctx.stroke();
          if(w._imgObj && w._imgObj.complete){
            ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(angle); const sw = (w.width||10)*1.5, sh = (w.length||48);
            ctx.drawImage(w._imgObj, -sw/2, -sh/2, sw, sh); ctx.restore();
          }
        } else if(w.type === 'ranged'){
          // draw a small gun sprite at the ball oriented to angle
          const angle = ((w.angle || 0) + 90) * Math.PI/180;
          const gunX = b.x + Math.cos(angle) * (b.r + 12);
          const gunY = b.y + Math.sin(angle) * (b.r + 12);
          if(w.gunObj && w.gunObj.complete){
            ctx.save(); ctx.translate(gunX, gunY); ctx.rotate(angle + Math.PI); // gun asset default faces left - flip
            const gw = 28, gh = 18;
            ctx.drawImage(w.gunObj, -gw/2, -gh/2, gw, gh); ctx.restore();
          } else {
            ctx.beginPath(); ctx.fillStyle = '#333'; ctx.arc(gunX, gunY, 6, 0, Math.PI*2); ctx.fill();
          }
        }
      }
    });

    // draw projectiles
    for(const p of projectiles){
      ctx.beginPath(); ctx.fillStyle = '#ffce4a'; ctx.arc(p.x,p.y, Math.max(3, p.radius||4), 0, Math.PI*2); ctx.fill();
    }
  }

  // ---------------- Simulation & Spawn logic ----------------
  function computeZoneRadius(elapsed, startR){
    if(elapsed <= zone.delay) return startR;
    const t = Math.min(zone.duration, Math.max(0, elapsed - zone.delay));
    const frac = t / zone.duration;
    const rNow = startR * (1 - frac);
    return Math.max(0, rNow);
  }

  // helper to build projectile
  function spawnProjectile(owner, x, y, vx, vy, dmg, lifetime=5000, homingRange=0, turnSpeed=0){
    projectiles.push({ ownerId: owner.id, x, y, vx, vy, dmg, createdAt:Date.now(), life: lifetime, homingRange, turnSpeed, radius:6 });
  }

  function startSimulationFlow(){
    if(simRunning) return;
    if(balls.length < 2){ alert('Need at least 2 balls to start.'); return; }

    // disable UI editor
    const editor = document.querySelector('.editor-area');
    if(editor) editor.classList.add('disabled');

    // UI buttons
    startBtn.disabled = true;
    endBtn.disabled = false;

    // read zone enabled state
    zone.enabled = !!(zoneEnabledInput && zoneEnabledInput.checked);

    zone.startPct = Number(zoneStart.value) || 100;
    zone.spawnDelay = Number(zoneSpawnDelay.value) || 1;
    zone.delay = Number(zoneDelay.value) || 8;
    zone.duration = Number(zoneDuration.value) || 30;
    zone.dps = Number(zoneDPS.value) || 4;
    zone.damageDelay = Number(zoneDamageDelay.value) || 0.5;
    zone.startTime = performance.now();
    zone.visible = false;
    zone.running = true;

    // physics settings
    const speedTransfer = !!(physicsSpeedTransfer && physicsSpeedTransfer.checked);
    const elasticity = Number(physicsElasticity && physicsElasticity.value || 1);
    const friction = Number(physicsFriction && physicsFriction.value || 1);

    // init balls velocities and weapons
    balls.forEach(b=>{
      b.defeated = false; b.alive = true;
      if(b.hpType === 'segmented'){ b.segments = Math.max(1, Math.min(10, Math.floor(b.segments || 5))); b.hpCur = b.segments; }
      else b.hpCur = Number(b.maxHP) || 100;

      // randomize velocity
      const ang = Math.random()*Math.PI*2; const sp = Number(b.speed) || 120;
      b.vx = Math.cos(ang)*sp; b.vy = Math.sin(ang)*sp;

      // randomize weapon start angle
      if(b.weapon) b.weapon.angle = Math.random()*360;

      // reset weapon firing timers
      b.weapon.lastFired = 0;
    });

    overlay.classList.remove('hidden'); loadingText.innerText = 'Initializing...'; countdownEl.classList.add('hidden');
    setTimeout(()=>{
      loadingText.innerText = '';
      runCountdown(3, ()=>{
        overlay.classList.add('hidden');
        simRunning = true;
        last = performance.now();
        zone.startTime = performance.now();
        // zone delayed visibility
        if(zone.enabled) setTimeout(()=>{ zone.visible = true; }, zone.spawnDelay * 1000);
        rafId = requestAnimationFrame(simLoop);
      });
    }, 600);
  }

  function simLoop(now){
    if(!simRunning){
      if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
      return;
    }
    const dt = Math.min(0.04, (now - last)/1000);
    last = now;
    const w = spawnCanvas.clientWidth, h = spawnCanvas.clientHeight;

    // spawn powerups templates scheduling
    for(const tpl of powerupTemplates){
      if(!tpl.nextSpawnAt || Date.now() >= tpl.nextSpawnAt){
        spawnPowerupInstance(tpl);
        const delay = (tpl.spawnMin || 3) * 1000 + Math.random()*((tpl.spawnMax || 6) *1000 - (tpl.spawnMin||3)*1000);
        tpl.nextSpawnAt = Date.now() + Math.max(1000, delay);
      }
    }

    // projectiles update
    for(let i = projectiles.length-1; i>=0; i--){
      const p = projectiles[i];
      // homing if required
      if(p.homingRange > 0 && p.turnSpeed > 0){
        // find nearest enemy
        let target = null; let bestd = Infinity;
        for(const b of balls){
          if(b.id === p.ownerId || b.defeated) continue;
          const d = Math.hypot(b.x - p.x, b.y - p.y);
          if(d < p.homingRange && d < bestd){ bestd = d; target = b; }
        }
        if(target){
          const tx = target.x - p.x, ty = target.y - p.y; const len = Math.hypot(tx,ty);
          if(len > 0){
            const nx = tx/len, ny = ty/len;
            // adjust velocity by rotating toward target limited by turnSpeed * dt (approx)
            const speed = Math.hypot(p.vx, p.vy) || 1;
            const desiredVx = nx*speed, desiredVy = ny*speed;
            const t = Math.min(1, (p.turnSpeed * dt) / 180); // simple lerp depending on turnSpeed
            p.vx = p.vx*(1-t) + desiredVx*t;
            p.vy = p.vy*(1-t) + desiredVy*t;
          }
        }
      }
      p.x += p.vx*dt; p.y += p.vy*dt;
      // remove if out of bounds or expired
      if(p.x < -20 || p.y < -20 || p.x > w+20 || p.y > h+20 || Date.now() - p.createdAt > p.life){
        projectiles.splice(i,1); continue;
      }
      // check collision with balls
      for(const b of balls){
        if(b.id === p.ownerId || b.defeated) continue;
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if(d <= b.r + (p.radius||4)){
          // apply damage
          if(b.hpType === 'segmented'){ b.hpCur = Math.max(0, b.hpCur - Math.floor(p.dmg)); if(b.hpCur<=0) b.defeated=true; }
          else { b.hpCur = Math.max(0, b.hpCur - p.dmg); if(b.hpCur<=0) b.defeated=true; }
          // remove projectile
          const idx = projectiles.indexOf(p);
          if(idx>=0) projectiles.splice(idx,1);
          break;
        }
      }
    }

    // update ball positions & basic boundaries
    for(const b of balls){
      if(!b.alive || b.defeated) continue;
      b.x += (b.vx || 0) * dt;
      b.y += (b.vy || 0) * dt;
      if(b.x - b.r < 0){ b.x = b.r; b.vx *= -1; }
      if(b.y - b.r < 0){ b.y = b.r; b.vy *= -1; }
      if(b.x + b.r > w){ b.x = w - b.r; b.vx *= -1; }
      if(b.y + b.r > h){ b.y = h - b.r; b.vy *= -1; }
    }

    // ball-ball collisions (with optional speed transfer)
    for(let i=0;i<balls.length;i++){
      const A = balls[i]; if(!A.alive || A.defeated) continue;
      for(let j=i+1;j<balls.length;j++){
        const B = balls[j]; if(!B.alive || B.defeated) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const dist = Math.hypot(dx,dy); const minD = A.r + B.r;
        if(dist < minD && dist > 0){
          const nx = dx/dist, ny = dy/dist;
          // elastic response
          const p = 2*(A.vx*nx + A.vy*ny - B.vx*nx - B.vy*ny)/2;
          A.vx -= p*nx; A.vy -= p*ny; B.vx += p*nx; B.vy += p*ny;
          const overlap = (minD - dist)/2;
          A.x -= nx*overlap; A.y -= ny*overlap; B.x += nx*overlap; B.y += ny*overlap;

          // damage on contact
          applyDamage(A,B);

          // physics - speed transfer if enabled
          if(physicsSpeedTransfer && physicsSpeedTransfer.checked){
            // simple speed transfer: exchange a fraction of speed difference
            const speedA = Math.hypot(A.vx, A.vy), speedB = Math.hypot(B.vx, B.vy);
            const avg = (speedA + speedB) / 2;
            const transfer = 0.25; // 25% towards equalizing
            if(speedA > speedB){
              const dirAx = A.vx/(speedA||1), dirAy = A.vy/(speedA||1);
              B.vx += dirAx * (speedA - speedB) * transfer;
              B.vy += dirAy * (speedA - speedB) * transfer;
              A.vx *= (1 - transfer); A.vy *= (1 - transfer);
            } else if(speedB > speedA){
              const dirBx = B.vx/(speedB||1), dirBy = B.vy/(speedB||1);
              A.vx += dirBx * (speedB - speedA) * transfer;
              A.vy += dirBy * (speedB - speedA) * transfer;
              B.vx *= (1 - transfer); B.vy *= (1 - transfer);
            }
          }
        }
      }
    }

    // weapon melee rotations & ranged firing
    for(const b of balls){
      if(!b.alive || b.defeated || !b.weaponEnabled) continue;
      const w = b.weapon;
      if(w.type === 'melee'){
        w.angle = ((w.angle || 0) + (w.rotSpeed || 180) * dt) % 360;
      } else if(w.type === 'ranged'){
        // attempt to fire based on cooldown
        if((Date.now() - (w.lastFired||0)) / 1000 >= (w.fireCooldown||0.7)){
          // find target within lockRange
          let target = null; let bestd = Infinity;
          for(const other of balls){
            if(other.id === b.id || other.defeated) continue;
            const d = Math.hypot(other.x - b.x, other.y - b.y);
            if(d < (w.lockRange || 220) && d < bestd){ bestd = d; target = other; }
          }
          // compute projectile direction
          let dx = Math.cos((w.angle||0) * Math.PI/180), dy = Math.sin((w.angle||0) * Math.PI/180);
          if(target){
            dx = (target.x - b.x); dy = (target.y - b.y);
            const L = Math.hypot(dx,dy); if(L>0){ dx/=L; dy/=L; }
          } else {
            // random spread
            const a = Math.random() * Math.PI*2;
            dx = Math.cos(a); dy = Math.sin(a);
          }
          const pspeed = w.projSpeed || 420;
          spawnProjectile(b, b.x + dx*(b.r+8), b.y + dy*(b.r+8), dx*pspeed, dy*pspeed, w.projDmg || 10, 4000, w.projHomingRange || 0, w.projTurn || 0);
          w.lastFired = Date.now();
        }
      }
    }

    // powerup instance collisions (pickup) and expiry
    for(let i = powerupInstances.length-1; i>=0; i--){
      const p = powerupInstances[i];
      if(Date.now() > p.expiresAt){ powerupInstances.splice(i,1); continue; }
      for(const b of balls){
        if(b.defeated) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if(d <= (p.r + b.r)){
          const tpl = powerupTemplates.find(t=>t.id===p.tplId);
          if(tpl){ applyPowerupToBall(tpl, b); }
          powerupInstances.splice(i,1);
          break;
        }
      }
    }

    // regen
    for(const b of balls){ if(!b.alive || b.defeated) continue; if(b.hpType !== 'segmented' && b.regen) b.hpCur = Math.min(b.maxHP, b.hpCur + b.regen * dt); }

    // zone damage (only if enabled & visible & past damage delay)
    if(zone.enabled && zone.visible){
      const elapsed = (performance.now() - zone.startTime)/1000;
      const minDim = Math.min(spawnCanvas.clientWidth, spawnCanvas.clientHeight);
      const startR = (minDim/2) * (zone.startPct/100);
      if(elapsed >= zone.delay + zone.damageDelay){
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
      if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
      return;
    }

    rafId = requestAnimationFrame(simLoop);
  }

  // ---------------- Damage helpers ----------------
  const pairCooldown = new Map();
  function pairKey(a,b){ return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`; }

  function applyDamage(A,B){
    const now = Date.now();
    const key = pairKey(A,B);
    if(pairCooldown.has(key) && now - pairCooldown.get(key) < 250) return;
    pairCooldown.set(key, now);
    const dmgA = Number(A.damage) || 1;
    const dmgB = Number(B.damage) || 1;
    deal(A,B,dmgA); deal(B,A,dmgB);
  }
  function deal(attacker, victim, dmg){
    if(!victim.alive || victim.defeated) return;
    if(victim.hpType === 'segmented'){ const loss = Math.max(1, Math.floor(dmg)); victim.hpCur = Math.max(0, victim.hpCur - loss); if(victim.hpCur <= 0) victim.defeated = true; }
    else { victim.hpCur = Math.max(0, victim.hpCur - dmg); if(victim.hpCur <= 0) victim.defeated = true; }
  }

  // ---------------- Winner / UI ----------------
  function showWinner(b){
    winnerPopup.classList.remove('hidden');
    if(!b){ winnerText.innerText = 'No winner'; winnerIcon.style.background = '#fff'; }
    else {
      winnerText.innerText = `${b.name} WON!`;
      if(b._imgObj && b.img){ winnerIcon.style.backgroundImage = `url(${b.img})`; winnerIcon.style.backgroundSize = 'cover'; winnerIcon.style.backgroundPosition = 'center'; }
      else { winnerIcon.style.backgroundImage = ''; winnerIcon.style.backgroundColor = b.color || '#ddd'; }
    }
  }

  exitEditor.addEventListener('click', ()=>{ winnerPopup.classList.add('hidden'); drawPreview(); });
  exitMenu.addEventListener('click', ()=>{ location.href = 'index.html'; });

  // End Game button
  endBtn.addEventListener('click', ()=>{
    if(!simRunning) return;
    simRunning = false;
    if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    overlay.classList.add('hidden');
    const editorArea = document.querySelector('.editor-area');
    if(editorArea) editorArea.classList.remove('disabled');
    zone.running = false; zone.visible = false;
    // stop motion but keep flags
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

  // preview toggle
  previewToggle?.addEventListener('click', ()=>{
    if(!previewWrap) return; previewWrap.classList.toggle('expanded'); resizeCanvas(); drawPreview();
  });

  // back button
  backBtn?.addEventListener('click', ()=>{ document.body.style.opacity = 0; setTimeout(()=> location.href='index.html', 260); });

  // initial canvas + defaults
  resizeCanvas();
  if(balls.length === 0){ createBall(); createBall(); }
  ensureDefaultPowerups();
  updateAddButton();
  drawPreview();

  // add ball
  addBtn?.addEventListener('click', ()=>{ createBall(); });

  // powerups UI
  addPowerupBtn?.addEventListener('click', ()=>{ createPowerupTemplate(); });

  // global icon picker delegation
  document.addEventListener('click', (e)=>{
    const ip = e.target.closest('.icon-picker');
    if(ip){
      selectedIconTarget = ip.getAttribute('data-id');
      iconModal.classList.remove('hidden'); modalFile.value=''; modalColor.value='#ff7f50';
    }
  });

  // modal periodic icon update
  setInterval(()=>{ balls.forEach(b=>updateIconPreview(b)); powerupTemplates.forEach(t=>{ if(t._imgObj && t._imgObj.complete) { /*nothing*/ } }); }, 800);

  // weapon modal preview
  function renderWeaponPreview(w){
    if(!weaponCtx) return;
    weaponCtx.clearRect(0,0,weaponCanvas.width,weaponCanvas.height);
    const cx = weaponCanvas.width/2, cy = weaponCanvas.height/2;
    weaponCtx.beginPath(); weaponCtx.fillStyle = '#6ce0ff'; weaponCtx.arc(cx,cy,28,0,Math.PI*2); weaponCtx.fill();
    const angle = 0;
    const tipX = cx + Math.cos(angle) * (28 + (w.length||48));
    const tipY = cy + Math.sin(angle) * (28 + (w.length||48));
    weaponCtx.beginPath(); weaponCtx.moveTo(cx,cy); weaponCtx.lineTo(tipX,tipY); weaponCtx.lineWidth = w.width || 10; weaponCtx.strokeStyle = '#2b3b44'; weaponCtx.stroke();
    if(w._imgObj && w._imgObj.complete){ weaponCtx.save(); weaponCtx.translate(tipX,tipY); weaponCtx.rotate(angle); const sw=(w.width||10)*1.5, sh=(w.length||48); weaponCtx.drawImage(w._imgObj,-sw/2,-sh/2,sw,sh); weaponCtx.restore(); }
    if(w.gunObj && w.gunObj.complete){
      weaponCtx.save(); weaponCtx.translate(cx - 6, cy - 6); weaponCtx.rotate(Math.PI); weaponCtx.drawImage(w.gunObj, -14, -9, 28, 18); weaponCtx.restore();
    }
  }

  // weapon file handlers
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
  weaponGunFile?.addEventListener('change', ()=>{
    const f = weaponGunFile.files && weaponGunFile.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{ const img = new Image(); img.onload = ()=>{ /* nothing */ }; img.src = r.result; weaponGunFile._img = img; };
    r.readAsDataURL(f);
  });
  weaponBulletFile?.addEventListener('change', ()=>{
    const f = weaponBulletFile.files && weaponBulletFile.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{ const img = new Image(); img.onload = ()=>{ /* nothing */ }; img.src = r.result; weaponBulletFile._img = img; };
    r.readAsDataURL(f);
  });

  // weapon modal type toggles
  weaponTypeMelee?.addEventListener('click', ()=>{ currentWeaponType='melee'; weaponRangedBlock.classList.add('hidden'); weaponTypeMelee.classList.add('active'); weaponTypeRanged.classList.remove('active'); });
  weaponTypeRanged?.addEventListener('click', ()=>{ currentWeaponType='ranged'; weaponRangedBlock.classList.remove('hidden'); weaponTypeRanged.classList.add('active'); weaponTypeMelee.classList.remove('active'); });

  // weapon apply
  weaponApply.addEventListener('click', ()=>{
    if(!currentWeaponTarget){ weaponModal.classList.add('hidden'); return; }
    const b = balls.find(x=>x.id === currentWeaponTarget); if(!b){ weaponModal.classList.add('hidden'); return; }
    const file = weaponFile.files && weaponFile.files[0];
    const w = b.weapon || {};
    w.type = currentWeaponType || 'melee';
    w.damage = Number(weaponDamage.value) || 8;
    w.rotSpeed = Number(weaponRot.value) || 180;
    w.parry = Math.max(0, Math.min(100, Number(weaponParry.value) || 0));
    w.width = Number(weaponWidth.value) || 10;
    w.length = Number(weaponLength.value) || 48;

    // ranged fields
    w.lockRange = Number(weaponLockRange && weaponLockRange.value) || 220;
    w.fireCooldown = Number(weaponFireCooldown && weaponFireCooldown.value) || 0.7;
    w.projSpeed = Number(weaponProjSpeed && weaponProjSpeed.value) || 420;
    w.projDmg = Number(weaponProjDmg && weaponProjDmg.value) || 12;
    w.projHomingRange = Number(weaponProjHomingRange && weaponProjHomingRange.value) || 0;
    w.projTurn = Number(weaponProjTurn && weaponProjTurn.value) || 0;

    if(file){
      const reader = new FileReader();
      reader.onload = ()=>{
        w.img = reader.result; w._imgObj = new Image(); w._imgObj.src = w.img; b.weapon = w; weaponModal.classList.add('hidden'); drawPreview();
      };
      reader.readAsDataURL(file);
    } else {
      if(!w._imgObj && !w.img){ w.img = w.img || defaultWeaponPreset; w._imgObj = new Image(); w._imgObj.src = w.img; }
      // gun/bullet from separate inputs (if present)
      // use file inputs if provided
      if(weaponGunFile && weaponGunFile.files && weaponGunFile.files[0]){
        const fr = new FileReader();
        fr.onload = ()=>{ w.gunImg = fr.result; w.gunObj = new Image(); w.gunObj.src = w.gunImg; b.weapon = w; weaponModal.classList.add('hidden'); drawPreview(); };
        fr.readAsDataURL(weaponGunFile.files[0]);
      } else {
        if(!w.gunObj && !w.gunImg){ w.gunImg = w.gunImg || defaultGunPreset; w.gunObj = new Image(); w.gunObj.src = w.gunImg; }
      }
      if(weaponBulletFile && weaponBulletFile.files && weaponBulletFile.files[0]){
        const fr2 = new FileReader();
        fr2.onload = ()=>{ w.bulletImg = fr2.result; w.bulletObj = new Image(); w.bulletObj.src = w.bulletImg; b.weapon = w; weaponModal.classList.add('hidden'); drawPreview(); };
        fr2.readAsDataURL(weaponBulletFile.files[0]);
      } else {
        if(!w.bulletObj && !w.bulletImg){ w.bulletImg = w.bulletImg || defaultBulletPreset; w.bulletObj = new Image(); w.bulletObj.src = w.bulletImg; }
      }
      b.weapon = w;
      weaponModal.classList.add('hidden');
      drawPreview();
    }
    currentWeaponTarget = null;
  });

  weaponCancel.addEventListener('click', ()=>{ weaponModal.classList.add('hidden'); currentWeaponTarget = null; });

  // panel switching (balls/zone/powerups/physics)
  selBalls?.addEventListener('click', ()=>{
    selBalls.classList.add('sel-active'); selZone.classList.remove('sel-active'); selPowerups.classList.remove('sel-active');
    animatePanelSwitch(zonePanel, ballPanel);
    animatePanelSwitch(powerupsPanel, null);
    animatePanelSwitch(physicsPanel, null);
  });
  selZone?.addEventListener('click', ()=>{
    selZone.classList.add('sel-active'); selBalls.classList.remove('sel-active'); selPowerups.classList.remove('sel-active');
    animatePanelSwitch(ballPanel, zonePanel);
    animatePanelSwitch(powerupsPanel, null);
    animatePanelSwitch(physicsPanel, null);
  });
  selPowerups?.addEventListener('click', ()=>{
    selPowerups.classList.add('sel-active'); selBalls.classList.remove('sel-active'); selZone.classList.remove('sel-active');
    animatePanelSwitch(ballPanel, powerupsPanel);
    animatePanelSwitch(zonePanel, null);
    animatePanelSwitch(physicsPanel, null);
  });

  // helper animatePanelSwitch (keep simple)
  function animatePanelSwitch(hideEl, showEl){
    if(hideEl && hideEl !== showEl){ hideEl.classList.add('hidden'); hideEl.setAttribute('aria-hidden','true'); }
    if(showEl){ showEl.classList.remove('hidden'); showEl.setAttribute('aria-hidden','false'); }
  }

  // expose drawPreview for SPA reloads
  window.drawPreview = drawPreview;

})();
