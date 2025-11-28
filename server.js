/**
 * ClevrRemote WebRTC Signaling Server
 *
 * Einfacher WebSocket-Server der WebRTC Signaling-Nachrichten
 * zwischen Peers in einem Raum weiterleitet.
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3001;

// HTTP Server für Health Check
const httpServer = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            rooms: rooms.size,
            connections: wss.clients.size,
            uptime: Math.floor(process.uptime())
        }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// WebSocket Server
const wss = new WebSocket.Server({ server: httpServer });

// Räume: Map<roomCode, Set<WebSocket>>
const rooms = new Map();

// Client zu Raum Mapping
const clientRooms = new Map();

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(ws, message);
        } catch (err) {
            console.error('Invalid message:', err.message);
        }
    });

    ws.on('close', () => {
        const roomCode = clientRooms.get(ws);
        if (roomCode) {
            leaveRoom(ws, roomCode);
        }
        console.log('Client disconnected');
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

function handleMessage(ws, message) {
    const { type, room, payload } = message;

    switch (type) {
        case 'join':
            joinRoom(ws, room);
            break;

        case 'leave':
            leaveRoom(ws, room);
            break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
            // Nachricht an alle anderen im Raum weiterleiten
            relayToRoom(ws, room, message);
            break;

        default:
            console.log('Unknown message type:', type);
    }
}

function joinRoom(ws, roomCode) {
    // Akzeptiere 4-8 stellige Codes (8 für Dongle-MAC-basierte Codes)
    if (!roomCode || roomCode.length < 4 || roomCode.length > 8) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid room code (4-8 digits required)' }));
        return;
    }

    // Raum erstellen falls nicht existiert
    if (!rooms.has(roomCode)) {
        rooms.set(roomCode, new Set());
    }

    const room = rooms.get(roomCode);

    // Bereits im Raum?
    if (room.has(ws)) {
        return;
    }

    // Raum voll? (max 2 Peers)
    if (room.size >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
    }

    // Beitreten
    room.add(ws);
    clientRooms.set(ws, roomCode);

    const isHost = room.size === 1;

    ws.send(JSON.stringify({
        type: 'joined',
        room: roomCode,
        isHost: isHost,
        peerCount: room.size
    }));

    console.log(`Client joined room ${roomCode} (${room.size}/2 peers)`);

    // Anderen Peer benachrichtigen
    if (room.size === 2) {
        room.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'peer-joined',
                    room: roomCode
                }));
            }
        });
    }
}

function leaveRoom(ws, roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.delete(ws);
    clientRooms.delete(ws);

    // Anderen Peer benachrichtigen
    room.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'peer-left',
                room: roomCode
            }));
        }
    });

    // Leeren Raum löschen
    if (room.size === 0) {
        rooms.delete(roomCode);
    }

    console.log(`Client left room ${roomCode}`);
}

function relayToRoom(sender, roomCode, message) {
    const room = rooms.get(roomCode);
    if (!room) {
        sender.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
    }

    // An alle anderen im Raum senden
    room.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Aufräumen: Leere Räume alle 5 Minuten entfernen
setInterval(() => {
    let cleaned = 0;
    rooms.forEach((room, code) => {
        // Entferne disconnected clients
        room.forEach(client => {
            if (client.readyState !== WebSocket.OPEN) {
                room.delete(client);
            }
        });
        // Lösche leere Räume
        if (room.size === 0) {
            rooms.delete(code);
            cleaned++;
        }
    });
    if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} empty rooms`);
    }
}, 300000);

httpServer.listen(PORT, () => {
    console.log(`ClevrRemote Signaling Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
