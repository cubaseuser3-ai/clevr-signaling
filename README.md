# ClevrRemote Signaling Server

WebSocket Signaling Server für WebRTC Dateitransfer.

## Deployment auf Render

1. Gehe zu https://dashboard.render.com
2. Klicke "New" → "Web Service"
3. Verbinde dieses Repository oder uploade den `server/` Ordner
4. Konfiguration:
   - **Name**: `clevr-signaling`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

Oder nutze den "Deploy to Render" Button mit der `render.yaml`.

## Lokal testen

```bash
cd server
npm install
npm start
```

Server läuft auf http://localhost:3001

## Endpoints

- `GET /` oder `/health` - Health Check (JSON Status)
- `WebSocket /` - Signaling WebSocket

## Protokoll

```json
// Raum beitreten
{ "type": "join", "room": "AB2K" }

// Antwort
{ "type": "joined", "room": "AB2K", "isHost": true, "peerCount": 1 }

// WebRTC Offer/Answer/ICE
{ "type": "offer|answer|ice-candidate", "room": "AB2K", "payload": {...} }

// Peer Events
{ "type": "peer-joined|peer-left", "room": "AB2K" }
```
