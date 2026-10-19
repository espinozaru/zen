/*
 * Тишина внутри — prototipo web.
 * · Fondo: un lienzo WebGL fijo con el paisaje vivo de los videos (parallax 2.5D por mapa de profundidad + agua).
 *   Cada sección funde su portada con la anterior; scroll y ratón mueven la cámara muy despacio (tipo taichi).
 * · Textos: entran cuando llegan al centro (desenfoque → nítido, subiendo; las frases en cursiva, palabra a palabra)
 *   y se disuelven al seguir bajando o al volver. Sin máscaras (se veían mal sobre fondos claros).
 * · Menú vertical: rayas + números; lupa tipo Dock de Mac al pasar el ratón y el nombre al lado, con fondo de cristal.
 * · Player flotante: 3 pistas gratis. Audio solo se descarga al dar play (preload none, streaming por rangos).
 */

// En producción: URL del almacenamiento/CDN de audio (p. ej. Yandex Object Storage), para no cargar el servidor.
const AUDIO_BASE = window.AUDIO_BASE || 'assets/audio/';
const T0 = performance.now();

const TRACKS = [
  {n: '01', t: 'Глубокое расслабление тела', p: 'Отпусти напряжение — шаг за шагом', bg: 'song1', h: 0.67, d: 359.6, free: true},
  {n: '02', t: 'Успокоить дыхание и мысли', p: 'Древняя практика «Со Хам» для тихого ума', bg: 'song2', h: 0.685, d: 344.4, free: true},
  {n: '03', t: 'Снять тревогу и сильные эмоции', p: 'Вернуться в тело, когда эмоции слишком сильные', bg: 'song4', h: 0.995, d: 344.4, free: true},
  {n: '04', t: 'Утреннее пробуждение и ясность', p: 'Ясная голова и спокойный старт дня', bg: 'song5', h: 0.995, d: 339.6},
  {n: '05', t: 'Глубокий фокус перед работой', p: 'Одна задача. Полное внимание', bg: 'song5new', h: 0.54, d: 339.6, light: true},
  {n: '06', t: 'Спокойная уверенность перед важным событием', p: 'Перед встречей, выступлением, важным разговором', bg: 'song6forest', h: 0.995, d: 338.8, light: true},
  {n: '07', t: 'Восстановить энергию после тяжёлого дня', p: 'Стряхнуть тяжёлый день и вернуть силы', bg: 'song7new', h: 0.995, d: 339.6, light: true},
  {n: '08', t: 'Не бороться с собой', p: 'Говорить с собой как с близким человеком', bg: 'song9', h: 0.68, d: 339.9},
  {n: '09', t: 'Глубокое расслабление перед сном', p: 'Йога-нидра для мягкого засыпания', bg: 'song9new', h: 0.68, d: 339.6, light: true},
  {n: '10', t: 'Перестать думать перед сном', p: 'Когда мысли не дают уснуть', bg: 'song11', h: 0.995, d: 339.4},
  {n: '11', t: 'Кто наблюдает?', p: 'Глубокая медитация «нети, нети»', bg: 'song12', h: 0.72, d: 313.4},
];
const FREE = TRACKS.filter((t) => t.free);

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const $ = (id) => document.getElementById(id);

/* ======================= 1. Secciones de pistas ======================= */
const eqHTML = (n = 5) => `<span class="eq">${'<i></i>'.repeat(n)}</span>`;
const icoPlay = '<svg class="ico" viewBox="0 0 10 10"><path d="M2 1v8l7-4z"/></svg>';

TRACKS.forEach((tr) => {
  const s = document.createElement('section');
  s.className = 'track' + (tr.light ? ' light' : '');
  s.id = 't' + tr.n;
  s.dataset.bg = tr.bg;
  s.dataset.horizon = tr.h;
  s.innerHTML = `
    <div class="num fx">${tr.n} / 11</div>
    <h2 class="fx" data-fx="title" data-delay="0.1"><span class="silver">${tr.t}</span></h2>
    <p class="phrase fx" data-split="words" data-delay="0.45">${tr.p}</p>
    <div class="meta fx" data-delay="0.8">${fmt(tr.d)} · голос и музыка</div>
    ${tr.free
      ? `<button class="play fx" data-delay="1.0" data-n="${tr.n}">${icoPlay}${eqHTML()}<span class="lbl">слушать</span></button>`
      : `<span class="play locked fx" data-delay="1.0" aria-disabled="true">скоро — в полном альбоме</span>`}`; // aún no publicado: sin clic
  $('tracks').appendChild(s);
});

