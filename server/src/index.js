import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 2567);
const wss = new WebSocketServer({ port, maxPayload: 2048 });
const players = new Map();
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const send = (ws, data) => { if (ws.readyState === 1) ws.send(JSON.stringify(data)); };

function snapshot() {
  return [...players.values()].map(({ id, name, x, y, z, yaw, color }) => ({ id, name, x, y, z, yaw, color }));
}
function broadcast(data, except) {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) if (client !== except && client.readyState === 1) client.send(payload);
}
wss.on('connection', (ws) => {
  if (players.size >= 40) { send(ws, { type: 'error', message: 'Room full' }); ws.close(1013, 'Room full'); return; }
  const id = randomUUID();
  const player = { id, name: 'Player', x: 0, y: 0, z: 0, yaw: 0, color: Math.floor(Math.random() * 0xffffff) };
  players.set(id, player);
  send(ws, { type: 'welcome', id, players: snapshot() });
  broadcast({ type: 'join', player }, ws);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'hello') {
      player.name = String(msg.name || 'Player').replace(/[^\p{L}\p{N}_ -]/gu, '').slice(0, 16) || 'Player';
      broadcast({ type: 'update', player }, ws);
    }
    if (msg.type === 'move') {
      player.x = clamp(Number(msg.x), -48, 48);
      player.y = clamp(Number(msg.y), 0, 12);
      player.z = clamp(Number(msg.z), -48, 48);
      player.yaw = clamp(Number(msg.yaw), -1000, 1000);
      broadcast({ type: 'move', player }, ws);
    }
    if (msg.type === 'ping') send(ws, { type: 'pong', at: msg.at });
  });
  ws.on('close', () => { players.delete(id); broadcast({ type: 'leave', id }); });
  ws.on('error', () => { players.delete(id); });
});
console.log(`VEXORA realtime room listening on :${port}`);
