const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ============================================================
   LIVE HONEYCOMB BACKDROP — hexagons that pulse like cells
   ============================================================ */
const comb = $('#comb');
const ctx = comb.getContext('2d');

const HEX = 34;          // hex radius
let cells = [];
let dpr = Math.min(window.devicePixelRatio || 1, 2);

function buildComb(){
  comb.width = innerWidth * dpr;
  comb.height = innerHeight * dpr;
  comb.style.width = innerWidth+'px';
  comb.style.height = innerHeight+'px';
  cells = [];
  const w = HEX * 1.5;
  const h = HEX * Math.sqrt(3);
  const cols = Math.ceil(innerWidth / w) + 2;
  const rows = Math.ceil(innerHeight / h) + 2;
  for(let r=-1;r<rows;r++){
    for(let c=-1;c<cols;c++){
      const x = c*w;
      const y = r*h + (c%2 ? h/2 : 0);
      cells.push({
        x, y,
        phase: Math.random()*Math.PI*2,
        speed: .3 + Math.random()*.6,
        amp: .25 + Math.random()*.3,
      });
    }
  }
}

function hexPath(cx, cy, r){
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a = i * Math.PI/3;
    const x = cx + r*Math.cos(a);
    const y = cy + r*Math.sin(a);
    i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
  }
  ctx.closePath();
}

let mouse = {x:-9999, y:-9999};
addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

let t0 = performance.now();
function animateComb(){
  const t = (performance.now() - t0) / 1000;
  ctx.clearRect(0,0,comb.width,comb.height);
  ctx.lineWidth = 1 * dpr;

  cells.forEach(cell => {
    const pulse = .5 + .5 * Math.sin(t * cell.speed + cell.phase);
    // distance to mouse
    const dx = cell.x - mouse.x;
    const dy = cell.y - mouse.y;
    const d  = Math.sqrt(dx*dx + dy*dy);
    const near = Math.max(0, 1 - d/240);

    const alpha = (.05 + cell.amp * pulse * .15) + near * .5;
    ctx.strokeStyle = `rgba(245,176,35,${alpha.toFixed(3)})`;
    hexPath(cell.x*dpr, cell.y*dpr, HEX*dpr);
    ctx.stroke();

    if(near > .3){
      ctx.fillStyle = `rgba(245,176,35,${(near*.08).toFixed(3)})`;
      ctx.fill();
    }
  });
  requestAnimationFrame(animateComb);
}
buildComb();
animateComb();
addEventListener('resize', buildComb);


/* ============================================================
   ELEMENTS
   ============================================================ */
const recBtn = $('#recBtn');
const recTime = $('#recTime');
const recState = $('#recState');
const recAudio = $('#recAudio');
const recActions = $('#recActions');
const sendRecBtn = $('#sendRecBtn');
const resetRecBtn = $('#resetRecBtn');
const hexLabel = $('#hexLabel');
const honeyLevel = $('#honeyLevel');
const honeyWave = $('#honeyWave');

const fileInput = $('#fileInput');
const dropOverlay = $('#dropOverlay');

const verdict = $('#verdict');
const confPct = $('#confPct');
const confFill = $('#confFill');
const verdictName = $('#verdictName');
const probsEl = $('#probs');
const newBtn = $('#newBtn');

const loading = $('#loading');
const loadMsg = $('#loadMsg');
const loadElapsed = $('#loadElapsed');
const cancelBtn = $('#cancelBtn');
const histStrip = $('#histStrip');
const toast = $('#toast');

let mediaRecorder, chunks = [], stream, startedAt = 0, recordedBlob = null;
let mode = 'record';
let waveAnim = null;

/* ============================================================
   HELPERS
   ============================================================ */
const fmtPct  = p => Math.round(p*100);
const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function showToast(msg, type='ok'){
  toast.textContent = msg;
  toast.classList.toggle('error', type==='error');
  toast.hidden = false;
  requestAnimationFrame(()=>toast.classList.add('show'));
  clearTimeout(showToast.t);
  showToast.t = setTimeout(()=>{
    toast.classList.remove('show');
    setTimeout(()=>toast.hidden=true, 300);
  }, 2500);
}

/* ============================================================
   TABS
   ============================================================ */
