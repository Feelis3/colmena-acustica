const $ = (s) => document.querySelector(s);

const recBtn = $('#recBtn');
const hexWrap = $('#hexWrap');
const recTime = $('#recTime');
const recState = $('#recState');
const recAudio = $('#recAudio');
const sendRecBtn = $('#sendRecBtn');
const resetRecBtn = $('#resetRecBtn');
const viz = $('#viz');
const vizCtx = viz.getContext('2d');

const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const upProgress = $('#uploadProgress');
const bar = $('#bar');
const upMsg = $('#upMsg');

const lastResult = $('#lastResult');
const resClass = $('#resClass');
const resConf = $('#resConf');
const resWin = $('#resWin');
const resDur = $('#resDur');
const resProbs = $('#resProbs');

const fileList = $('#fileList');
const emptyState = $('#emptyState');
const refreshBtn = $('#refresh');
const statCount = $('#statCount');
const toast = $('#toast');

let mediaRecorder, chunks = [], stream, audioCtx, analyser, rafId, startedAt = 0, recordedBlob = null;

function showToast(msg, type='ok'){
  toast.textContent = msg;
  toast.classList.toggle('error', type==='error');
  toast.hidden = false;
  requestAnimationFrame(()=>toast.classList.add('show'));
  clearTimeout(showToast.t);
  showToast.t = setTimeout(()=>{
    toast.classList.remove('show');
    setTimeout(()=>toast.hidden=true, 300);
  }, 2800);
}

const fmtSize = b => b<1024 ? b+' B' : b<1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(2)+' MB';
const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const fmtPct  = p => (p*100).toFixed(1)+'%';

/* ---------- recording ---------- */
async function startRecording(){
  try{ stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(e){ showToast('No se pudo acceder al micrófono', 'error'); return; }

  chunks = []; recordedBlob = null;
  recAudio.hidden = true; recAudio.removeAttribute('src');

  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
  mediaRecorder = new MediaRecorder(stream, mime ? {mimeType:mime} : undefined);
  mediaRecorder.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(chunks, {type: mediaRecorder.mimeType || 'audio/webm'});
    recAudio.src = URL.createObjectURL(recordedBlob);
    recAudio.hidden = false;
    sendRecBtn.disabled = false; resetRecBtn.disabled = false;
    recState.textContent = `listo · ${fmtSize(recordedBlob.size)}`;
    stream.getTracks().forEach(t=>t.stop());
    cancelAnimationFrame(rafId); drawIdle();
  };

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  drawViz();

  startedAt = Date.now();
  mediaRecorder.start();
  hexWrap.classList.add('recording');
  recState.textContent = 'grabando…';
  tickTimer();
}

function tickTimer(){
  if(!hexWrap.classList.contains('recording')) return;
  recTime.textContent = fmtTime((Date.now()-startedAt)/1000);
  setTimeout(tickTimer, 250);
}

function stopRecording(){
  if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  hexWrap.classList.remove('recording');
}

function drawViz(){
  const data = new Uint8Array(analyser.frequencyBinCount);
  const w = viz.width = viz.clientWidth * devicePixelRatio;
  const h = viz.height = viz.clientHeight * devicePixelRatio;
  const draw = () => {
    rafId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(data);
    vizCtx.clearRect(0,0,w,h);
    const bars = 48, step = Math.floor(data.length / bars), bw = w / bars;
    for(let i=0;i<bars;i++){
      const v = data[i*step] / 255;
      const bh = Math.max(2*devicePixelRatio, v * h * .9);
      const x = i*bw + bw*.2, y = (h-bh)/2;
      const grad = vizCtx.createLinearGradient(0,y,0,y+bh);
      grad.addColorStop(0,'#ffd267'); grad.addColorStop(1,'#c4870f');
      vizCtx.fillStyle = grad;
      vizCtx.fillRect(x, y, bw*.6, bh);
    }
  };
  draw();
}

function drawIdle(){
  const w = viz.width = viz.clientWidth * devicePixelRatio;
  const h = viz.height = viz.clientHeight * devicePixelRatio;
  vizCtx.clearRect(0,0,w,h);
  vizCtx.fillStyle = 'rgba(245,176,35,.35)';
  const bars = 48, bw = w/bars;
  for(let i=0;i<bars;i++){
    const bh = (Math.sin(i*.5)+1)*4*devicePixelRatio + 4*devicePixelRatio;
    vizCtx.fillRect(i*bw + bw*.2, (h-bh)/2, bw*.6, bh);
  }
}
drawIdle();
window.addEventListener('resize', drawIdle);

recBtn.addEventListener('click', () => {
  if(hexWrap.classList.contains('recording')) stopRecording();
  else startRecording();
});

