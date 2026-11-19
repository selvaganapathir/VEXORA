import * as THREE from 'three';
import './style.css';

type RemotePlayer = { id: string; name: string; x: number; y: number; z: number; yaw: number; color: number };
type ServerMessage = { type: string; id?: string; players?: RemotePlayer[]; player?: RemotePlayer; message?: string };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $('game-canvas') as HTMLCanvasElement;
const startScreen = $('start-screen');
const gameUI = $('game-ui');
const nameInput = $('player-name') as HTMLInputElement;
const healthFill = $('health-fill');
const healthText = $('health-text');
const killsText = $('kills');
const playersText = $('players');
const toast = $('toast');
const netStatus = $('net-status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc8e8);
scene.fog = new THREE.Fog(0x9cc8e8, 34, 105);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !/Mobi|Android/i.test(navigator.userAgent), powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

scene.add(new THREE.HemisphereLight(0xd9efff, 0x43506a, 2.1));
const sun = new THREE.DirectionalLight(0xffe7c4, 2.2);
sun.position.set(-18, 32, 12);
scene.add(sun);

const mat = (color: number, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
const floorMat = mat(0x526c62);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; scene.add(ground);
const grid = new THREE.GridHelper(100, 50, 0x8ca69a, 0x6d887b); grid.position.y = -0.06; scene.add(grid);

const obstacles: THREE.Mesh[] = [];
function block(x: number, z: number, w: number, h: number, d: number, color: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, h / 2, z); scene.add(mesh); obstacles.push(mesh); return mesh;
}
for (let i = 0; i < 4; i++) {
  block(-13 + i * 8.7, -13, 5.2, 2.6 + (i % 2), 2.2, [0x42617b,0x6b567c,0x80634d,0x3f716e][i]);
  block(-13 + i * 8.7, 13, 5.2, 2.4, 2.2, [0x80634d,0x42617b,0x3f716e,0x6b567c][i]);
}
block(-18, 0, 2.2, 3.2, 7, 0x456d82); block(18, 0, 2.2, 3.2, 7, 0x456d82);
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2, r = 29 + (i % 3) * 3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.3, 5), mat(0x66503c));
  trunk.position.set(Math.cos(a) * r, 1.15, Math.sin(a) * r); scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + (i % 3) * 0.25, 0), mat([0x39765c,0x4d895c,0x668b56][i % 3]));
  crown.position.set(trunk.position.x, 3.1, trunk.position.z); scene.add(crown);
}

function makeAvatar(color: number) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.42), mat(color));
  body.position.y = 1.25; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), mat(0xf0c7a2));
  head.position.y = 2.02; root.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.62, 0.38), mat(0x202c43));
  legs.position.y = 0.42; root.add(legs);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.08), mat(0x18263c, 0.35));
  visor.position.set(0, 2.04, -0.29); root.add(visor);
  return root;
}
const player = makeAvatar(0x42d6c5); scene.add(player);
const remotes = new Map<string, { root: THREE.Group; target: THREE.Vector3; name: string }>();
const bots: { root: THREE.Group; hp: number; alive: boolean; respawn: number; phase: number }[] = [];
for (let i = 0; i < 7; i++) {
  const root = makeAvatar([0xff785f,0xffc857,0x9c83ff,0x70a7ff][i % 4]);
  root.position.set(Math.sin(i * 2.4) * 14, 0, Math.cos(i * 2.4) * 14); scene.add(root);
  bots.push({ root, hp: 100, alive: true, respawn: 0, phase: i * 1.7 });
}

const keys = new Set<string>();
const playerPos = new THREE.Vector3(0, 0, 5);
let yaw = 0, pitch = -0.12, verticalVelocity = 0, health = 100, kills = 0;
let playing = false, pointerLocked = false, fireCooldown = 0, network: WebSocket | null = null, ownId = '';
let joystick = { x: 0, y: 0 }, touchLook = false, lastTouchX = 0, lastTouchY = 0;
let lastNetSend = 0, toastTimer = 0;
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const forward = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
const showToast = (message: string) => { toast.textContent = message; toast.classList.add('visible'); toastTimer = 2.2; };