/* ======================= 2. Menú vertical: rayas + números, lupa tipo Dock ======================= */
const side = $('side'), tip = $('sideTip');
side.innerHTML = TRACKS.map((tr) =>
  `<a href="#t${tr.n}" data-sec="t${tr.n}" aria-label="${tr.n}. ${tr.t}"><span class="sn">${tr.n}</span>${eqHTML(3)}</a>`).join('');
const dock = {y: null, items: [...side.querySelectorAll('a')].map((a, i) => ({a, s: 1, tr: TRACKS[i]})), shown: null};
side.addEventListener('pointermove', (e) => { dock.y = e.clientY; });
side.addEventListener('pointerleave', () => { dock.y = null; });
side.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-sec]');
  if (!a) return;
  e.preventDefault();
  $(a.dataset.sec).scrollIntoView({behavior: 'smooth', block: 'start'});
});
function dockFrame() {
  let closest = null, best = 1e9;
  for (const it of dock.items) {
    const r = it.a.getBoundingClientRect();
    it.cy = r.top + r.height / 2;
    it.right = r.right;
    const d = dock.y === null ? 1e9 : Math.abs(dock.y - it.cy);
    const target = dock.y === null ? 1 : 1 + 0.55 * Math.exp(-(d * d) / (2 * 30 * 30)); // lupa gaussiana: crece el del cursor y un poco sus vecinos
    it.s += (target - it.s) * 0.16; // easing
    it.a.style.setProperty('--s', it.s.toFixed(3));
    if (d < best) { best = d; closest = it; }
  }
  if (dock.y !== null && closest) {
    if (dock.shown !== closest) {
      dock.shown = closest;
      tip.innerHTML = `${closest.tr.t}${closest.tr.free ? '<em>доступно</em>' : ''}`;
    }
    tip.style.left = closest.right + 14 + 'px'; // justo al lado del número
    tip.style.top = closest.cy + 'px';
    tip.classList.add('show');
  } else {
    tip.classList.remove('show');
    dock.shown = null;
  }
}

/* ---------- móvil: lista de meditaciones a pantalla completa ---------- */
const mMenu = $('mMenu');
mMenu.innerHTML = TRACKS.map((tr, i) => `<a href="#t${tr.n}" data-sec="t${tr.n}" style="transition-delay:${(0.04 * i).toFixed(2)}s">
  <span class="mn">${tr.n}</span><span class="mt">${tr.t}</span>${tr.free ? '<span class="mf">доступно</span>' : ''}</a>`).join('');
const setMenu = (open) => { document.body.classList.toggle('m-open', open); $('mBtn').setAttribute('aria-expanded', open); };
$('mBtn').addEventListener('click', () => setMenu(!document.body.classList.contains('m-open')));
mMenu.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-sec]');
  if (!a) return;
  e.preventDefault();
  setMenu(false);
  $(a.dataset.sec).scrollIntoView({behavior: 'smooth', block: 'start'});
});

