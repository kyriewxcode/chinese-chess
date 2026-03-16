// ==================== 游戏主控制器 ====================

class ChessGame {
    constructor() {
        this.board = createInitialBoard();
        this.currentTurn = 'red'; // 红先
        this.selectedPos = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.moveHistory = [];
        this.gameMode = null; // 'local', 'ai', 'online'
        this.playerSide = 'red';
        this.gameOver = false;
        this.aiDifficulty = 'medium';

        this.renderer = null;
        this.ai = new ChessAI();
        this.claudeAI = null;
        this.network = new NetworkManager();

        this.initUI();
    }

    initUI() {
        // 主菜单按钮
        document.getElementById('btn-local').addEventListener('click', () => this.startLocal());
        document.getElementById('btn-ai').addEventListener('click', () => this.showAIOptions());
        document.getElementById('btn-online').addEventListener('click', () => this.showOnlineOptions());

        // AI 选项
        document.getElementById('btn-ai-start').addEventListener('click', () => this.startAI());
        document.getElementById('btn-ai-back').addEventListener('click', () => this.showMenu());

        // 难度切换时显示/隐藏 API Key 输入
        document.getElementById('ai-difficulty').addEventListener('change', (e) => {
            document.getElementById('api-key-group').style.display =
                e.target.value === 'claude' ? 'block' : 'none';
        });

        // 联机选项
        document.getElementById('btn-create-room').addEventListener('click', () => this.createRoom());
        document.getElementById('btn-join-room').addEventListener('click', () => this.joinRoom());
        document.getElementById('btn-online-back').addEventListener('click', () => this.showMenu());

        // 游戏内按钮
        document.getElementById('btn-undo').addEventListener('click', () => this.undoLastMove());
        document.getElementById('btn-resign').addEventListener('click', () => this.resign());
        document.getElementById('btn-back-menu').addEventListener('click', () => this.backToMenu());

        // Canvas 点击
        const canvas = document.getElementById('chessBoard');
        canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    }

    showMenu() {
        document.getElementById('menu-screen').style.display = 'flex';
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('ai-options').style.display = 'none';
        document.getElementById('online-options').style.display = 'none';
        document.getElementById('waiting-room').style.display = 'none';
    }

    showAIOptions() {
        document.getElementById('ai-options').style.display = 'flex';
        document.getElementById('menu-buttons').style.display = 'none';
    }

    showOnlineOptions() {
        document.getElementById('online-options').style.display = 'flex';
        document.getElementById('menu-buttons').style.display = 'none';
    }