const hexIcon = $('#hexIcon');
const ICON_MIC    = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/>';
const ICON_UPLOAD = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>';

$$('.mode').forEach(t => t.addEventListener('click', () => {
  $$('.mode').forEach(x => x.classList.toggle('on', x===t));
  mode = t.dataset.tab;
  if(mode === 'upload'){
    dropOverlay.classList.add('show');
    recBtn.classList.add('upload-mode');
    recState.textContent = 'esperando archivo';
  } else {
    dropOverlay.classList.remove('show');
    recBtn.classList.remove('upload-mode');
    hexIcon.innerHTML = ICON_MIC;
    hexLabel.textContent = 'pulsar para grabar';
    recState.textContent = 'listo · pulsa el panal';
  }
}));

/* ============================================================
   HONEY FILL / WAVE animation while recording
   ============================================================ */
function animateHoney(elapsed){
  // fill from 0 to ~85% over 30s to give a sense of progress
  const filled = Math.min(0.85, elapsed / 30);
  const y = 173.2 * (1 - filled);
  honeyLevel.setAttribute('y', y.toString());

  // wavy top
  const t = performance.now() / 240;
  const amp = 4;
  const pts = [];
  for(let x=0;x<=200;x+=10){
    const yy = y + Math.sin((x/30) + t) * amp + Math.sin((x/12) + t*1.7) * (amp*.4);
    pts.push(`${x},${yy}`);
  }
  honeyWave.setAttribute('d', `M0,${y} L${pts.join(' L')} L200,173.2 L0,173.2 Z`);
}

function startHoneyAnim(){
  const begun = performance.now();
  const tick = () => {
    if(!recBtn.classList.contains('recording')) return;
    animateHoney((performance.now() - begun)/1000);
    waveAnim = requestAnimationFrame(tick);
  };
  tick();
}

function resetHoney(){
  cancelAnimationFrame(waveAnim);
  honeyLevel.setAttribute('y', '173.2');
  honeyWave.setAttribute('d', '');
}

/* ============================================================
   RECORDING
   ============================================================ */
async function startRecording(){
  try{ stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(e){ showToast('sin acceso al micrófono','error'); return; }

  chunks = []; recordedBlob = null;
  recAudio.hidden = true; recAudio.removeAttribute('src');
  recActions.hidden = true;

  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
  mediaRecorder = new MediaRecorder(stream, mime ? {mimeType:mime} : undefined);
  mediaRecorder.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(chunks, {type: mediaRecorder.mimeType || 'audio/webm'});
    recAudio.src = URL.createObjectURL(recordedBlob);
    recAudio.hidden = false;
    recActions.hidden = false;
    recState.textContent = 'capturado · revisa o analiza';
    stream.getTracks().forEach(t=>t.stop());
  };

  startedAt = Date.now();
  mediaRecorder.start();
  recBtn.classList.add('recording');
  hexLabel.textContent = 'pulsar para parar';
  recState.textContent = 'capturando zumbido';
  startHoneyAnim();
  tickTimer();
}

function tickTimer(){
  if(!recBtn.classList.contains('recording')) return;
  recTime.textContent = fmtTime((Date.now()-startedAt)/1000);
  setTimeout(tickTimer, 250);
}

function stopRecording(){
  if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  recBtn.classList.remove('recording');
  hexLabel.textContent = 'pulsar para grabar';
  resetHoney();
}

recBtn.addEventListener('click', (e) => {
  if(mode === 'upload'){ fileInput.click(); return; }
  if(recBtn.classList.contains('recording')) stopRecording();
  else startRecording();
});

resetRecBtn.addEventListener('click', resetRecording);
function resetRecording(){
  recordedBlob = null;
  pendingFile = null;
  fileInput.value = '';
  recAudio.hidden = true; recAudio.removeAttribute('src');
  recActions.hidden = true;
  recTime.textContent = '00:00';
  recState.textContent = mode === 'upload' ? 'esperando archivo' : 'listo · pulsa el panal';
}