/* ======================= 3. Fondo WebGL: dos portadas que se funden ======================= */
const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision highp float;
varying vec2 uv;
uniform sampler2D imgA, depA, imgB, depB;
uniform vec4 rect; uniform vec2 cam; uniform float time, mixB, horA, horB, zoomK;
vec3 scene(sampler2D img, sampler2D dep, float horizon){
  vec2 base = rect.xy + (uv - 0.5) * rect.zw / zoomK + rect.zw * 0.5;
  vec2 q = base;
  for (int k = 0; k < 5; k++) { float d = texture2D(dep, q).r - 0.2; q = base - cam * d * rect.zw; }
  float d0 = texture2D(dep, q).r;
  float water = smoothstep(horizon, horizon + 0.03, q.y) * (1.0 - smoothstep(0.45, 0.62, d0));
  float k = (q.y - horizon) / max(0.01, 1.0 - horizon);
  float w = sin(q.y * (260.0 - 140.0 * k) - time * 0.9 + sin(q.x * 9.0 + time * 0.25) * 1.6) + 0.5 * sin(q.y * 520.0 + time * 1.3);
  q.x += w * 0.0016 * water * (0.4 + k); q.y += w * 0.0006 * water;
  q = clamp(q, 0.001, 0.999);
  return texture2D(img, q).rgb + water * 0.012 * w;
}
void main(){
  vec3 a = scene(imgA, depA, horA);
  vec3 b = scene(imgB, depB, horB);
  gl_FragColor = vec4(mix(a, b, smoothstep(0.0, 1.0, mixB)), 1.0);
}`;

const canvas = $('scene');
const gl = canvas.getContext('webgl');
const prog = gl.createProgram();
[[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]].forEach(([type, src]) => {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
  gl.attachShader(prog, sh);
});
gl.linkProgram(prog);
gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const aLoc = gl.getAttribLocation(prog, 'p');
gl.enableVertexAttribArray(aLoc);
gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
const U = (n) => gl.getUniformLocation(prog, n);

const cache = {};
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const texFrom = (img) => {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  return t;
};
const getScene = (id) => (cache[id] ??= Promise.all([loadImg(`assets/${id}.webp`), loadImg(`assets/depth/${id}.webp`)])
  .then(([img, dep]) => ({img: texFrom(img), dep: texFrom(dep), aspect: img.width / img.height})));

let A = null, B = null, horA = 0.67, horB = 0.67, mixB = 0, mixTarget = 0, currentBg = 'song1';
const bindTex = (unit, tex, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U(name), unit); };

async function showBg(id, horizon) {
  if (id === currentBg) return;
  currentBg = id;
  const s = await getScene(id);
  if (currentBg !== id) return;
  if (B && mixB > 0.5) { A = B; horA = horB; } // lo que se ve pasa a ser A; la nueva portada entra como B
  B = s; horB = horizon; mixB = 0; mixTarget = 1;
}

let mouseX = 0, camX = 0;
addEventListener('pointermove', (e) => { mouseX = e.clientX / innerWidth - 0.5; });
function resize() { const dpr = Math.min(devicePixelRatio, 2); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; }
addEventListener('resize', resize);
resize();

function drawScene(time) {
  if (!A) return;
  const scroll = scrollY / Math.max(1, document.body.scrollHeight - innerHeight);
  const target = (scroll - 0.5) * 0.05 + mouseX * 0.02 + Math.sin(time * 0.05) * 0.006;
  camX += (target - camX) * 0.03;
  mixB += (mixTarget - mixB) * 0.025;
  const ca = canvas.width / canvas.height, zoom = 1.08;
  const sw = ca > A.aspect ? 1 : ca / A.aspect, sh = ca > A.aspect ? A.aspect / ca : 1;
  const w = sw / zoom, h = sh / zoom;
  const heroOut = clamp(scrollY / innerHeight, 0, 1); // al salir de la portada la cámara «entra» un poco en el paisaje
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform4f(U('rect'), (1 - w) / 2, (1 - h) / 2, w, h);
  gl.uniform1f(U('zoomK'), 1 + easeIO(heroOut) * 0.06);
  gl.uniform2f(U('cam'), camX, 0);
  gl.uniform1f(U('time'), time);
  gl.uniform1f(U('horA'), horA);
  gl.uniform1f(U('horB'), horB);
  gl.uniform1f(U('mixB'), B ? mixB : 0);
  bindTex(0, A.img, 'imgA'); bindTex(1, A.dep, 'depA');
  bindTex(2, (B || A).img, 'imgB'); bindTex(3, (B || A).dep, 'depB');
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
TRACKS.forEach((t) => getScene(t.bg)); // precarga de portadas (~85 KB cada una)

/* ======================= 4. Efectos de texto: ligados a la POSICIÓN, no al tiempo ======================= */
// Cada texto es visible cuando está cerca del centro de la pantalla y se desvanece al alejarse (por arriba o por abajo).
// No hay animaciones con retraso: con scroll rápido o lento, lo que está en el centro siempre se ve. Un suavizado corto
// (≈0,2 s) da la sensación de calma. Las frases en cursiva entran palabra a palabra según suben.
// La posición se mide en el documento (offsetTop), no en pantalla: las transformaciones no engañan a la medición.
const blocks = [...document.querySelectorAll('.fx')].map((el) => {
  if (el.dataset.split === 'words') {
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="wd">${w}</span>`).join(' ');
  }
  const parts = el.dataset.split === 'words' ? [...el.querySelectorAll('.wd')] : [el];
  return {el, parts, kind: el.dataset.fx || 'rise', intro: parseFloat(el.dataset.delay || 0), cur: parts.map(() => 0), cy: 0};
});
const docTop = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
function measure() { for (const b of blocks) b.cy = docTop(b.el) + b.el.offsetHeight / 2; }
addEventListener('resize', measure);
measure();

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const vis = (p) => smooth(0.56, 0.3, Math.abs(p)); // 1 en la franja central, 0 lejos
let lastNow = performance.now();

