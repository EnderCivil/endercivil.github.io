// Battles.js - prototype behavior

const arenaCanvas = document.getElementById('arenaCanvas');
const arenaCtx = arenaCanvas.getContext('2d');
const addBallBtn = document.getElementById('addBallBtn');
const ballList = document.getElementById('ballList');
const customModal = document.getElementById('customModal');
const closeModal = document.getElementById('closeModal');
const modalTabs = document.getElementById('modalTabs');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const editor = document.getElementById('editor');

let ballsData = []; // saved editor definitions
let activeEditIndex = null;
let gameActive = false;

// Weapon assets
const weapons = [
  { id:'sword', name:'Basic Sword', type:'melee', src:'https://png.pngtree.com/png-clipart/20250110/original/pngtree-cartoon-sword-with-intricate-hilt-design-png-image_19840812.png', unlocked:true },
  { id:'axe', name:'Basic Axe', type:'melee', src:'https://wallpapers.com/images/hd/cartoon-axe-illustration-wurke62yv8ducs53-2.jpg', unlocked:true, angleOffset:45 },
  { id:'bow', name:'Basic Bow', type:'ranged', src:'https://static.vecteezy.com/system/resources/thumbnails/017/051/557/small/cartoon-cupid-s-bow-valentine-s-day-love-symbols-for-gifts-cards-posters-png.png', unlocked:true }
];

const baseColors = ['#ffffff','#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#16a085','#95a5a6','#d35400'];

// Resize arena canvas to be square inside the arena element
function resizeCanvas() {
  const arenaRect = arenaCanvas.getBoundingClientRect();
  arenaCanvas.width = arenaRect.width;
  arenaCanvas.height = arenaRect.height;
}

window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas,50);

// Utilities
function uid(){return Math.random().toString(36).slice(2,9)}

// Render editor's ball list
function renderBallList(){
  ballList.innerHTML='';
  ballsData.forEach((b,idx)=>{
    const card = document.createElement('div');card.className='ball-card';
    const icon = document.createElement('div');icon.className='ball-icon';icon.style.background=b.color||'#2b6cb0';
    const name = document.createElement('div');name.className='ball-name';name.textContent=b.name||('Ball '+(idx+1));
    name.addEventListener('click',()=>openCustomiser(idx));
    const actions = document.createElement('div');actions.className='ball-actions';
    const del = document.createElement('button');del.textContent='Delete';del.addEventListener('click',()=>{ballsData.splice(idx,1);renderBallList()});
    actions.appendChild(del);
    card.appendChild(icon);card.appendChild(name);card.appendChild(actions);
    ballList.appendChild(card);
  })
}

addBallBtn.addEventListener('click',()=>{
  const def = { id:uid(), name:'New Ball', hp:100, speed:2, defChance:0, color:baseColors[0], weapon:{id:'sword',fireRate:1,projSpeed:4,spin:1,damage:10,track:0} };
  ballsData.push(def); renderBallList();
});

// Modal open/close
function openCustomiser(index){
  activeEditIndex=index; const b=ballsData[index];
  document.getElementById('modalTitle').textContent='Customize: '+(b.name||'Ball');
  // fill stats
  document.getElementById('statHP').value=b.hp;
  document.getElementById('statSpeed').value=b.speed;
  document.getElementById('statDef').value=b.defChance;
  // weapon values
  document.getElementById('wpFireRate').value=b.weapon.fireRate||1;
  document.getElementById('wpProjSpeed').value=b.weapon.projSpeed||4;
  document.getElementById('wpSpin').value=b.weapon.spin||1;
  document.getElementById('wpDamage').value=b.weapon.damage||10;
  document.getElementById('wpTrack').value=b.weapon.track||0;

  // build galleries
  buildWeaponGalleries(); buildColorGallery();

  customModal.classList.remove('hidden');
}

closeModal.addEventListener('click',()=>{customModal.classList.add('hidden');activeEditIndex=null});

