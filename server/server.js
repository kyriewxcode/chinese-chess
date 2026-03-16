// ==================== 局域网联机服务器 ====================
// 使用方法: node server.js [port]
// 默认端口: 3000

const WebSocket = require('ws');

const PORT = process.argv[2] || 3000;
const wss = new WebSocket.Server({ port: PORT });

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

console.log(`
╔══════════════════════════════════════╗
║     中国象棋 · 局域网联机服务器       ║
╠══════════════════════════════════════╣
║  端口: ${String(PORT).padEnd(29)}║
║  状态: 运行中                         ║
╚══════════════════════════════════════╝
`);

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
                // 回合控制：只允许当前回合的玩家走棋
                if (ws.playerSide !== room.currentTurn) {
                    sendJSON(ws, { type: 'error', message: '不是你的回合' });
                    break;
                }
                // 坐标范围验证
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
                // 切换回合
                room.currentTurn = room.currentTurn === 'red' ? 'black' : 'red';
                const opponent = getOpponent(ws.roomId, ws);
                if (opponent) {
                    sendJSON(opponent, { type: 'move', from: msg.from, to: msg.to });
                }
                break;
            }

            case 'chat': {
                // 限制消息长度，防止滥用
                if (typeof msg.message !== 'string' || msg.message.length > 500) break;
                const chatOpponent = getOpponent(ws.roomId, ws);
                if (chatOpponent) {
                    sendJSON(chatOpponent, { type: 'chat', message: msg.message });
                }
                break;
            }

            case 'resign': {
                const opponent = getOpponent(ws.roomId, ws);
                if (opponent) {
                    sendJSON(opponent, {
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
                const opponent = getOpponent(ws.roomId, ws);
                if (opponent) {
                    sendJSON(opponent, { type: 'opponent_disconnected' });
                }
                rooms.delete(ws.roomId);
                console.log(`[房间] 房间 ${ws.roomId} 已关闭`);
            }
        }
    });
});

console.log(`服务器已启动，监听端口 ${PORT}`);
console.log(`局域网内其他设备请连接: ws://<本机IP>:${PORT}`);
