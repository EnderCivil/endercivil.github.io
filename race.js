// race.js - Level editor with parts palette, placement, resizing, presets (localStorage)
(() => {
  const levelEditor = document.getElementById('levelEditor');
  const partsPalette = document.getElementById('partsPalette');
  const partsList = document.getElementById('partsList');
  const presetsList = document.getElementById('presetsList');
  const savePresetBtn = document.getElementById('savePreset');
  const importPresetBtn = document.getElementById('importPreset');
  const exportPresetBtn = document.getElementById('exportPreset');

  const partConfigModal = document.getElementById('partConfigModal');
  const partConfigBody = document.getElementById('partConfigBody');
  const partConfigTitle = document.getElementById('partConfigTitle');
  const partConfigSave = document.getElementById('partConfigSave');
  const partConfigCancel = document.getElementById('partConfigCancel');

  const backBtn = document.getElementById('backBtn');
  backBtn?.addEventListener('click', ()=> location.href='index.html');

  // available part types
  const PART_TYPES = [
    { id:'rectangle', name:'Rectangle' },
    { id:'damageBarrier', name:'Damage Barrier' },
    { id:'piston', name:'Piston' },
    { id:'finishLine', name:'Finish Line' },
    { id:'acid', name:'Acid' }
  ];

  let parts = []; // placed parts
  let templates = []; // presets saved
  let placingType = null;
  let selectedPart = null;

  // create palette
  function buildPalette(){
    partsPalette.innerHTML = '';
    PART_TYPES.forEach(t=>{
      const btn = document.createElement('button'); btn.className='menu-btn small'; btn.innerText = t.name; btn.dataset.type = t.id;
      btn.addEventListener('click', ()=>{ placingType = t.id; btn.classList.add('active'); setTimeout(()=>btn.classList.remove('active'), 160); });
      partsPalette.appendChild(btn);
    });
  }

  // helper create DOM element for part
  function createPartElement(p){
    const el = document.createElement('div');
    el.className = 'level-part';
    el.dataset.id = p.id; el.style.position='absolute'; el.style.left = p.x+'px'; el.style.top = p.y+'px';
    el.style.width = p.w+'px'; el.style.height = p.h+'px'; el.style.background = p.type==='acid' ? 'rgba(80,200,100,0.22)' : '#ffffff';
    el.style.border = '2px solid rgba(10,20,30,0.06)'; el.style.borderRadius='6px'; el.style.display='flex'; el.style.alignItems='center'; el.style.justifyContent='center';
    el.innerHTML = `<div style="pointer-events:none;font-size:12px;color:#10202b;">${p.type}</div>`;

    // selection
    el.addEventListener('click', (e)=>{ e.stopPropagation(); selectPart(p.id); });
    // double-click to configure
    el.addEventListener('dblclick', (e)=>{ e.stopPropagation(); openConfig(p.id); });

    // add resize handle
    const handle = document.createElement('div'); handle.style.width='12px'; handle.style.height='12px'; handle.style.position='absolute'; handle.style.right='-6px'; handle.style.bottom='-6px'; handle.style.cursor='se-resize'; handle.style.background='#bcd'; handle.style.borderRadius='3px'; el.appendChild(handle);

    // resizing
    let resizing = false; let start = null; handle.addEventListener('pointerdown', (ev)=>{ ev.stopPropagation(); resizing=true; start={px:ev.clientX, py:ev.clientY, ow: p.w, oh: p.h}; handle.setPointerCapture(ev.pointerId); });
    window.addEventListener('pointermove', (ev)=>{ if(!resizing) return; const dx = ev.clientX - start.px; const dy = ev.clientY - start.py; p.w = Math.max(24, Math.round(start.ow + dx)); p.h = Math.max(24, Math.round(start.oh + dy)); el.style.width = p.w+'px'; el.style.height = p.h+'px'; });
    window.addEventListener('pointerup', (ev)=>{ if(resizing){ resizing=false; try{ handle.releasePointerCapture(ev.pointerId);}catch(e){} } });

    // dragging
    let dragging = false; let dragStart = null;
    el.addEventListener('pointerdown', (ev)=>{ ev.stopPropagation(); if(ev.target===handle) return; dragging=true; dragStart={mx:ev.clientX, my:ev.clientY, sx:p.x, sy:p.y}; el.setPointerCapture(ev.pointerId); });
    window.addEventListener('pointermove', (ev)=>{ if(!dragging) return; const dx = ev.clientX - dragStart.mx; const dy = ev.clientY - dragStart.my; p.x = Math.max(0, Math.round(dragStart.sx + dx)); p.y = Math.max(0, Math.round(dragStart.sy + dy)); el.style.left = p.x+'px'; el.style.top = p.y+'px'; });
    window.addEventListener('pointerup', (ev)=>{ if(dragging){ dragging=false; try{ el.releasePointerCapture(ev.pointerId);}catch(e){} } });

    return el;
  }

  // place part at position
  function placePart(type, x, y){
    const p = { id: 'p-'+Math.random().toString(36).slice(2,9), type, x, y, w:120, h:80, config:{} };
    // default configs
    if(type==='damageBarrier') p.config.hp = 120;
    if(type==='piston') p.config.direction='down'; p.config.distance = 80; p.config.speed=80; p.config.retract=true; p.config.delay=0;
    if(type==='finishLine') p.config.maxFinishers = 1;
    if(type==='acid') p.config.instantKill=false; p.config.dps = 8;

    parts.push(p);
    const el = createPartElement(p);
    levelEditor.appendChild(el);
    selectPart(p.id);
  }

  // selection
  function selectPart(id){ selectedPart = parts.find(pp=>pp.id===id); // highlight
    Array.from(levelEditor.querySelectorAll('.level-part')).forEach(el=>{ el.style.boxShadow = el.dataset.id===id ? '0 6px 18px rgba(30,80,120,0.08)' : 'none'; });
  }

  // open config modal
  function openConfig(id){ const p = parts.find(pp=>pp.id===id); if(!p) return; partConfigModal.classList.remove('hidden'); partConfigModal.setAttribute('aria-hidden','false'); partConfigTitle.innerText = 'Configure: '+p.type; partConfigBody.innerHTML = '';
    if(p.type==='damageBarrier'){
      partConfigBody.innerHTML = `<div class="field-inline"><label>HP</label><input id="cfg_hp" type="number" value="${p.config.hp||100}"/></div>`;
    } else if(p.type==='piston'){
      partConfigBody.innerHTML = `<div class="field-inline"><label>Direction</label><select id="cfg_dir"><option value="down">Down</option><option value="up">Up</option><option value="left">Left</option><option value="right">Right</option></select></div>
      <div class="field-inline"><label>Distance</label><input id="cfg_dist" type="number" value="${p.config.distance||80}"/></div>
      <div class="field-inline"><label>Speed</label><input id="cfg_speed" type="number" value="${p.config.speed||80}"/></div>
      <div class="field-inline"><label>Retract</label><input id="cfg_retract" type="checkbox" ${p.config.retract? 'checked':''}/></div>
      <div class="field-inline"><label>Delay (s)</label><input id="cfg_delay" type="number" value="${p.config.delay||0}"/></div>`;
      partConfigBody.querySelector('#cfg_dir').value = p.config.direction || 'down';
    } else if(p.type==='finishLine'){
      partConfigBody.innerHTML = `<div class="field-inline"><label>Max Finishers</label><input id="cfg_max" type="number" value="${p.config.maxFinishers||1}"/></div>`;
    } else if(p.type==='acid'){
      partConfigBody.innerHTML = `<div class="field-inline"><label>Instant Kill</label><input id="cfg_instant" type="checkbox" ${p.config.instantKill? 'checked':''}/></div>
      <div class="field-inline"><label>DPS</label><input id="cfg_dps" type="number" value="${p.config.dps||8}"/></div>`;
    } else {
      partConfigBody.innerHTML = `<div class="field-inline">No configurable options for this part.</div>`;
    }

    partConfigSave.onclick = ()=>{