// Tabs inside modal
modalTabs.addEventListener('click',(e)=>{
  if(!e.target.classList.contains('tab'))return;
  modalTabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  e.target.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.getElementById(e.target.dataset.tab).classList.add('active');
});

// Build weapon galleries
function buildWeaponGalleries(){
  const melee = document.getElementById('meleeGallery'); melee.innerHTML='';
  const ranged = document.getElementById('rangedGallery'); ranged.innerHTML='';
  weapons.forEach(w=>{
    const img = document.createElement('img'); img.src=w.src; img.title=w.name;
    if(!w.unlocked){ img.classList.add('weapon-locked'); }
    img.addEventListener('click',()=>{
      if(!w.unlocked) return; // locked
      // set this weapon on active edit
      const b = ballsData[activeEditIndex];
      b.weapon.id=w.id; b.weapon.type=w.type;
      renderWeaponPreview();
    });
    if(w.type==='melee') melee.appendChild(img); else ranged.appendChild(img);
  })
}

// Weapon preview rendering (left side of weapons tab)
const wpPreview = document.getElementById('weaponPreview');
const wpCtx = wpPreview.getContext('2d');
let wpAngle = 0;
function renderWeaponPreview(){
  const b = ballsData[activeEditIndex];
  if(!b) return; wpCtx.clearRect(0,0,wpPreview.width,wpPreview.height);
  const cx=wpPreview.width/2, cy=wpPreview.height/2;
  // draw ball
  wpCtx.beginPath(); wpCtx.fillStyle=b.color; wpCtx.arc(cx,cy,26,0,Math.PI*2); wpCtx.fill(); wpCtx.closePath();
  // find weapon asset
  const w = weapons.find(x=>x.id===b.weapon.id) || weapons[0];
  // draw weapon image orbiting
  const orbitR = 60;
  wpAngle += (b.weapon.spin||1)*0.03;
  const rad = wpAngle;
  const img = new Image(); img.crossOrigin='anonymous'; img.src=w.src;
  img.onload = ()=>{
    let drawX = cx + Math.cos(rad)*orbitR; let drawY = cy + Math.sin(rad)*orbitR;
    const iw=36, ih=36;
    wpCtx.save();
    wpCtx.translate(drawX,drawY);
    // account for special angle offset for axe
    const angle = (w.angleOffset||0) * Math.PI/180 + rad;
    wpCtx.rotate(angle);
    wpCtx.drawImage(img,-iw/2,-ih/2,iw,ih);
    wpCtx.restore();
  }
}
setInterval(()=>{ if(!customModal.classList.contains('hidden') && document.querySelector('.tab.active').dataset.tab==='weaponsTab'){ renderWeaponPreview(); } },40);

// Color gallery
function buildColorGallery(){
  const cg = document.getElementById('colorGallery'); cg.innerHTML='';
  baseColors.forEach((c,idx)=>{
    const sw = document.createElement('div'); sw.className='color-sw'; sw.style.background=c;
    sw.addEventListener('click',()=>{ ballsData[activeEditIndex].color=c; document.querySelectorAll('.ball-icon')[activeEditIndex].style.background=c; renderWeaponPreview(); });
    cg.appendChild(sw);
  })
}

// Save custom changes
document.getElementById('saveCustom').addEventListener('click',()=>{
  const b = ballsData[activeEditIndex];
  b.hp = parseFloat(document.getElementById('statHP').value);
  b.speed = parseFloat(document.getElementById('statSpeed').value);
  b.defChance = parseFloat(document.getElementById('statDef').value);
  // weapon
  b.weapon.fireRate = parseFloat(document.getElementById('wpFireRate').value);
  b.weapon.projSpeed = parseFloat(document.getElementById('wpProjSpeed').value);
  b.weapon.spin = parseFloat(document.getElementById('wpSpin').value);
  b.weapon.damage = parseFloat(document.getElementById('wpDamage').value);
  b.weapon.track = parseFloat(document.getElementById('wpTrack').value);

  renderBallList(); customModal.classList.add('hidden'); activeEditIndex=null;
});