function updateHealth() {
  healthFill.style.width = health + '%'; healthText.textContent = String(Math.ceil(health));
}
function addRemote(p: RemotePlayer) {
  if (p.id === ownId || remotes.has(p.id)) return;
  const root = makeAvatar(p.color || 0x70a7ff); root.position.set(p.x, p.y, p.z); scene.add(root);
  remotes.set(p.id, { root, target: new THREE.Vector3(p.x, p.y, p.z), name: p.name });
  playersText.textContent = String(1 + remotes.size + bots.filter(b => b.alive).length);
}
function connect() {
  const url = (import.meta as ImportMeta & { env: { VITE_WS_URL?: string } }).env.VITE_WS_URL;
  if (!url) { netStatus.textContent = 'PRACTICE'; netStatus.className = 'status'; return; }
  try {
    network = new WebSocket(url);
    network.onopen = () => { netStatus.textContent = 'ONLINE'; netStatus.className = 'status online'; network?.send(JSON.stringify({ type: 'hello', name: nameInput.value })); };
    network.onmessage = (event) => {
      let msg: ServerMessage; try { msg = JSON.parse(event.data) as ServerMessage; } catch { return; }
      if (msg.type === 'welcome') { ownId = msg.id || ''; (msg.players || []).forEach(addRemote); }
      if (msg.type === 'join' && msg.player) addRemote(msg.player);
      if (msg.type === 'update' && msg.player) { const r = remotes.get(msg.player.id); if (r) r.name = msg.player.name; }
      if (msg.type === 'move' && msg.player) { const r = remotes.get(msg.player.id); if (r) r.target.set(msg.player.x, msg.player.y, msg.player.z); else addRemote(msg.player); }
      if (msg.type === 'leave' && msg.id) { const r = remotes.get(msg.id); if (r) scene.remove(r.root); remotes.delete(msg.id); }
    };
    network.onclose = () => { netStatus.textContent = 'DISCONNECTED'; netStatus.className = 'status'; };
    network.onerror = () => { netStatus.textContent = 'CONNECTION ERROR'; };
  } catch { netStatus.textContent = 'PRACTICE'; }
}
function start() {
  if (playing) return;
  playing = true; startScreen.classList.add('hidden'); gameUI.classList.remove('hidden');
  playerPos.set(0, 0, 5); health = 100; updateHealth(); connect();
  if (!/Mobi|Android/i.test(navigator.userAgent)) canvas.requestPointerLock?.();
  showToast('Welcome to VEXORA. Good luck!');
}
function leave() {
  playing = false; document.exitPointerLock?.(); network?.close(); network = null;
  netStatus.textContent = 'OFFLINE'; gameUI.classList.add('hidden'); startScreen.classList.remove('hidden');
}
function fire() {
  if (!playing || fireCooldown > 0) return;
  fireCooldown = 0.24;
  const origin = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  raycaster.set(origin, dir); raycaster.far = 42;
  const targets = bots.filter(b => b.alive).map(b => b.root);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) {
    const target = bots.find(b => b.alive && (b.root === hits[0].object || b.root.children.includes(hits[0].object) || b.root.children.some(c => c === hits[0].object.parent)));
    if (target) {
      target.hp -= 50;
      if (target.hp <= 0) {
        target.alive = false; target.root.visible = false; target.respawn = 3.5; kills++;
        killsText.textContent = String(kills); showToast('ELIMINATION +1');
      }
    }
  }
}
function damage(amount: number) {
  health = Math.max(0, health - amount); updateHealth();
  if (health <= 0) {
    playerPos.set(0, 0, 5); health = 100; updateHealth();
    showToast('You were tagged. Respawned!');
  }
}
function onLook(dx: number, dy: number) {
  yaw -= dx * 0.003; pitch = THREE.MathUtils.clamp(pitch - dy * 0.0025, -0.85, 0.55);
}
document.addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
document.addEventListener('keyup', e => keys.delete(e.code));
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
document.addEventListener('mousemove', e => { if (pointerLocked && playing) onLook(e.movementX, e.movementY); });
canvas.addEventListener('click', () => { if (playing && !pointerLocked && !/Mobi|Android/i.test(navigator.userAgent)) canvas.requestPointerLock?.(); else fire(); });
$('play-btn').addEventListener('click', start);
$('leave-btn').addEventListener('click', leave);
$('fire-btn').addEventListener('pointerdown', e => { e.preventDefault(); fire(); });
$('jump-btn').addEventListener('pointerdown', e => { e.preventDefault(); if (playerPos.y < 0.03) verticalVelocity = 7; });
$('sound-btn').addEventListener('click', () => showToast('Audio is not enabled in this preview.'));
canvas.addEventListener('touchstart', e => {
  if (!playing) return;
  const t = e.changedTouches[0];
  if (t.clientX > innerWidth * 0.42) { touchLook = true; lastTouchX = t.clientX; lastTouchY = t.clientY; }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (!touchLook) return;
  const t = e.changedTouches[0]; onLook(t.clientX - lastTouchX, t.clientY - lastTouchY); lastTouchX = t.clientX; lastTouchY = t.clientY;
}, { passive: true });
canvas.addEventListener('touchend', () => { touchLook = false; });
const joy = $('joystick'), stick = $('stick');
joy.addEventListener('pointerdown', e => { joy.setPointerCapture(e.pointerId); updateJoy(e); });
joy.addEventListener('pointermove', e => { if (e.buttons) updateJoy(e); });
joy.addEventListener('pointerup', () => { joystick = { x: 0, y: 0 }; stick.style.transform = 'translate(0,0)'; });
function updateJoy(e: PointerEvent) {
  const r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const len = Math.max(1, Math.hypot(dx, dy)), scale = Math.min(1, 38 / len);
  joystick = { x: dx / len * scale, y: dy / len * scale };
  stick.style.transform = `translate(${joystick.x * 38}px,${joystick.y * 38}px)`;
}