function fxFrame(now) {
  const vh = innerHeight;
  const dt = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  const k = 1 - Math.exp(-dt / 0.2); // suavizado corto
  const since = (now - T0) / 1000;
  for (const b of blocks) {
    const pos = (b.cy - scrollY - vh / 2) / vh; // 0 = centro de pantalla
    const far = Math.abs(pos) > 1.4;
    if (far && b.cur.every((c) => c < 0.001)) continue;
    const drift = -pos * 24; // todo flota un poco más lento que el scroll
    if (b.kind === 'hero-l' || b.kind === 'hero-r') {
      // portada: al cargar entra desde su lado (como en los videos); al bajar sube, crece y se disuelve
      const intro = easeIO(clamp((since - b.intro) / 1.8, 0, 1));
      const target = smooth(-0.5, -0.14, pos); // 1 mientras la portada está en pantalla
      b.cur[0] += (target - b.cur[0]) * k;
      const out = 1 - b.cur[0];
      const sideDir = b.kind === 'hero-l' ? -1 : 1;
      const el = b.el;
      el.style.opacity = (intro * b.cur[0]).toFixed(3);
      el.style.transform = `translate3d(${((1 - intro) * 130 * sideDir).toFixed(1)}px, ${(-out * 80 + drift).toFixed(1)}px, 0) scale(${(1 + out * 0.1).toFixed(3)})`;
      el.style.letterSpacing = `${(0.06 + (1 - intro) * 0.2).toFixed(3)}em`;
      const blur = Math.max(1 - intro, out) * 12;
      el.style.filter = blur < 0.05 ? 'none' : `blur(${blur.toFixed(1)}px)`;
      continue;
    }
    const gate = since > b.intro || pos > 0.6 ? 1 : 0; // solo al cargar la página: pequeña espera en la portada
    const n = b.parts.length;
    b.parts.forEach((el, i) => {
      const p = pos + (n > 1 ? (i - (n - 1) / 2) * 0.012 : 0); // palabras: escalonadas un poco según suben
      const target = vis(p) * gate;
      b.cur[i] += (target - b.cur[i]) * k;
      const v = b.cur[i], hidden = 1 - v;
      const dir = p >= 0 ? 1 : -1; // entra por abajo, sale por arriba (y al revés al volver)
      const lift = b.kind === 'title' ? 46 : 30;
      el.style.opacity = v.toFixed(3);
      el.style.transform = `translate3d(0, ${(hidden * lift * dir + (n > 1 ? 0 : drift)).toFixed(1)}px, 0)`;
      el.style.filter = v > 0.99 ? 'none' : `blur(${(hidden * 9).toFixed(1)}px)`;
    });
    if (n > 1) b.el.style.transform = `translate3d(0, ${drift.toFixed(1)}px, 0)`;
  }
}

/* ======================= 5. Sección activa: fondo + menú ======================= */
const sections = [...document.querySelectorAll('section[data-bg]')];
let activeSec = null;
function updateActive() {
  const mid = innerHeight / 2;
  let best = sections[0];
  for (const s of sections) { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid) { best = s; break; } }
  if (best === activeSec) return;
  activeSec = best;
  showBg(best.dataset.bg, parseFloat(best.dataset.horizon));
  dock.items.forEach((it) => it.a.classList.toggle('active', it.a.dataset.sec === best.id));
  mMenu.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.sec === best.id));
}

/* ======================= 6. Bucle principal ======================= */
function loop(now) {
  requestAnimationFrame(loop);
  drawScene((now - T0) / 1000);
  fxFrame(now);
  dockFrame();
  updateActive();
}
Promise.all([getScene('song1'), document.fonts.ready]).then(([s]) => { A = s; measure(); requestAnimationFrame(loop); });

