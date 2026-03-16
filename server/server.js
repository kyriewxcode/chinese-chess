// ==================== 中国象棋服务器 ====================
// 使用方法: node server.js [port]
// 默认端口: 3000
// 功能: HTTP 静态文件服务 + WebSocket 联机 + AI API 代理

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.argv[2] || 3000;
const ROOT_DIR = path.join(__dirname, '..');

// ===== HTTP 静态文件服务器 =====
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const httpServer = http.createServer(async (req, res) => {
    // API 代理：POST /api/ai
    if (req.method === 'POST' && req.url === '/api/ai') {
        return handleAIProxy(req, res);
    }

    // 静态文件服务
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(ROOT_DIR, filePath);

    // 安全检查：防止路径遍历
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch (e) {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// ===== AI API 代理 =====
async function handleAIProxy(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const { apiUrl, apiKey, messages, model } = JSON.parse(body);

            if (!apiUrl || !apiKey) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '缺少 apiUrl 或 apiKey' }));
                return;
            }

            const isAnthropic = apiUrl.includes('anthropic.com');
            const baseUrl = apiUrl.replace(/\/+$/, '');
            let targetUrl, headers, reqBody;

            if (isAnthropic) {
                targetUrl = baseUrl + '/v1/messages';
                headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                };
                reqBody = JSON.stringify({
                    model: model || 'claude-sonnet-4-20250514',
                    max_tokens: 500,
                    messages: messages
                });
            } else {
                targetUrl = baseUrl + '/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                };
                reqBody = JSON.stringify({
                    model: model || 'claude-sonnet-4-20250514',
                    max_tokens: 500,
                    messages: messages
                });
            }

            console.log(`[AI] 代理请求 -> ${targetUrl}`);

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: headers,
                body: reqBody
            });

            const data = await response.text();
            console.log(`[AI] 响应状态: ${response.status}`);

            // 提取返回的文本内容
            let text = '';
            try {
                const json = JSON.parse(data);
                if (json.content && json.content[0]) {
                    text = json.content[0].text;
                } else if (json.choices && json.choices[0]) {
                    text = json.choices[0].message.content;
                } else {
                    text = data;
                }
            } catch (e) {
                text = data;
            }

            res.writeHead(response.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ text: text, status: response.status }));
        } catch (e) {
            console.error('[AI] 代理错误:', e.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    });
}

// ===== WebSocket 联机服务器 =====
const wss = new WebSocket.Server({ server: httpServer });

const rooms = new Map(); // roomId -> { players: [ws1, ws2], sides: ['red', 'black'], currentTurn: 'red' }

function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

function sendJSON(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function getOpponent(roomId, ws) {
    const room = rooms.get(roomId);
    if (!room) return null;
    return room.players.find(p => p !== ws);
}

wss.on('connection', (ws) => {
    console.log('[连接] 新玩家已连接');
    ws.roomId = null;

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            return;
        }

        switch (msg.type) {
            case 'create_room': {
                let roomId = generateRoomId();
                while (rooms.has(roomId)) roomId = generateRoomId();

                rooms.set(roomId, {
                    players: [ws],
                    sides: ['red'],
                    currentTurn: 'red'
                });
                ws.roomId = roomId;
                ws.playerSide = 'red';

                sendJSON(ws, { type: 'room_created', roomId: roomId });
                console.log(`[房间] 创建房间 ${roomId}`);
                break;
            }

            case 'join_room': {
                const roomId = msg.roomId.toUpperCase();
                const room = rooms.get(roomId);

                if (!room) {
                    sendJSON(ws, { type: 'error', message: '房间不存在' });
                    return;
                }
                if (room.players.length >= 2) {
                    sendJSON(ws, { type: 'error', message: '房间已满' });
                    return;
                }

                room.players.push(ws);
                room.sides.push('black');
                ws.roomId = roomId;
                ws.playerSide = 'black';

                console.log(`[房间] 玩家加入房间 ${roomId}`);

                // 通知双方游戏开始
                sendJSON(room.players[0], { type: 'game_start', side: 'red', roomId: roomId });
                sendJSON(room.players[1], { type: 'game_start', side: 'black', roomId: roomId });
                break;
            }

            case 'move': {
                const room = rooms.get(ws.roomId);
                if (!room) break;
                if (ws.playerSide !== room.currentTurn) {
                    sendJSON(ws, { type: 'error', message: '不是你的回合' });
                    break;
                }
                const { from, to } = msg;
                if (!from || !to ||
                    !Array.isArray(from) || !Array.isArray(to) ||
                    from.length !== 2 || to.length !== 2 ||
                    !Number.isInteger(from[0]) || !Number.isInteger(from[1]) ||
                    !Number.isInteger(to[0]) || !Number.isInteger(to[1]) ||
                    from[0] < 0 || from[0] > 9 || from[1] < 0 || from[1] > 8 ||
                    to[0] < 0 || to[0] > 9 || to[1] < 0 || to[1] > 8) {
                    sendJSON(ws, { type: 'error', message: '非法走法' });
                    break;
                }
                room.currentTurn = room.currentTurn === 'red' ? 'black' : 'red';
                const opponent = getOpponent(ws.roomId, ws);
                if (opponent) {
                    sendJSON(opponent, { type: 'move', from: msg.from, to: msg.to });
                }
                break;
            }

            case 'chat': {
                if (typeof msg.message !== 'string' || msg.message.length > 500) break;
                const chatOpponent = getOpponent(ws.roomId, ws);
                if (chatOpponent) {
                    sendJSON(chatOpponent, { type: 'chat', message: msg.message });
                }
                break;
            }

            case 'resign': {
                const resignOpponent = getOpponent(ws.roomId, ws);
                if (resignOpponent) {
                    sendJSON(resignOpponent, {
                        type: 'game_over',
                        winner: ws.playerSide === 'red' ? 'black' : 'red',
                        reason: 'resign'
                    });
                }
                break;
            }
        }
    });

    ws.on('close', () => {
        console.log('[断开] 玩家断开连接');
        if (ws.roomId) {
            const room = rooms.get(ws.roomId);
            if (room) {
                const closeOpponent = getOpponent(ws.roomId, ws);
                if (closeOpponent) {
                    sendJSON(closeOpponent, { type: 'opponent_disconnected' });
                }
                rooms.delete(ws.roomId);
                console.log(`[房间] 房间 ${ws.roomId} 已关闭`);
            }
        }
    });
});

// ===== 启动 =====
httpServer.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║       中国象棋 · 游戏服务器          ║
╠══════════════════════════════════════╣
║  地址: http://localhost:${String(PORT).padEnd(14)}║
║  功能: 网页 + 联机 + AI代理          ║
╚══════════════════════════════════════╝
`);
    console.log(`浏览器打开: http://localhost:${PORT}`);
});