sendRecBtn.addEventListener('click', async () => {
  let file;
  if(pendingFile){
    file = pendingFile;
  } else if(recordedBlob){
    const ext = recordedBlob.type.includes('webm') ? 'webm'
              : recordedBlob.type.includes('ogg') ? 'ogg' : 'webm';
    file = new File([recordedBlob], `grabacion.${ext}`, {type: recordedBlob.type});
  } else { return; }
  await analyze(file);
  resetRecording();
});

/* ============================================================
   UPLOAD — mismo flujo que grabar: previsualizar y luego analizar
   ============================================================ */
let pendingFile = null;

function loadFileForPreview(file){
  if(!file) return;
  pendingFile = file;
  recordedBlob = null;             // bloquea el flujo de grabación
  recAudio.src = URL.createObjectURL(file);
  recAudio.hidden = false;
  recActions.hidden = false;
  recState.textContent = `${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`;
}

fileInput.addEventListener('change', () => {
  if(fileInput.files[0]) loadFileForPreview(fileInput.files[0]);
});
['dragenter','dragover'].forEach(ev =>
  dropOverlay.addEventListener(ev, e => { e.preventDefault(); dropOverlay.classList.add('drag'); }));
['dragleave','drop'].forEach(ev =>
  dropOverlay.addEventListener(ev, e => { e.preventDefault(); dropOverlay.classList.remove('drag'); }));
dropOverlay.addEventListener('drop', e => {
  const f = e.dataTransfer.files[0];
  if(f) loadFileForPreview(f);
});

/* ============================================================
   ANALYZE
   ============================================================ */
let currentXhr = null;
let elapsedTimer = null;

function startElapsed(){
  const t0 = performance.now();
  loadElapsed.textContent = '0.0 s';
  clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    loadElapsed.textContent = ((performance.now()-t0)/1000).toFixed(1) + ' s';
  }, 100);
}
function stopElapsed(){ clearInterval(elapsedTimer); elapsedTimer = null; }

cancelBtn.addEventListener('click', () => {
  if(currentXhr){ currentXhr.abort(); }
  loading.classList.remove("show");
  stopElapsed();
  showToast('análisis cancelado','error');
});

async function analyze(file){
  if(file.size > 50*1024*1024){ showToast('máx 50 mb','error'); return; }
  console.log('[analyze] file:', file.name, file.size, 'bytes', file.type);

  verdict.hidden = true;
  loading.classList.add("show");
  loadMsg.textContent = 'subiendo audio';
  startElapsed();

  const fd = new FormData();
  fd.append('file', file);

  try{
    const r = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      currentXhr = xhr;
      xhr.open('POST','/api/predict');
      xhr.timeout = 90000; // 90 s
      xhr.upload.onprogress = e => {
        if(e.lengthComputable){
          const pct = Math.round(e.loaded/e.total*100);
          loadMsg.textContent = e.loaded < e.total ? `subiendo · ${pct}%` : 'modelo procesando';
        }
      };
      xhr.upload.onload = () => loadMsg.textContent = 'modelo procesando';
      xhr.onload = () => {
        console.log('[analyze] response:', xhr.status, xhr.responseText.slice(0,200));
        if(xhr.status >= 200 && xhr.status < 300){
          try{ resolve(JSON.parse(xhr.responseText)); }
          catch(e){ reject('respuesta inválida del servidor'); }
        } else {
          reject(xhr.responseText || `http ${xhr.status}`);
        }
      };
      xhr.onerror   = () => { console.error('[analyze] xhr error'); reject('error de red'); };
      xhr.ontimeout = () => { console.error('[analyze] timeout'); reject('tiempo agotado (>90 s)'); };
      xhr.onabort   = () => reject('__cancelled__');
      xhr.send(fd);
    });
    showVerdict(r);
    pushHist(r, file);
    showToast('análisis completado');
  }catch(err){
    if(err === '__cancelled__') return;
    console.error('[analyze] failed:', err);
    let msg = 'error al analizar';
    try{ msg = JSON.parse(err).detail || msg; }catch(e){ if(typeof err === 'string') msg = err; }
    showToast(msg, 'error');
  }finally{
    currentXhr = null;
    loading.classList.remove("show");
    stopElapsed();
    fileInput.value = '';
  }
}