    showGame() {
        document.getElementById('menu-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'flex';
    }

    resetGame() {
        this.board = createInitialBoard();
        this.currentTurn = 'red';
        this.selectedPos = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.moveHistory = [];
        this.gameOver = false;
    }

    // ===== 本地对弈 =====
    startLocal() {
        this.gameMode = 'local';
        this.playerSide = 'red';
        this.resetGame();
        this.showGame();
        this.initRenderer(false);
        this.updateStatus('红方走棋');
        this.render();
    }

    // ===== AI 对战 =====
    startAI() {
        this.gameMode = 'ai';
        this.aiDifficulty = document.getElementById('ai-difficulty').value;
        this.playerSide = document.getElementById('ai-side').value;

        // Claude 大模型模式
        if (this.aiDifficulty === 'claude') {
            const apiKey = document.getElementById('claude-api-key').value.trim();
            if (!apiKey) {
                alert('请输入 Claude API Key');
                return;
            }
            this.claudeAI = new ClaudeChessAI(apiKey);
        } else {
            this.claudeAI = null;
        }

        this.resetGame();
        this.showGame();
        this.initRenderer(this.playerSide === 'black');
        this.updateStatus('红方走棋');
        this.render();

        // 如果玩家选黑，AI 先走
        if (this.playerSide === 'black') {
            this.aiMove();
        }
    }

    async aiMove() {
        if (this.gameOver) return;

        if (this.claudeAI) {
            // Claude 大模型模式
            this.updateStatus('Claude 思考中...');
            const move = await this.claudeAI.think(this.board, this.currentTurn, 'claude');
            if (move && !this.gameOver) {
                if (move.reason) {
                    this.updateStatus(`Claude: ${move.reason}`);
                    await new Promise(r => setTimeout(r, 1000));
                }
                this.claudeAI.recordMove(move.from, move.to);
                this.executeMove(move.from, move.to);
            } else if (!move && !this.gameOver) {
                this.updateStatus('Claude 未返回有效走法，使用本地AI');
                // 降级到本地 AI
                const fallback = await this.ai.think(this.board, this.currentTurn, 'hard');
                if (fallback && !this.gameOver) {
                    this.executeMove(fallback.from, fallback.to);
                }
            }
        } else {
            // 本地 AI 模式
            this.updateStatus('AI 思考中...');
            const move = await this.ai.think(this.board, this.currentTurn, this.aiDifficulty);
            if (move && !this.gameOver) {
                this.executeMove(move.from, move.to);
            } else if (!move && !this.gameOver) {
                this.updateStatus('AI 计算超时，请重试');
            }
        }
    }

    // ===== 联机对战 =====
    async createRoom() {
        const serverIp = document.getElementById('server-ip').value;
        const port = document.getElementById('server-port').value;
        try {
            this.updateOnlineStatus('正在连接服务器...');
            await this.network.connect(`ws://${serverIp}:${port}`);
            this.setupNetworkCallbacks();
            this.network.createRoom();
            this.updateOnlineStatus('正在创建房间...');
        } catch (e) {
            this.updateOnlineStatus('连接失败: ' + e.message);
        }
    }

    async joinRoom() {
        const serverIp = document.getElementById('server-ip').value;
        const port = document.getElementById('server-port').value;
        const roomId = document.getElementById('room-id-input').value.trim();
        if (!roomId) {
            this.updateOnlineStatus('请输入房间号');
            return;
        }
        try {
            this.updateOnlineStatus('正在连接服务器...');
            await this.network.connect(`ws://${serverIp}:${port}`);
            this.setupNetworkCallbacks();
            this.network.joinRoom(roomId);
            this.updateOnlineStatus('正在加入房间...');
        } catch (e) {
            this.updateOnlineStatus('连接失败: ' + e.message);
        }
    }

    setupNetworkCallbacks() {
        this.network.on('room_created', (roomId) => {
            document.getElementById('online-options').style.display = 'none';
            document.getElementById('waiting-room').style.display = 'flex';
            document.getElementById('room-id-display').textContent = roomId;
        });

        this.network.on('game_start', (data) => {
            this.gameMode = 'online';
            this.playerSide = data.side;
            this.resetGame();
            this.showGame();
            this.initRenderer(this.playerSide === 'black');
            this.updateStatus(`你是${data.side === 'red' ? '红' : '黑'}方 | 红方走棋`);
            this.render();
        });

        this.network.on('opponent_move', (data) => {
            this.executeMove(data.from, data.to);
        });

        this.network.on('opponent_disconnected', () => {
            this.updateStatus('对手已断开连接');
            this.gameOver = true;
        });

        this.network.on('game_over', (data) => {
            const winnerName = data.winner === 'red' ? '红' : '黑';
            const reason = data.reason === 'resign' ? '对手认输' : '';
            this.updateStatus(`${winnerName}方胜！${reason}`);
            this.gameOver = true;
            this.render();
            setTimeout(() => alert(`${winnerName}方胜利！${reason}`), 300);
        });

        this.network.on('error', (msg) => {
            this.updateOnlineStatus('错误: ' + msg);
        });
    }

    // ===== 渲染 =====
    initRenderer(flipped) {
        const canvas = document.getElementById('chessBoard');
        this.renderer = new BoardRenderer(canvas, { gridSize: 60 });
        this.renderer.flipped = flipped;
    }

    render() {
        if (this.renderer) {
            this.renderer.render(this.board, this.selectedPos, this.legalMoves, this.lastMove);
        }
    }

    // ===== 点击处理 =====
    onCanvasClick(e) {
        if (this.gameOver) return;
        if (!this.renderer) return;

        // 联机模式下不是自己的回合不能操作
        if (this.gameMode === 'online' && this.currentTurn !== this.playerSide) return;
        // AI 模式下不是自己的回合不能操作
        if (this.gameMode === 'ai' && this.currentTurn !== this.playerSide) return;

        const rect = this.canvas_rect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pos = this.renderer.fromPixel(x, y);
        if (!pos) return;

        const [r, c] = pos;
        const piece = this.board[r][c];

        if (this.selectedPos) {
            // 已选中棋子
            if (piece !== 0 && getSide(piece) === this.currentTurn) {
                // 点击自己的棋子，切换选中
                this.selectedPos = [r, c];
                this.legalMoves = getLegalMoves(this.board, r, c);
                this.render();
            } else if (this.legalMoves.some(m => m[0] === r && m[1] === c)) {
                // 走棋
                const from = this.selectedPos;
                const to = [r, c];

                if (this.gameMode === 'online') {
                    this.network.sendMove(from, to);
                }
                this.executeMove(from, to);
            } else {
                // 取消选中
                this.selectedPos = null;
                this.legalMoves = [];
                this.render();
            }
        } else {
            // 未选中，选中自己的棋子
            if (piece !== 0 && getSide(piece) === this.currentTurn) {
                this.selectedPos = [r, c];
                this.legalMoves = getLegalMoves(this.board, r, c);
                this.render();
            }
        }
    }

    canvas_rect() {
        return document.getElementById('chessBoard').getBoundingClientRect();
    }

    // ===== 执行走棋 =====
    executeMove(from, to) {
        const captured = makeMove(this.board, from, to);
        this.moveHistory.push({ from, to, captured });
        this.lastMove = { from, to };
        this.selectedPos = null;
        this.legalMoves = [];

        // Claude AI 记录走棋
        if (this.claudeAI && this.currentTurn === this.playerSide) {
            this.claudeAI.recordMove(from, to);
        }

        // 切换回合
        this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';

        // 检查将杀/困毙
        if (isCheckmate(this.board, this.currentTurn)) {
            const winner = this.currentTurn === 'red' ? '黑' : '红';
            this.updateStatus(`${winner}方胜！将杀！`);
            this.gameOver = true;
            this.render();
            setTimeout(() => alert(`${winner}方胜利！`), 300);
            return;
        }

        if (isStalemate(this.board, this.currentTurn)) {
            this.updateStatus('和棋！困毙！');
            this.gameOver = true;
            this.render();
            setTimeout(() => alert('和棋！困毙！'), 300);
            return;
        }

        const inCheck = isCheck(this.board, this.currentTurn);
        const turnName = this.currentTurn === 'red' ? '红' : '黑';

        if (this.gameMode === 'online') {
            const myTurn = this.currentTurn === this.playerSide;
            this.updateStatus(`你是${this.playerSide === 'red' ? '红' : '黑'}方 | ${turnName}方走棋${inCheck ? ' | 将军！' : ''}${myTurn ? '' : ' | 等待对手'}`);
        } else {
            this.updateStatus(`${turnName}方走棋${inCheck ? ' | 将军！' : ''}`);
        }

        this.render();

        // AI 回合
        if (this.gameMode === 'ai' && this.currentTurn !== this.playerSide && !this.gameOver) {
            setTimeout(() => this.aiMove(), 300);
        }
    }

    // ===== 悔棋 =====
    undoLastMove() {
        if (this.moveHistory.length === 0 || this.gameOver) return;
        if (this.gameMode === 'online') return; // 联机不能悔棋

        // AI 模式悔两步（自己+AI）
        const steps = this.gameMode === 'ai' ? 2 : 1;
        for (let i = 0; i < steps && this.moveHistory.length > 0; i++) {
            const last = this.moveHistory.pop();
            undoMove(this.board, last.from, last.to, last.captured);
            this.currentTurn = this.currentTurn === 'red' ? 'black' : 'red';
        }

        this.selectedPos = null;
        this.legalMoves = [];
        this.lastMove = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;
        const turnName = this.currentTurn === 'red' ? '红' : '黑';
        this.updateStatus(`${turnName}方走棋`);
        this.render();
    }

    // ===== 认输 =====
    resign() {
        if (this.gameOver) return;
        if (!confirm('确定认输吗？')) return;
        if (this.gameMode === 'online') {
            this.network.sendResign();
        }
        const winner = this.currentTurn === 'red' ? '黑' : '红';
        this.updateStatus(`${this.currentTurn === 'red' ? '红' : '黑'}方认输，${winner}方胜！`);
        this.gameOver = true;
    }

    // ===== 返回菜单 =====
    backToMenu() {
        this.network.disconnect();
        this.ai.destroy();
        this.ai = new ChessAI();
        if (this.claudeAI) {
            this.claudeAI.destroy();
            this.claudeAI = null;
        }
        document.getElementById('menu-buttons').style.display = 'flex';
        document.getElementById('ai-options').style.display = 'none';
        document.getElementById('online-options').style.display = 'none';
        document.getElementById('waiting-room').style.display = 'none';
        this.showMenu();
    }

    updateStatus(text) {
        document.getElementById('game-status').textContent = text;
    }

    updateOnlineStatus(text) {
        const el = document.getElementById('online-status');
        if (el) el.textContent = text;
    }
}

// 启动游戏
window.addEventListener('load', () => {
    window.game = new ChessGame();
});
