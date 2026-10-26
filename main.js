import * as THREE from 'three';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth < 760;

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.8 });
    else window.scrollTo({ top: target === 0 ? 0 : target.offsetTop, behavior: 'smooth' });
  });
});

/* ------------------------------------------------------------------ */
/* WebGL: breathing organic form + dust                                */
/* ------------------------------------------------------------------ */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x070a0b, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 7);

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const uniforms = {
  uTime: { value: 0 },
  uBreath: { value: 0 },
  uDistort: { value: 0.3 },
  uFreq: { value: 0.72 },
  uMouse: { value: new THREE.Vector2() },
  uColA: { value: new THREE.Color('#8fd3bf') },
  uColB: { value: new THREE.Color('#f4b393') },
  uColC: { value: new THREE.Color('#0f2229') },
  uAlpha: { value: 0 },
};

const blobMat = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  vertexShader: /* glsl */ `
    uniform float uTime, uBreath, uDistort, uFreq;
    uniform vec2 uMouse;
    varying vec3 vN; varying vec3 vV; varying float vNoise;
    ${NOISE}
    float field(vec3 p){
      float t = uTime * 0.22;
      float n = snoise(p * uFreq + vec3(t, t * 0.7, -t * 0.5));
      n += 0.18 * snoise(p * uFreq * 2.2 - vec3(t * 1.3));
      return n;
    }
    vec3 displace(vec3 p){
      vec3 dir = normalize(p);
      float n = field(p);
      float m = dot(dir.xy, uMouse) * 0.18;
      return p + dir * (n * uDistort * (1.0 - uBreath * 0.35) + m);
    }
    void main(){
      vec3 n0 = normalize(position);
      vec3 tangent = normalize(abs(n0.y) < 0.99 ? cross(n0, vec3(0.0,1.0,0.0)) : cross(n0, vec3(1.0,0.0,0.0)));
      vec3 bitangent = normalize(cross(n0, tangent));
      float e = 0.012;
      vec3 p0 = displace(position);
      vec3 p1 = displace(position + tangent * e);
      vec3 p2 = displace(position + bitangent * e);
      vec3 nrm = normalize(cross(p1 - p0, p2 - p0));
      if (dot(nrm, n0) < 0.0) nrm = -nrm;
      vNoise = field(position);
      vec3 pos = p0 * (1.0 + uBreath * 0.24);
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      vV = normalize(-mv.xyz);
      vN = normalize(normalMatrix * nrm);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColA, uColB, uColC;
    uniform float uTime, uBreath, uAlpha;
    varying vec3 vN; varying vec3 vV; varying float vNoise;
    void main(){
      vec3 n = normalize(vN);
      float fres = pow(1.0 - max(dot(n, vV), 0.0), 2.4);
      vec3 L = normalize(vec3(-0.5, 0.75, 0.6));
      float diff = max(dot(n, L), 0.0);
      float band = smoothstep(-0.7, 0.9, vNoise);
      vec3 col = mix(uColC, uColA, pow(diff, 1.1) * 0.9 + 0.08);
      col = mix(col, uColB, band * 0.55 * (0.6 + 0.4 * diff));
      vec3 rim = mix(uColA, uColB, 0.5 + 0.5 * sin(uTime * 0.35 + vNoise * 2.0));
      col += rim * fres * (0.9 + uBreath * 0.6);
      float spec = pow(max(dot(reflect(-L, n), vV), 0.0), 28.0);
      col += spec * 0.28;
      // subtle iridescent banding
      col += 0.04 * sin(vNoise * 9.0 + uTime) * uColA;
      gl_FragColor = vec4(col, uAlpha);
    }`,
});

const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, isMobile() ? 48 : 80), blobMat);
const blobGroup = new THREE.Group();
blobGroup.add(blob);
scene.add(blobGroup);