function showVerdict(r){
  const ok = r.es_colmena !== false;
  verdict.classList.toggle('not-hive', !ok);
  verdictName.textContent = r.clase;

  // confidence ring: usa la confianza solo si es colmena; si no, lo dejamos a 0
  const target = ok ? r.confianza : 0;
  const pct = Math.round(target*100);
  const startFill = () => {
    const start = performance.now(); const dur = 900;
    const step = () => {
      const k = Math.min(1, (performance.now()-start)/dur);
      const eased = 1 - Math.pow(1-k, 3);
      confPct.textContent = Math.round(eased * pct);
      confFill.setAttribute('y', (173.2 * (1 - eased*target)).toString());
      if(k < 1) requestAnimationFrame(step);
    };
    step();
  };

  const entries = Object.entries(r.probabilidades).sort((a,b)=>b[1]-a[1]);
  const top = entries[0][0];
  const motivo = r.motivo ? `<p class="verdict-note">${escapeHtml(r.motivo)}</p>` : '';
  const probsHdr = ok
    ? '<p class="probs-hdr">distribución de probabilidades</p>'
    : '<p class="probs-hdr">salida bruta del modelo (descartada — fuera de dominio)</p>';
  probsEl.innerHTML = motivo + probsHdr + entries.map(([name,p],i) => `
    <div class="p ${ok && name===top ? 'top':''}">
      <span class="idx">${String(i+1).padStart(2,'0')}</span>
      <span class="name">${escapeHtml(name)}</span>
      <span class="val">${(p*100).toFixed(1)}%</span>
    </div>
  `).join('');

  verdict.hidden = false;
  setTimeout(startFill, 100);
  verdict.scrollIntoView({behavior:'smooth', block:'nearest'});
}

newBtn.addEventListener('click', () => {
  verdict.hidden = true;
  confFill.setAttribute('y', '173.2');
  confPct.textContent = '0';
});

/* ============================================================
   HISTORY (localStorage — por dispositivo)
   ============================================================ */
const HIST_KEY = 'colmena.history.v1';
const HIST_MAX = 30;

function readHist(){
  try{ return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
  catch(e){ return []; }
}
function writeHist(arr){
  try{ localStorage.setItem(HIST_KEY, JSON.stringify(arr.slice(0, HIST_MAX))); }
  catch(e){ console.warn('localStorage llena', e); }
}
// audio URLs cached only for current session (we don't persist blobs)
const audioCache = new Map();

function pushHist(entry, sourceFile){
  const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2,7);
  if(sourceFile){ audioCache.set(id, URL.createObjectURL(sourceFile)); }
  const arr = readHist();
  arr.unshift({
    id,
    ts: Date.now(),
    name: entry.filename,
    size: entry.size,
    clase: entry.clase,
    confianza: entry.confianza,
    duracion: entry.duracion_seg,
  });
  writeHist(arr);
  loadHistory();
}

$('#clearHist').addEventListener('click', () => {
  if(!readHist().length) return;
  localStorage.removeItem(HIST_KEY);
  loadHistory();
  showToast('historial borrado');
});

function loadHistory(){
  const arr = readHist();
  if(!arr.length){
    histStrip.innerHTML = '<div class="cell empty">aún sin celdas</div>';
    return;
  }
  histStrip.innerHTML = arr.slice(0, 12).map(f => {
    const date = new Date(f.ts);
    const time = date.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
    const url = audioCache.get(f.id);
    return `
      <div class="cell ${url ? 'playable' : ''}" data-id="${f.id}">
        <span class="c-name">${escapeHtml(f.clase || '—')}</span>
        <span class="c-conf">${f.confianza != null ? (f.confianza*100).toFixed(0)+'%' : ''}</span>
        <span class="c-time">${time}</span>
        ${url ? `<button class="c-play" aria-label="reproducir">▶</button><audio src="${url}"></audio>` : ''}
      </div>
    `;
  }).join('');

  $$('.cell.playable').forEach(c => {
    const audio = c.querySelector('audio');
    const btn = c.querySelector('.c-play');
    if(!audio || !btn) return;
    audio.addEventListener('play',  () => btn.textContent = '❚❚');
    audio.addEventListener('pause', () => btn.textContent = '▶');
    audio.addEventListener('ended', () => btn.textContent = '▶');
    c.addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
  });
}
loadHistory();
