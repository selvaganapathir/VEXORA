# VEXORA

**Play. Create. Conquer.** A lightweight, original 3D browser arena built with Three.js and TypeScript.

## What's in this repository

- Browser-playable third-person world with keyboard, mouse and touch controls, sprint, crouch, jump, look and interaction.
- Expanded town environment, articulated humanoid avatars with facial features and clothing, NPC health, respawn and elimination counter.
- Optional WebSocket room server for player presence and position synchronisation.
- GitHub Actions workflow to build and deploy the static browser client to GitHub Pages.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Build with `npm run build`.

## Optional realtime server

The browser client reads `VITE_WS_URL` at build time. Set it to your secure WebSocket endpoint (for example, `wss://your-host.example`) before building.

```bash
cd server
npm install
npm start
```

The server listens on port 2567 by default. Deploy it to a persistent Node.js host and configure TLS/WSS at the host or reverse proxy. GitHub Pages serves static files only; it cannot run this Node server.

The included room server is an early presence/position relay, **not** a production authoritative PvP backend. Before opening public competitive rooms, add server-authoritative movement/combat, authentication, rate limits, moderation/reporting, persistence, monitoring, DDoS protection and load testing.

## Deploy to GitHub Pages

The included workflow builds on pushes to `main` and deploys the `dist` folder. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions** if it is not already selected. The game URL will be:

`https://selvaganapathir.github.io/VEXORA/`

## Controls

- **Desktop:** WASD / arrows to move, mouse to aim, click to fire, Space to jump, Esc to release pointer lock.
- **Mobile:** on-screen movement stick, jump and fire buttons; drag the right side of the screen to look.

## Performance

The scene uses a compact 3D environment, capped device pixel ratio and Low / Medium / High graphics presets. Players can adjust camera field of view and look sensitivity. The inventory preview includes selectable equipment. NPCs use lightweight autonomous routines to wander, guard, approach or retreat. A 100 FPS target depends on device, browser, resolution, thermal state and network; it is not guaranteed. Profile on target phones and desktops before making performance claims.

## Project status

Playable prototype / early release foundation. This is an original project and is not affiliated with Roblox. It does not reproduce Roblox branding, assets or proprietary code.