// Start / Stop Game
let simBalls = [];
startBtn.addEventListener('click',()=>{
  if(ballsData.length===0) return alert('Add at least one ball');
  gameActive=true; editor.classList.add('locked'); startBtn.disabled=true; stopBtn.disabled=false;
  // populate simBalls using definitions
  simBalls = ballsData.map((d,idx)=>({
    id:d.id, name:d.name||('Ball'+(idx+1)), x:50+idx*30, y:50+idx*20, vx:(Math.random()*2-1)*d.speed, vy:(Math.random()*2-1)*d.speed, hp:d.hp, maxHp:d.hp, color:d.color, weapon:JSON.parse(JSON.stringify(d.weapon))
  }));
  // start render loop
  resizeCanvas(); requestAnimationFrame(loop);
});

stopBtn.addEventListener('click',()=>{ gameActive=false; editor.classList.remove('locked'); startBtn.disabled=false; stopBtn.disabled=true; // reset
  simBalls=[]; clearArena(); renderBallList();
});

function clearArena(){ arenaCtx.clearRect(0,0,arenaCanvas.width,arenaCanvas.height); }

function loop(){ if(!gameActive) return; const w=arenaCanvas.width,h=arenaCanvas.height; arenaCtx.clearRect(0,0,w,h);
  // simple movement and draw
  simBalls.forEach(b=>{
    b.x += b.vx; b.y += b.vy;
    if(b.x<30||b.x>w-30) b.vx*=-1; if(b.y<30||b.y>h-30) b.vy*=-1;
    // draw ball
    arenaCtx.beginPath(); arenaCtx.fillStyle=b.color; arenaCtx.arc(b.x,b.y,24,0,Math.PI*2); arenaCtx.fill(); arenaCtx.closePath();
    // draw health UI
    const uiX=b.x; const uiY=b.y-34;
    arenaCtx.fillStyle='rgba(0,0,0,0.5)'; arenaCtx.fillRect(uiX-40,uiY-12,80,18);
    arenaCtx.fillStyle='#333'; arenaCtx.fillRect(uiX-36,uiY-10,72,12);
    const hpPerc = Math.max(0,b.hp)/b.maxHp; arenaCtx.fillStyle='#e74c3c'; arenaCtx.fillRect(uiX-36,uiY-10,72*hpPerc,12);
    arenaCtx.fillStyle='#fff'; arenaCtx.font='12px sans-serif'; arenaCtx.textAlign='center'; arenaCtx.fillText(Math.round(b.hp)+' / '+b.maxHp,uiX,uiY-18);
  });
  requestAnimationFrame(loop);
}

function renderBallList(){
  // update icons (in editor) to reflect colors
  document.querySelectorAll('.ball-icon').forEach((el,idx)=>{ el.style.background = ballsData[idx].color; });
}

// initialize demo gallery population when modal opens if needed
// Prebuild galleries so images are cached
buildWeaponGalleries();

// Basic keyboard: Esc to close modal
window.addEventListener('keydown',(e)=>{ if(e.key==='Escape' && !customModal.classList.contains('hidden')){ customModal.classList.add('hidden'); } });

// Hook up save/cancel that close modal
document.getElementById('cancelCustom').addEventListener('click',()=>{ customModal.classList.add('hidden'); activeEditIndex=null });

// Small initial state
ballsData.push({ id:uid(), name:'Alpha', hp:120, speed:2.2, defChance:0, color:baseColors[1], weapon:{id:'sword',fireRate:1,projSpeed:4,spin:1,damage:10,track:0} });
ballsData.push({ id:uid(), name:'Beta', hp:90, speed:2.6, defChance:5, color:baseColors[2], weapon:{id:'axe',fireRate:0.8,projSpeed:0,spin:1.2,damage:14,track:0} });
renderBallList();