// soft halo behind the form
const haloMat = new THREE.ShaderMaterial({
  uniforms: { uColA: uniforms.uColA, uColB: uniforms.uColB, uBreath: uniforms.uBreath, uAlpha: uniforms.uAlpha },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 uColA, uColB; uniform float uBreath, uAlpha; varying vec2 vUv;
    void main(){
      float d = length(vUv - 0.5) * 2.0;
      float g = pow(smoothstep(1.0, 0.0, d), 2.6);
      vec3 c = mix(uColB, uColA, d);
      gl_FragColor = vec4(c * g * (0.16 + uBreath * 0.14), 1.0) * uAlpha;
    }`,
});
const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), haloMat);
halo.position.z = -1.5;
blobGroup.add(halo);

// dust particles
const DUST = isMobile() ? 600 : 1400;
const dPos = new Float32Array(DUST * 3);
const dSeed = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) {
  const r = 2.5 + Math.random() * 7;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  dPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
  dPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
  dPos[i * 3 + 2] = r * Math.cos(ph) - 2;
  dSeed[i] = Math.random();
}
const dGeo = new THREE.BufferGeometry();
dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
dGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));
const dustMat = new THREE.ShaderMaterial({
  uniforms: { uTime: uniforms.uTime, uPx: { value: renderer.getPixelRatio() }, uAlpha: uniforms.uAlpha, uScroll: { value: 0 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uTime, uPx, uScroll; attribute float aSeed; varying float vA;
    void main(){
      vec3 p = position;
      p.y += sin(uTime * 0.2 + aSeed * 6.28) * 0.25 + uScroll * (0.5 + aSeed);
      p.x += cos(uTime * 0.15 + aSeed * 12.0) * 0.2;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = (1.0 + aSeed * 2.2) * uPx * (6.0 / -mv.z);
      vA = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 30.0));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float uAlpha; varying float vA;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vec3(0.93, 0.91, 0.87), a * vA * 0.55 * uAlpha);
    }`,
});
const dust = new THREE.Points(dGeo, dustMat);
scene.add(dust);

/* ------------------------------------------------------------------ */
/* State driven by scroll / interaction                                */
/* ------------------------------------------------------------------ */
const state = { x: 1.1, y: 0, scale: 1, distort: 0.3, rotY: 0 };
const breathCtl = { active: false, v: 0 };
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

window.addEventListener('pointermove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
});

const palettes = {
  base:       ['#8fd3bf', '#f4b393', '#0f2229'],
  breath:     ['#9fd8e3', '#efd9a7', '#0d2330'],
  meditation: ['#b9cf9f', '#e9a58f', '#16231a'],
  sleep:      ['#7e9fc4', '#e0cfb0', '#0c1626'],
  journal:    ['#ecc890', '#ef8d78', '#2a1712'],
};
function setPalette(name) {
  const p = palettes[name] || palettes.base;
  ['uColA', 'uColB', 'uColC'].forEach((k, i) => {
    const c = new THREE.Color(p[i]);
    gsap.to(uniforms[k].value, { r: c.r, g: c.g, b: c.b, duration: 1.4, ease: 'power2.out' });
  });
}

/* ------------------------------------------------------------------ */
/* Render loop                                                         */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  uniforms.uTime.value = reduceMotion ? t * 0.25 : t;

  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  uniforms.uMouse.value.set(mouse.x, mouse.y);

  // idle breathing ~ 10s cycle, overridden by the guided exercise
  const idle = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 10 - Math.PI / 2);
  const target = breathCtl.active ? breathCtl.v : idle * 0.55;
  uniforms.uBreath.value += (target - uniforms.uBreath.value) * 0.08;
  uniforms.uDistort.value = state.distort;

  const xMul = isMobile() ? 0.25 : 1;
  blobGroup.position.x = state.x * xMul + mouse.x * 0.15;
  blobGroup.position.y = state.y + mouse.y * 0.1;
  const fit = Math.min(1, camera.aspect * 1.25);
  blobGroup.scale.setScalar(state.scale * fit);
  blob.rotation.y = t * 0.06 + state.rotY;
  blob.rotation.x = Math.sin(t * 0.1) * 0.2;
  dust.rotation.y = t * 0.01;
  camera.position.x = mouse.x * 0.25;
  camera.position.y = mouse.y * 0.15;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------ */
