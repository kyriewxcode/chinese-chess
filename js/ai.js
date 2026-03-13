// ==================== AI 接口封装 ====================

class ChessAI {
    constructor() {
        this.worker = null;
        this.thinking = false;
    }

    init() {
        this.worker = new Worker('js/ai-worker.js');
    }

    // 返回 Promise，AI 思考完成后 resolve
    think(board, side, difficulty) {
        return new Promise((resolve) => {
            if (!this.worker) this.init();
            this.thinking = true;

            // 难度对应搜索深度
            const depthMap = { easy: 2, medium: 3, hard: 4 };
            const depth = depthMap[difficulty] || 3;

            this.worker.onmessage = (e) => {
                this.thinking = false;
                resolve(e.data.move);
            };

            this.worker.postMessage({
                board: board.map(row => [...row]),
                side: side,
                depth: depth
            });
        });
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
