/* Battles editor & preview logic
 - add ball with default name + random color
 - icon picker modal: choose color or upload image
 - live preview on spawn canvas (white arena)
 - draggable balls in preview to set spawn points
 - tooltips (?) for each field
*/

(() => {
  // DOM refs
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

  // canvas setup
  function setupCanvas() {
    const r = spawnCanvas.getBoundingClientRect();
    spawnCanvas.width = r.width * devicePixelRatio;
    spawnCanvas.height = r.height * devicePixelRatio;
    const ctx = spawnCanvas.getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
    return ctx;
  }
  let ctx = setupCanvas();
  window.addEventListener('resize', () => ctx = setupCanvas());

  // data models
  let balls = []; // { id, name, color, img, maxHP, hpType, regen, damage, x, y, r }
  let selectedIconTarget = null; // {ballId}

  // helpers
  const randColor = () => {
    const h = Math.floor(Math.random() * 360);
    const s = 70 + Math.floor(Math.random() * 20);
    return `hsl(${h} ${s}% 60%)`;
  };
  const makeId = () => Math.random().toString(36).slice(2,9);

  // createBall
  let createdCount = 0;
  function createBall() {
    createdCount++;
    const id = makeId();
    const name = `Ball ${createdCount}`;
    const color = randColor();
    const newBall = {
      id, name, color, img: null,
      maxHP: 100, hpType: 'normal', regen: 0,
      damage: 10,
      x: 80 + (createdCount*40) % (spawnCanvas.clientWidth - 80),
      y: 60 + (createdCount*40) % (spawnCanvas.clientHeight - 80),
      r: 18
    };
    balls.push(newBall);
    renderBallCard(newBall);
    drawPreview();
  }

  // render ball card UI
  function renderBallCard(ball) {
    const card = document.createElement('div');
    card.className = 'ball-card';
    card.dataset.id = ball.id;
    card.innerHTML = `
      <div class="icon-picker" data-id="${ball.id}" title="Click to set color or upload image">
        <div class="icon-preview" style="background:${ball.color};"></div>
      </div>
      <div class="card-main">
        <div class="name-row">
          <input class="name-input" value="${ball.name}" data-id="${ball.id}" />
        </div>
        <div class="controls-row">
          <div class="field">
            <label>HP:</label>
            <input class="small-input" type="number" value="${ball.maxHP}" data-prop="maxHP" data-id="${ball.id}" />
            <select class="small-input" data-prop="hpType" data-id="${ball.id}">
              <option value="normal"${ball.hpType==='normal'?' selected':''}>Normal</option>
              <option value="segmented"${ball.hpType==='segmented'?' selected':''}>Segmented</option>
            </select>
            <span class="faq-dot" data-faq="hp">?</span>
          </div>

          <div class="field">
            <label>Regen/s:</label>
            <input class="small-input" type="number" value="${ball.regen}" data-prop="regen" data-id="${ball.id}" />
            <span class="faq-dot" data-faq="regen">?</span>
          </div>

          <div class="field">
            <label>Damage:</label>
            <input class="small-input" type="number" value="${ball.damage}" data-prop="damage" data-id="${ball.id}" />
            <span class="faq-dot" data-faq="damage">?</span>
          </div>
        </div>
      </div>
    `;
    // attach handlers
    const nameInput = card.querySelector('.name-input');
    nameInput.addEventListener('input', (e) => {
      const b = balls.find(x => x.id === ball.id); b.name = e.target.value; drawPreview();
    });

    // numeric/select inputs
    card.querySelectorAll('[data-prop]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const prop = e.target.getAttribute('data-prop');
        const id = e.target.getAttribute('data-id');
        const b = balls.find(x => x.id === id);
        if (!b) return;
        if (prop === 'hpType') b.hpType = e.target.value;
        else b[prop] = Number(e.target.value);
        drawPreview();
      });
    });

    // faq tooltips
    card.querySelectorAll('.faq-dot').forEach(el => {
      el.addEventListener('mouseenter', () => showFaq(el));
      el.addEventListener('mouseleave', hideFaq);
    });

    // icon picker click
    card.querySelector('.icon-picker').addEventListener('click', () => {
      selectedIconTarget = { id: ball.id };
      // show modal
      iconModal.classList.remove('hidden');
      iconModal.setAttribute('aria-hidden','false');
      modalColor.value = rgbToHex(ball.color) || '#ff7f50';
      modalFile.value = '';
    });

    // insert before the add button area
    ballList.appendChild(card);
  }

  // FAQ handling
  let faqEl;
  function showFaq(dot) {
    hideFaq();
    const faqKey = dot.getAttribute('data-faq');
    const text = {
      hp: 'Segmented HP means damage subtracts whole segments (no decimals). Normal is full numeric HP.',
      regen: 'HP Regen is how much HP per second the ball regains (0 = no regen).',
      damage: 'Damage is the amount this ball deals when hitting another ball (used in gameplay).'
    }[faqKey] || 'No info.';
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

  // modal handlers (apply color or uploaded image)
  modalApply.addEventListener('click', () => {
    if (!selectedIconTarget) return;
    const target = balls.find(b => b.id === selectedIconTarget.id);
    if (!target) return;
    const file = modalFile.files && modalFile.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        target.img = reader.result;
        target.color = null;
        updateIconPreview(target);
        drawPreview();
      };
      reader.readAsDataURL(file);
    } else {
      // use color
      target.img = null;
      target.color = modalColor.value;
      updateIconPreview(target);
      drawPreview();
    }
    closeModal();
  });
  modalCancel.addEventListener('click', closeModal);
  function closeModal() {
    iconModal.classList.add('hidden');
    iconModal.setAttribute('aria-hidden','true');
    selectedIconTarget = null;
    modalFile.value = '';
  }

  // update preview inside the icon-picker element
  function updateIconPreview(ball) {
    const el = document.querySelector(`.icon-picker[data-id="${ball.id}"] .icon-preview`);
    if (!el) return;
    if (ball.img) {
      el.style.backgroundImage = `url(${ball.img})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundColor = 'transparent';
    } else {
      el.style.backgroundImage = '';
      el.style.backgroundColor = ball.color;
    }
  }

  // draw preview canvas
  function drawPreview() {
    const cw = spawnCanvas.clientWidth;
    const ch = spawnCanvas.clientHeight;
    ctx.clearRect(0,0,spawnCanvas.width/devicePixelRatio, spawnCanvas.height/devicePixelRatio);
    // white arena background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,cw,ch);

    // draw grid lightly
    ctx.strokeStyle = 'rgba(15,30,45,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 40) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, ch); ctx.stroke();
    }
    for (let y = 0; y < ch; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(cw, y + 0.5); ctx.stroke();
    }

    // draw each ball
    balls.forEach(b => {
      ctx.beginPath();
      ctx.fillStyle = b.color || '#bbb';
      ctx.strokeStyle = '#e6eef6';
      ctx.lineWidth = 2;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
      if (b.img) {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r-1, 0, Math.PI*2);
          ctx.clip();
          ctx.drawImage(img, b.x - b.r, b.y - b.r, b.r*2, b.r*2);
          ctx.restore();
        };
        img.src = b.img;
      }
      // name label
      ctx.fillStyle = '#07202a';
      ctx.font = '12px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x, b.y + b.r + 14);
    });
  }

  // icon-preview helper to convert hsl/rgb -> hex for input
  function rgbToHex(cssColor) {
    // if hex
    if (!cssColor) return null;
    if (cssColor[0] === '#') return cssColor;
    try {
      const ctx2 = document.createElement('canvas').getContext('2d');
      ctx2.fillStyle = cssColor;
      const c = ctx2.fillStyle; // normalized
      // parse rgb(a)
      if (c.startsWith('#')) return c;
    } catch(e){}
    return '#ff7f50';
  }

  // add ball
  addBtn.addEventListener('click', createBall);

  // manage dragging balls in preview
  let dragging = null;
  let offset = {x:0,y:0};
  spawnCanvas.addEventListener('pointerdown', (e) => {
    const rect = spawnCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    for (let i = balls.length -1; i >= 0; i--) {
      const b = balls[i];
      const d = Math.hypot(b.x - x, b.y - y);
      if (d <= b.r + 6) {
        dragging = b;
        offset.x = x - b.x;
        offset.y = y - b.y;
        spawnCanvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  });
  spawnCanvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = spawnCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    dragging.x = Math.max(dragging.r, Math.min(spawnCanvas.clientWidth - dragging.r, x - offset.x));
    dragging.y = Math.max(dragging.r, Math.min(spawnCanvas.clientHeight - dragging.r, y - offset.y));
    drawPreview();
  });
  spawnCanvas.addEventListener('pointerup', (e) => {
    if (dragging) {
      spawnCanvas.releasePointerCapture(e.pointerId);
      dragging = null;
    }
  });

  // start button
  startBtn?.addEventListener('click', () => {
    alert('START GAME - placeholder (gameplay not implemented yet).');
  });

  // back button
  backBtn?.addEventListener('click', () => {
    document.body.style.opacity = 0;
    setTimeout(() => window.location.href = 'index.html', 260);
  });

  // initial state: add two default balls to show system
  createBall();
  createBall();

  // ensure preview drawn and sync icon previews
  setTimeout(() => {
    balls.forEach(updateIconPreview);
    drawPreview();
  }, 40);

  // update icon preview when modal color changes (instant preview in modal not applied until Apply)
  modalColor?.addEventListener('input', (e) => { /* no-op for now */ });
})();
