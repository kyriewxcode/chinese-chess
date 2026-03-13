// ==================== 棋盘渲染模块 ====================

class BoardRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = options.gridSize || 60;
        this.padding = options.padding || 40;
        this.pieceRadius = this.gridSize * 0.42;
        this.selectedPos = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.flipped = false; // 是否翻转棋盘（黑方视角）

        this.resize();
    }

    resize() {
        const g = this.gridSize;
        const p = this.padding;
        this.canvas.width = g * 8 + p * 2;
        this.canvas.height = g * 9 + p * 2;
    }

    // 棋盘坐标转像素坐标
    toPixel(r, c) {
        const g = this.gridSize;
        const p = this.padding;
        if (this.flipped) {
            return [p + (8 - c) * g, p + (9 - r) * g];
        }
        return [p + c * g, p + r * g];
    }

    // 像素坐标转棋盘坐标
    fromPixel(x, y) {
        const g = this.gridSize;
        const p = this.padding;
        let c = Math.round((x - p) / g);
        let r = Math.round((y - p) / g);
        if (this.flipped) {
            c = 8 - c;
            r = 9 - r;
        }
        if (r >= 0 && r <= 9 && c >= 0 && c <= 8) return [r, c];
        return null;
    }

    // 绘制棋盘
    drawBoard() {
        const ctx = this.ctx;
        const g = this.gridSize;
        const p = this.padding;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 背景
        ctx.fillStyle = '#f0d9b5';
        ctx.fillRect(0, 0, w, h);

        // 外框
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(p - 5, p - 5, g * 8 + 10, g * 9 + 10);

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#333';

        // 横线
        for (let r = 0; r <= 9; r++) {
            const [x1, y1] = this.toPixel(r, 0);
            const [x2, y2] = this.toPixel(r, 8);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // 竖线（上半部分）
        for (let c = 0; c <= 8; c++) {
            const [x1, y1] = this.toPixel(0, c);
            const [x2, y2] = this.toPixel(4, c);
            if (c === 0 || c === 8) {
                const [x3, y3] = this.toPixel(9, c);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x3, y3);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                const [x3, y3] = this.toPixel(5, c);
                const [x4, y4] = this.toPixel(9, c);
                ctx.beginPath();
                ctx.moveTo(x3, y3);
                ctx.lineTo(x4, y4);
                ctx.stroke();
            }
        }

        // 九宫格斜线
        this.drawPalaceCross(0, 2);
        this.drawPalaceCross(7, 9);

        // 楚河汉界
        ctx.save();
        ctx.font = `bold ${g * 0.4}px "KaiTi", "STKaiti", serif`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const [lx, ly] = this.toPixel(4.5, 2);
        const [rx, ry] = this.toPixel(4.5, 6);
        ctx.fillText('楚 河', lx, ly);
        ctx.fillText('漢 界', rx, ry);
        ctx.restore();

        // 兵/炮位置标记
        this.drawCrossMark(2, 1); this.drawCrossMark(2, 7);
        this.drawCrossMark(7, 1); this.drawCrossMark(7, 7);
        for (let c = 0; c <= 8; c += 2) {
            this.drawCrossMark(3, c);
            this.drawCrossMark(6, c);
        }
    }

    drawPalaceCross(rStart, rEnd) {
        const ctx = this.ctx;
        const [x1, y1] = this.toPixel(rStart, 3);
        const [x2, y2] = this.toPixel(rEnd, 5);
        const [x3, y3] = this.toPixel(rStart, 5);
        const [x4, y4] = this.toPixel(rEnd, 3);
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.moveTo(x3, y3); ctx.lineTo(x4, y4);
        ctx.stroke();
    }

    drawCrossMark(r, c) {
        const ctx = this.ctx;
        const [x, y] = this.toPixel(r, c);
        const s = this.gridSize * 0.1;
        const g = this.gridSize * 0.05;
        const len = this.gridSize * 0.15;

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#333';

        // 四个角的标记
        const dirs = [];
        if (c > 0) { dirs.push([-1, -1]); dirs.push([-1, 1]); }
        if (c < 8) { dirs.push([1, -1]); dirs.push([1, 1]); }

        for (const [dx, dy] of dirs) {
            ctx.beginPath();
            ctx.moveTo(x + dx * g, y + dy * (g + len));
            ctx.lineTo(x + dx * g, y + dy * g);
            ctx.lineTo(x + dx * (g + len), y + dy * g);
            ctx.stroke();
        }
    }

    // 绘制棋子
    drawPiece(r, c, piece, isSelected) {
        if (piece === 0) return;
        const ctx = this.ctx;
        const [x, y] = this.toPixel(r, c);
        const radius = this.pieceRadius;
        const side = getSide(piece);
        const name = getPieceName(piece);

        // 选中高亮
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 150, 255, 0.3)';
            ctx.fill();
        }

        // 棋子底色
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
        grad.addColorStop(0, '#fff8dc');
        grad.addColorStop(1, '#deb887');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 内圈
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.85, 0, Math.PI * 2);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 棋子文字
        ctx.font = `bold ${radius * 1.1}px "KaiTi", "STKaiti", "SimSun", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = side === 'red' ? '#cc0000' : '#000';
        ctx.fillText(name, x, y + 1);
    }

    // 绘制合法走法提示
    drawLegalMoveHints(moves) {
        const ctx = this.ctx;
        for (const [r, c] of moves) {
            const [x, y] = this.toPixel(r, c);
            ctx.beginPath();
            ctx.arc(x, y, this.gridSize * 0.15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 180, 0, 0.4)';
            ctx.fill();
        }
    }

    // 绘制上一步走法标记
    drawLastMove(from, to) {
        const ctx = this.ctx;
        for (const [r, c] of [from, to]) {
            const [x, y] = this.toPixel(r, c);
            ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)';
            ctx.lineWidth = 3;
            ctx.strokeRect(x - this.gridSize * 0.4, y - this.gridSize * 0.4,
                          this.gridSize * 0.8, this.gridSize * 0.8);
        }
    }

    // 完整渲染
    render(board, selectedPos, legalMoves, lastMove) {
        this.drawBoard();

        // 上一步标记
        if (lastMove) {
            this.drawLastMove(lastMove.from, lastMove.to);
        }

        // 合法走法提示
        if (legalMoves && legalMoves.length > 0) {
            this.drawLegalMoveHints(legalMoves);
        }

        // 棋子
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] !== 0) {
                    const isSelected = selectedPos && selectedPos[0] === r && selectedPos[1] === c;
                    this.drawPiece(r, c, board[r][c], isSelected);
                }
            }
        }
    }
}