/* ======================= 7. Reproductor (buenas prácticas) ======================= */
// · Nunca autoplay: solo empieza con un gesto. · preload="none": 0 bytes de audio hasta dar play; luego streaming por rangos.
// · Fundido de entrada/salida. · Reanuda donde lo dejaste (localStorage). · Media Session (pantalla de bloqueo, auriculares).
// · Teclado: espacio, Shift+← →, M. · Barra arrastrable y accesible (role=slider). · Estados de carga y de error.
// · Al terminar la última pista gratis: invitación al álbum completo. · Si lo cierras, vuelve al pulsar play en cualquier sitio.
const audio = new Audio();
audio.preload = 'none';
const player = $('player'), pPlay = $('pPlay'), pBar = $('pBar'), pFill = $('pFill'), pKnob = $('pKnob'), pTip = $('pTip');
let idx = -1, userVol = 0.7, fadeRAF = 0, pendingSeek = 0, lastSave = 0, dragging = false;

const store = {
  get: (n) => { try { return parseFloat(localStorage.getItem('tv-pos-' + n)) || 0; } catch { return 0; } },
  set: (n, v) => { try { localStorage.setItem('tv-pos-' + n, String(v)); } catch { /* modo privado */ } },
};

function fadeTo(target, secs, done) {
  cancelAnimationFrame(fadeRAF);
  const start = audio.volume, t0 = performance.now();
  const step = (now) => {
    const k = clamp((now - t0) / (secs * 1000), 0, 1);
    try { audio.volume = start + (target - start) * k; } catch { /* iOS: volumen de solo lectura */ }
    if (k < 1) fadeRAF = requestAnimationFrame(step); else if (done) done();
  };
  fadeRAF = requestAnimationFrame(step);
}

function setTrack(i) {
  if (idx >= 0) store.set(FREE[idx].n, audio.currentTime);
  idx = i;
  const tr = FREE[i];
  audio.src = AUDIO_BASE + tr.n + '.m4a';
  const resume = store.get(tr.n);
  pendingSeek = resume > 5 && resume < tr.d - 20 ? resume : 0;
  $('pNum').textContent = tr.n;
  $('pTitle').textContent = tr.t;
  $('pDur').textContent = fmt(tr.d);
  $('pCur').textContent = fmt(pendingSeek);
  $('pCover').style.backgroundImage = `url(assets/${tr.bg}.webp)`;
  setProgress(pendingSeek / tr.d);
  player.classList.remove('end', 'error');
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: tr.t, artist: 'Espinoza Meditation', album: 'Тишина внутри',
      artwork: [{src: `assets/${tr.bg}.webp`, sizes: '1672x941', type: 'image/webp'}],
    });
  }
}
function play() {
  player.classList.add('show'); // si se cerró con ×, vuelve
  player.classList.remove('end');
  try { audio.volume = 0; } catch { /* iOS */ }
  const p = audio.play();
  if (p) p.catch(() => setError());
  fadeTo(userVol, 1.4);
}
function pause() { fadeTo(0, 0.6, () => audio.pause()); }
function toggle() { if (idx < 0) { setTrack(0); play(); return; } audio.paused ? play() : pause(); }
function playIndex(i) {
  if (i === idx) { if (audio.paused || !player.classList.contains('show')) play(); else pause(); return; }
  setTrack(i);
  play();
}
// el botón «siguiente» nunca pausa: tras la última gratis vuelve a la primera; solo al terminar sola invita al álbum
function next(auto) { if (idx < FREE.length - 1) playIndex(idx + 1); else if (auto === true) showEnd(); else playIndex(0); }
function prev() { if (audio.currentTime > 5 || idx <= 0) { audio.currentTime = 0; return; } playIndex(idx - 1); }
function showEnd() { pause(); player.classList.add('end'); }
function setError() { player.classList.add('error'); player.classList.remove('loading'); $('pState').textContent = 'ошибка загрузки'; }
function setProgress(r) {
  const pct = clamp(r, 0, 1) * 100;
  pFill.style.width = pct + '%';
  pKnob.style.left = pct + '%';
  pBar.setAttribute('aria-valuenow', Math.round(pct));
}