resetRecBtn.addEventListener('click', () => {
  recordedBlob = null;
  recAudio.hidden = true; recAudio.removeAttribute('src');
  sendRecBtn.disabled = true; resetRecBtn.disabled = true;
  recTime.textContent = '00:00';
  recState.textContent = 'listo para grabar';
});

sendRecBtn.addEventListener('click', async () => {
  if(!recordedBlob) return;
  const ext = recordedBlob.type.includes('webm') ? 'webm'
            : recordedBlob.type.includes('ogg') ? 'ogg'
            : recordedBlob.type.includes('wav') ? 'wav' : 'webm';
  const file = new File([recordedBlob], `grabacion.${ext}`, {type: recordedBlob.type});
  await uploadAndPredict(file);
  resetRecBtn.click();
});

/* ---------- upload ---------- */
fileInput.addEventListener('change', () => {
  if(fileInput.files[0]) uploadAndPredict(fileInput.files[0]);
});

['dragenter','dragover'].forEach(ev =>
  dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('drag'); }));
['dragleave','drop'].forEach(ev =>
  dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('drag'); }));
dropZone.addEventListener('drop', e => {
  const f = e.dataTransfer.files[0];
  if(f) uploadAndPredict(f);
});

async function uploadAndPredict(file){
  if(file.size > 50*1024*1024){ showToast('Archivo > 50 MB', 'error'); return; }

  upProgress.hidden = false;
  bar.style.width = '0%';
  upMsg.textContent = `Subiendo ${file.name} · ${fmtSize(file.size)}`;
  lastResult.hidden = true;

  const fd = new FormData();
  fd.append('file', file);

  await new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST','/api/predict');
    xhr.upload.onprogress = e => {
      if(e.lengthComputable){
        const pct = e.loaded/e.total*90;
        bar.style.width = pct+'%';
        if(pct >= 89) upMsg.textContent = 'Procesando audio en el modelo…';
      }
    };
    xhr.onload = () => {
      if(xhr.status >= 200 && xhr.status < 300){
        bar.style.width = '100%';
        upMsg.textContent = '✓ análisis completado';
        try{
          const r = JSON.parse(xhr.responseText);
          renderResult(r);
        }catch(e){}
        loadFiles();
        showToast('Predicción lista');
        setTimeout(()=>{ upProgress.hidden = true; }, 1200);
      } else {
        let msg = 'Error al procesar';
        try{ msg = JSON.parse(xhr.responseText).detail || msg; }catch(e){}
        upMsg.textContent = '✕ ' + msg;
        showToast(msg, 'error');
      }
      resolve();
    };
    xhr.onerror = () => { upMsg.textContent = '✕ error de red'; showToast('Error de red', 'error'); resolve(); };
    xhr.send(fd);
  });
  fileInput.value = '';
}

function renderResult(r){
  const ok = r.es_colmena !== false;
  resClass.textContent = r.clase;
  resConf.textContent = fmtPct(r.confianza);
  resWin.textContent = r.ventanas_analizadas;
  resDur.textContent = r.duracion_seg;

  const entries = Object.entries(r.probabilidades).sort((a,b)=>b[1]-a[1]);
  const top = entries[0][0];
  const note = r.motivo ? `<p style="margin:0 0 10px;font-size:13px;color:#a89c84">${escapeHtml(r.motivo)}</p>` : '';
  resProbs.innerHTML = note + entries.map(([name, p]) => `
    <div class="prob-row ${ok && name===top?'top':''}">
      <span class="label">${escapeHtml(name)}</span>
      <span class="prob-pct">${fmtPct(p)}</span>
      <div class="prob-bar"><span style="width:${(p*100).toFixed(1)}%"></span></div>
    </div>
  `).join('');
  lastResult.hidden = false;
}

/* ---------- library (deshabilitada: el histórico vive en localStorage en /v2) ---------- */
async function loadFiles(){ renderFiles([]); }

function renderFiles(files){
  fileList.innerHTML = '';
  emptyState.hidden = files.length > 0;
  files.forEach(f => {
    const el = document.createElement('div');
    el.className = 'file';
    const date = new Date(f.uploaded);
    const dateStr = date.toLocaleString('es-ES', {dateStyle:'short', timeStyle:'short'});
    const pred = f.clase
      ? `<span class="file-pred">${escapeHtml(f.clase)}</span><span class="file-pred-conf">${fmtPct(f.confianza)}</span>`
      : `<span class="file-pred-conf">sin predicción</span>`;
    el.innerHTML = `
      <div class="file-top">
        <div class="file-name">${escapeHtml(f.name)}</div>
        <div class="file-size">${fmtSize(f.size)}</div>
      </div>
      <div>${pred}</div>
      <div class="file-date">${dateStr}</div>
      <audio controls preload="none" src="${f.url}"></audio>
    `;
    fileList.appendChild(el);
  });
  statCount.textContent = files.length;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

refreshBtn.addEventListener('click', loadFiles);
loadFiles();