function update(dt: number) {
  if (!playing) return;
  fireCooldown = Math.max(0, fireCooldown - dt);
  toastTimer -= dt; if (toastTimer <= 0) toast.classList.remove('visible');
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joystick.y;
  const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joystick.x;
  forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  move.copy(forward).multiplyScalar(f).addScaledVector(right, s);
  if (move.lengthSq() > 1) move.normalize();
  playerPos.addScaledVector(move, 8.2 * dt);
  playerPos.x = THREE.MathUtils.clamp(playerPos.x, -47, 47); playerPos.z = THREE.MathUtils.clamp(playerPos.z, -47, 47);
  if ((keys.has('Space')) && playerPos.y < 0.03) verticalVelocity = 7;
  verticalVelocity -= 18 * dt; playerPos.y = Math.max(0, playerPos.y + verticalVelocity * dt); if (playerPos.y === 0) verticalVelocity = 0;
  player.position.set(playerPos.x, playerPos.y, playerPos.z); player.rotation.y = yaw;
  if (keys.has('Mouse0')) fire();
  for (const bot of bots) {
    if (!bot.alive) { bot.respawn -= dt; if (bot.respawn <= 0) { bot.alive = true; bot.hp = 100; bot.root.visible = true; bot.root.position.set((Math.random() - .5) * 32, 0, (Math.random() - .5) * 32); } continue; }
    bot.phase += dt * 0.55; const dx = playerPos.x - bot.root.position.x, dz = playerPos.z - bot.root.position.z;
    if (Math.hypot(dx, dz) < 18) { bot.root.position.x += dx * dt * 0.12; bot.root.position.z += dz * dt * 0.12; bot.root.rotation.y = Math.atan2(-dx, -dz); }
    else { bot.root.position.x += Math.sin(bot.phase) * dt * 0.8; bot.root.position.z += Math.cos(bot.phase) * dt * 0.8; }
    if (Math.hypot(dx, dz) < 2.2 && Math.random() < dt * 0.65) damage(8);
  }
  for (const r of remotes.values()) r.root.position.lerp(r.target, Math.min(1, dt * 12));
  const target = new THREE.Vector3(playerPos.x, playerPos.y + 1.5, playerPos.z);
  const cameraOffset = new THREE.Vector3(Math.sin(yaw) * 5.4, 2.7 + pitch * 2, Math.cos(yaw) * 5.4);
  camera.position.lerp(target.clone().add(cameraOffset), Math.min(1, dt * 8));
  camera.lookAt(target);
  if (network?.readyState === WebSocket.OPEN && performance.now() - lastNetSend > 60) {
    network.send(JSON.stringify({ type: 'move', x: playerPos.x, y: playerPos.y, z: playerPos.z, yaw })); lastNetSend = performance.now();
  }
  playersText.textContent = String(1 + remotes.size + bots.filter(b => b.alive).length);
}
function render() {
  requestAnimationFrame(render);
  const dt = Math.min(clock.getDelta(), 0.04);
  update(dt);
  if (!playing) { camera.position.set(Math.sin(clock.elapsedTime * 0.12) * 28, 18, 32); camera.lookAt(0, 0, 0); }
  renderer.render(scene, camera);
}
render();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setSize(innerWidth, innerHeight);
});