function sync() {
  const on = !audio.paused;
  const n = idx >= 0 ? FREE[idx].n : null;
  player.classList.toggle('playing', on);
  pPlay.setAttribute('aria-label', on ? 'Пауза' : 'Играть');
  if (!player.classList.contains('error')) $('pState').textContent = ''; // el icono ya dice el estado; «пауза» junto al play confundía
  document.querySelectorAll('.track .play[data-n]').forEach((b) => {
    const mine = b.dataset.n === n;
    b.classList.toggle('on', mine && on);
    b.querySelector('.lbl').textContent = mine ? (on ? 'играет' : 'продолжить') : 'слушать';
  });
  dock.items.forEach((it) => it.a.classList.toggle('now', on && it.tr.n === n));
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
}

audio.addEventListener('play', sync);
audio.addEventListener('pause', sync);
audio.addEventListener('waiting', () => { player.classList.add('loading'); $('pState').textContent = 'загрузка'; });
audio.addEventListener('playing', () => { player.classList.remove('loading'); if (!player.classList.contains('error')) $('pState').textContent = ''; });
audio.addEventListener('loadedmetadata', () => { if (pendingSeek) { audio.currentTime = pendingSeek; pendingSeek = 0; } });
audio.addEventListener('timeupdate', () => {
  if (idx < 0 || dragging) return;
  const d = audio.duration || FREE[idx].d;
  setProgress(audio.currentTime / d);
  $('pCur').textContent = fmt(audio.currentTime);
  if (audio.currentTime - lastSave > 5 || audio.currentTime < lastSave) { lastSave = audio.currentTime; store.set(FREE[idx].n, audio.currentTime); }
});
audio.addEventListener('ended', () => { store.set(FREE[idx].n, 0); next(true); });
audio.addEventListener('error', setError);

pPlay.addEventListener('click', toggle);
$('pNext').addEventListener('click', () => next());
$('pPrev').addEventListener('click', prev);
$('pVol').addEventListener('input', (e) => { userVol = parseFloat(e.target.value); try { audio.volume = userVol; } catch { /* iOS */ } });
$('pClose').addEventListener('click', () => { pause(); player.classList.remove('show'); });

document.addEventListener('click', (e) => {
  const b = e.target.closest('.track .play[data-n]');
  if (!b) return;
  playIndex(FREE.findIndex((t) => t.n === b.dataset.n));
});

// barra de progreso: clic, arrastre (ratón y dedo), teclado y tooltip con el tiempo
const ratioAt = (x) => { const r = pBar.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1); };
pBar.addEventListener('pointermove', (e) => {
  if (idx < 0) return;
  const r = ratioAt(e.clientX);
  pTip.style.left = r * 100 + '%';
  pTip.textContent = fmt(r * FREE[idx].d);
  if (dragging) { setProgress(r); $('pCur').textContent = fmt(r * FREE[idx].d); }
});
pBar.addEventListener('pointerdown', (e) => {
  if (idx < 0) return;
  dragging = true;
  pBar.classList.add('drag');
  pBar.setPointerCapture(e.pointerId);
  setProgress(ratioAt(e.clientX));
});
pBar.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  pBar.classList.remove('drag');
  audio.currentTime = ratioAt(e.clientX) * (audio.duration || FREE[idx].d);
});
pBar.addEventListener('keydown', (e) => {
  if (idx < 0) return;
  if (e.key === 'ArrowRight') { audio.currentTime += 10; e.preventDefault(); }
  if (e.key === 'ArrowLeft') { audio.currentTime -= 10; e.preventDefault(); }
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, [contenteditable]')) return;
  if (e.code === 'Space' && !e.target.closest('button, a')) { e.preventDefault(); toggle(); }
  if (idx < 0 || e.target === pBar) return;
  if (e.key === 'ArrowRight' && e.shiftKey) audio.currentTime += 10;
  if (e.key === 'ArrowLeft' && e.shiftKey) audio.currentTime -= 10;
  if (e.key === 'm' || e.key === 'M') audio.muted = !audio.muted;
});

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', play);
  ms.setActionHandler('pause', pause);
  ms.setActionHandler('previoustrack', prev);
  ms.setActionHandler('nexttrack', () => next());
  ms.setActionHandler('seekbackward', () => { audio.currentTime -= 10; });
  ms.setActionHandler('seekforward', () => { audio.currentTime += 10; });
  try { ms.setActionHandler('seekto', (d) => { audio.currentTime = d.seekTime; }); } catch { /* no soportado */ }
}
addEventListener('pagehide', () => { if (idx >= 0) store.set(FREE[idx].n, audio.currentTime); });