/* Cursor                                                              */
/* ------------------------------------------------------------------ */
const cursor = document.querySelector('.cursor');
const dot = document.querySelector('.cursor__dot');
const ring = document.querySelector('.cursor__ring');
const cur = { x: -100, y: -100, rx: -100, ry: -100 };
window.addEventListener('pointermove', (e) => { cur.x = e.clientX; cur.y = e.clientY; });
gsap.ticker.add(() => {
  cur.rx += (cur.x - cur.rx) * 0.16;
  cur.ry += (cur.y - cur.ry) * 0.16;
  dot.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%,-50%)`;
  ring.style.transform = `translate(${cur.rx}px, ${cur.ry}px) translate(-50%,-50%)`;
});
document.querySelectorAll('[data-hover], button, input').forEach((el) => {
  el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
  el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
});

/* ------------------------------------------------------------------ */
/* Manifesto word split                                                */
/* ------------------------------------------------------------------ */
document.querySelectorAll('[data-split]').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
});

/* ------------------------------------------------------------------ */
/* Intro                                                               */
/* ------------------------------------------------------------------ */
function intro() {
  const count = { v: 0 };
  const el = document.getElementById('loadCount');
  const tl = gsap.timeline();
  tl.to(count, { v: 100, duration: reduceMotion ? 0.3 : 2.2, ease: 'power2.inOut', onUpdate: () => { el.textContent = Math.round(count.v); } })
    .to('.loader__bar span', { scaleX: 1, duration: reduceMotion ? 0.3 : 2.2, ease: 'power2.inOut' }, 0)
    .to('.loader__word', { opacity: 0, duration: 0.5 }, '-=0.2')
    .to('.loader', { yPercent: -100, duration: 1.2, ease: 'expo.inOut' })
    .add(() => { document.body.classList.remove('is-loading'); if (lenis) lenis.start(); document.querySelector('.loader').style.display = 'none'; })
    .to(uniforms.uAlpha, { value: 1, duration: 2, ease: 'power2.out' }, '-=0.9')
    .fromTo(state, { scale: 0.55 }, { scale: 1, duration: 2.4, ease: 'expo.out' }, '<')
    .to('.hero__title .line > span', { y: 0, yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.12 }, '<0.2')
    .to('.reveal-up', { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 }, '<0.4');
}

/* ------------------------------------------------------------------ */
/* Scroll choreography                                                 */
/* ------------------------------------------------------------------ */
function scrollScenes() {
  // One scrubbed timeline for the whole page: time == scroll pixels, so
  // each section hands the form to a new pose without tween conflicts.
  const poses = [
    ['.manifesto', { x: 2.2, y: 0.2, scale: 0.72, distort: 0.36, rotY: 1.2 }],
    ['.practices', { x: -2.4, y: -0.1, scale: 0.78, distort: 0.28, rotY: 2.4 }],
    ['.breath',    { x: 0, y: 0.05, scale: 0.8, distort: 0.2, rotY: 3.4 }],
    ['.join',      { x: 1.9, y: -0.4, scale: 0.6, distort: 0.45, rotY: 4.6 }],
  ];
  const buildPoseTimeline = () => {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'sine.inOut' } });
    poses.forEach(([sel, pose]) => {
      const top = document.querySelector(sel).offsetTop;
      const start = Math.max(0, top - vh);
      const end = Math.min(max, top - vh * 0.15);
      tl.to(state, { ...pose, duration: Math.max(1, end - start) }, start);
    });
    tl.set({}, {}, max);
    return tl;
  };
  const poseTl = buildPoseTimeline();
  ScrollTrigger.create({ start: 0, end: 'max', scrub: 1.2, animation: poseTl });

  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => { dustMat.uniforms.uScroll.value = self.progress * 3; },
  });

  // manifesto words
  gsap.to('.manifesto__text .w', {
    opacity: 1, stagger: 0.08, ease: 'none',
    scrollTrigger: { trigger: '.manifesto__text', start: 'top 75%', end: 'bottom 45%', scrub: true },
  });
  gsap.from('.manifesto__aside', {
    opacity: 0, y: 40, duration: 1.2, ease: 'expo.out',
    scrollTrigger: { trigger: '.manifesto__aside', start: 'top 85%' },
  });

  // practices rows
  gsap.utils.toArray('.practice').forEach((row) => {
    gsap.from(row.children, {
      yPercent: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: row, start: 'top 90%' },
    });
  });

  // headings
  gsap.utils.toArray('.h2, .join__title').forEach((h) => {
    gsap.from(h, { y: 80, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
  });

  // parallax on hero title while leaving
  gsap.to('.hero__title', {
    yPercent: -30, opacity: 0.15, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ------------------------------------------------------------------ */
/* Practice hover -> palette                                           */
/* ------------------------------------------------------------------ */
document.querySelectorAll('.practice').forEach((row) => {
  row.addEventListener('pointerenter', () => {
    setPalette(row.dataset.palette);
    document.querySelectorAll('.practice').forEach((r) => r.classList.toggle('is-active', r === row));
  });
});
document.querySelector('.practices__list').addEventListener('pointerleave', () => {
  setPalette('base');
  document.querySelectorAll('.practice').forEach((r) => r.classList.remove('is-active'));
});

/* ------------------------------------------------------------------ */
/* Guided 4-7-8 breathing                                              */
/* ------------------------------------------------------------------ */
const phaseEl = document.getElementById('breathPhase');
const countEl = document.getElementById('breathCount');
const infoEl = document.getElementById('breathInfo');
const btn = document.getElementById('breathBtn');
const dots = [...document.querySelectorAll('#breathDots i')];
let breathTl = null;

const PHASES = [
  { label: 'Nefes al', d: 4, to: 1 },
  { label: 'Tut', d: 7, to: 1 },
  { label: 'Ver', d: 8, to: 0 },
];
const CYCLES = 4;

function setPhase(text) {
  gsap.timeline()
    .to(phaseEl, { opacity: 0, y: -12, duration: 0.35, ease: 'power2.in' })
    .add(() => { phaseEl.textContent = text; })
    .fromTo(phaseEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' });
}

function stopBreath(done) {
  if (breathTl) breathTl.kill();
  breathTl = null;
  breathCtl.active = false;
  btn.querySelector('span').textContent = done ? 'Tekrar başla' : 'Egzersizi başlat';
  countEl.innerHTML = '&nbsp;';
  setPhase(done ? 'Güzel.' : '4 · 7 · 8');
  infoEl.textContent = done
    ? 'Bir dakika önce nasıl hissediyordun, şimdi nasıl? Bu farkı fark etmek pratiğin kendisi.'
    : 'Dört saniye nefes al, yedi saniye tut, sekiz saniye ver. Dört döngü, bir dakikadan biraz fazla.';
  if (!done) dots.forEach((d) => d.classList.remove('on'));
  setPalette('base');
}

function startBreath() {
  breathCtl.active = true;
  breathCtl.v = uniforms.uBreath.value;
  btn.querySelector('span').textContent = 'Durdur';
  infoEl.textContent = 'Omuzlarını bırak. Gözlerini kapatabilirsin, sayaç seni takip eder.';
  dots.forEach((d) => d.classList.remove('on'));
  setPalette('breath');

  breathTl = gsap.timeline({ onComplete: () => stopBreath(true) });
  for (let c = 0; c < CYCLES; c++) {
    PHASES.forEach((p) => {
      const sec = { s: p.d };
      breathTl.add(() => { setPhase(p.label); }, '>');
      breathTl.to(breathCtl, { v: p.to, duration: p.d, ease: p.to === 1 && p.label !== 'Tut' ? 'sine.inOut' : 'sine.inOut' }, '<');
      breathTl.to(sec, {
        s: 0, duration: p.d, ease: 'none',
        onUpdate: () => { countEl.textContent = `${Math.ceil(sec.s)}`; },
      }, '<');
    });
    breathTl.add(() => { dots[c].classList.add('on'); }, '>');
  }
}

btn.addEventListener('click', () => (breathTl ? stopBreath(false) : startBreath()));

/* ------------------------------------------------------------------ */
/* Waitlist form (front-end only)                                      */
/* ------------------------------------------------------------------ */
const form = document.getElementById('joinForm');
const msg = document.getElementById('joinMsg');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  msg.classList.toggle('err', !ok);
  if (!ok) { msg.textContent = 'Geçerli bir e-posta adresi yaz.'; return; }
  msg.textContent = 'Teşekkürler. Hazır olduğumuzda sana ilk biz yazacağız.';
  form.reset();
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
const boot = () => { scrollScenes(); intro(); };
if (document.fonts && document.fonts.ready) {
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(boot);
} else {
  boot();
}
