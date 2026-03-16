// ==================== 联机模块 ====================

class NetworkManager {
    constructor() {
        this.ws = null;
        this.roomId = null;
        this.side = null;
        this.connected = false;
        this.callbacks = {};
    }

    // 注册回调
    on(event, callback) {
        this.callbacks[event] = callback;
    }

    emit(event, data) {
        if (this.callbacks[event]) this.callbacks[event](data);
    }

    // 连接服务器
    connect(serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(serverUrl);

                this.ws.onopen = () => {
                    this.connected = true;
                    resolve();
                };

                this.ws.onmessage = (e) => {
                    try {
                        const msg = JSON.parse(e.data);
                        this.handleMessage(msg);
                    } catch (err) {
                        console.error('消息解析失败:', err);
                    }
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    this.emit('disconnected');
                };

                this.ws.onerror = (err) => {
                    reject(err);
                };

                setTimeout(() => {
                    if (!this.connected) reject(new Error('连接超时'));
                }, 5000);
            } catch (e) {
                reject(e);
            }
        });
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'room_created':
                this.roomId = msg.roomId;
                this.emit('room_created', msg.roomId);
                break;
            case 'game_start':
                this.side = msg.side;
                this.emit('game_start', { side: msg.side, roomId: this.roomId || msg.roomId });
                break;
            case 'move':
                this.emit('opponent_move', { from: msg.from, to: msg.to });
                break;
            case 'opponent_disconnected':
                this.emit('opponent_disconnected');
                break;
            case 'game_over':
                this.emit('game_over', { winner: msg.winner, reason: msg.reason });
                break;
            case 'error':
                this.emit('error', msg.message);
                break;
            case 'chat':
                this.emit('chat', msg.message);
                break;
        }
    }

    send(data) {
        if (this.ws && this.connected) {
            this.ws.send(JSON.stringify(data));
        }
    }

    createRoom() {
        this.send({ type: 'create_room' });
    }

    joinRoom(roomId) {
        this.roomId = roomId;
        this.send({ type: 'join_room', roomId: roomId });
    }

    sendMove(from, to) {
        this.send({ type: 'move', from: from, to: to });
    }

    sendChat(message) {
        this.send({ type: 'chat', message: message });
    }

    sendResign() {
        this.send({ type: 'resign' });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.roomId = null;
        this.side = null;
    }
}
