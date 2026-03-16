// ==================== AI 接口封装 ====================

class ChessAI {
    constructor() {
        this.worker = null;
        this.thinking = false;
    }

    init() {
        // 使用 Blob Worker 避免 file:// 协议下跨域限制
        const workerCode = `
// ===== 棋规函数（Worker 内联） =====
const PIECE_VALUES = { 1: 600, 2: 270, 3: 120, 4: 120, 5: 10000, 6: 285, 7: 30 };

function getSide(piece) {
    if (piece > 0) return 'red';
    if (piece < 0) return 'black';
    return null;
}

function isInBoard(r, c) {
    return r >= 0 && r <= 9 && c >= 0 && c <= 8;
}

function isInPalace(r, c, side) {
    if (side === 'red') return r >= 7 && r <= 9 && c >= 3 && c <= 5;
    return r >= 0 && r <= 2 && c >= 3 && c <= 5;
}

function isOnSide(r, side) {
    if (side === 'red') return r >= 5 && r <= 9;
    return r >= 0 && r <= 4;
}

function cloneBoard(board) {
    return board.map(row => [...row]);
}

function getPseudoMoves(board, r, c) {
    const piece = board[r][c];
    if (piece === 0) return [];
    const side = getSide(piece);
    const absPiece = Math.abs(piece);
    const moves = [];

    const addMove = (tr, tc) => {
        if (!isInBoard(tr, tc)) return false;
        const target = board[tr][tc];
        if (target === 0 || getSide(target) !== side) {
            moves.push([tr, tc]);
            return true;
        }
        return false;
    };

    switch (absPiece) {
        case 1:
            for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                for (let i = 1; i < 10; i++) {
                    const tr = r + dr * i, tc = c + dc * i;
                    if (!isInBoard(tr, tc)) break;
                    if (board[tr][tc] === 0) { moves.push([tr, tc]); }
                    else {
                        if (getSide(board[tr][tc]) !== side) moves.push([tr, tc]);
                        break;
                    }
                }
            }
            break;

        case 2: {
            const horseMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
            const horseBlocks = [[-1,0],[-1,0],[0,-1],[0,1],[0,-1],[0,1],[1,0],[1,0]];
            for (let i = 0; i < 8; i++) {
                const tr = r + horseMoves[i][0], tc = c + horseMoves[i][1];
                const br = r + horseBlocks[i][0], bc = c + horseBlocks[i][1];
                if (isInBoard(tr, tc) && board[br][bc] === 0) addMove(tr, tc);
            }
            break;
        }

        case 3: {
            const elephantMoves = [[-2,-2],[-2,2],[2,-2],[2,2]];
            const elephantBlocks = [[-1,-1],[-1,1],[1,-1],[1,1]];
            for (let i = 0; i < 4; i++) {
                const tr = r + elephantMoves[i][0], tc = c + elephantMoves[i][1];
                const br = r + elephantBlocks[i][0], bc = c + elephantBlocks[i][1];
                if (isInBoard(tr, tc) && isOnSide(tr, side) && board[br][bc] === 0) addMove(tr, tc);
            }
            break;
        }

        case 4:
            for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
                const tr = r + dr, tc = c + dc;
                if (isInPalace(tr, tc, side)) addMove(tr, tc);
            }
            break;

        case 5:
            for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                const tr = r + dr, tc = c + dc;
                if (isInPalace(tr, tc, side)) addMove(tr, tc);
            }
            {
                const dir = side === 'red' ? -1 : 1;
                for (let i = r + dir; i >= 0 && i <= 9; i += dir) {
                    if (board[i][c] !== 0) {
                        if (Math.abs(board[i][c]) === 5) moves.push([i, c]);
                        break;
                    }
                }
            }
            break;

        case 6:
            for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                let jumped = false;
                for (let i = 1; i < 10; i++) {
                    const tr = r + dr * i, tc = c + dc * i;
                    if (!isInBoard(tr, tc)) break;
                    if (!jumped) {
                        if (board[tr][tc] === 0) moves.push([tr, tc]);
                        else jumped = true;
                    } else {
                        if (board[tr][tc] !== 0) {
                            if (getSide(board[tr][tc]) !== side) moves.push([tr, tc]);
                            break;
                        }
                    }
                }
            }
            break;

        case 7:
            if (side === 'red') {
                addMove(r - 1, c);
                if (r <= 4) { addMove(r, c - 1); addMove(r, c + 1); }
            } else {
                addMove(r + 1, c);
                if (r >= 5) { addMove(r, c - 1); addMove(r, c + 1); }
            }
            break;
    }
    return moves;
}

function findKing(board, side) {
    const king = side === 'red' ? 5 : -5;
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++)
            if (board[r][c] === king) return [r, c];
    return null;
}

function kingsAreFacing(board) {
    const redKing = findKing(board, 'red');
    const blackKing = findKing(board, 'black');
    if (!redKing || !blackKing) return false;
    if (redKing[1] !== blackKing[1]) return false;
    const minR = Math.min(redKing[0], blackKing[0]);
    const maxR = Math.max(redKing[0], blackKing[0]);
    for (let r = minR + 1; r < maxR; r++) {
        if (board[r][redKing[1]] !== 0) return false;
    }
    return true;
}

function isCheck(board, side) {
    const kingPos = findKing(board, side);
    if (!kingPos) return true;
    if (kingsAreFacing(board)) return true;
    const enemy = side === 'red' ? 'black' : 'red';
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] !== 0 && getSide(board[r][c]) === enemy) {
                const moves = getPseudoMoves(board, r, c);
                if (moves.some(m => m[0] === kingPos[0] && m[1] === kingPos[1])) return true;
            }
        }
    }
    return false;
}

function getLegalMoves(board, r, c) {
    const piece = board[r][c];
    if (piece === 0) return [];
    const side = getSide(piece);
    const pseudoMoves = getPseudoMoves(board, r, c);
    const legal = [];
    for (const [tr, tc] of pseudoMoves) {
        const newBoard = cloneBoard(board);
        newBoard[tr][tc] = newBoard[r][c];
        newBoard[r][c] = 0;
        if (!isCheck(newBoard, side)) legal.push([tr, tc]);
    }
    return legal;
}

function getAllLegalMoves(board, side) {
    const allMoves = [];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] !== 0 && getSide(board[r][c]) === side) {
                const moves = getLegalMoves(board, r, c);
                for (const [tr, tc] of moves) {
                    allMoves.push({ from: [r, c], to: [tr, tc] });
                }
            }
        }
    }
    return allMoves;
}

function makeMove(board, from, to) {
    const captured = board[to[0]][to[1]];
    board[to[0]][to[1]] = board[from[0]][from[1]];
    board[from[0]][from[1]] = 0;
    return captured;
}

function undoMove(board, from, to, captured) {
    board[from[0]][from[1]] = board[to[0]][to[1]];
    board[to[0]][to[1]] = captured;
}

// ===== AI 引擎 =====
const POS_VAL = {
    7: [
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [2,0,4,0,8,0,4,0,2],[6,12,18,18,20,18,18,12,6],
        [10,20,30,34,40,34,30,20,10],[14,26,42,60,80,60,42,26,14],
        [18,36,56,80,120,80,56,36,18],[0,3,6,9,12,9,6,3,0],[0,0,0,0,0,0,0,0,0]
    ],
    1: [
        [6,8,6,8,12,8,6,8,6],[6,12,10,12,12,12,10,12,6],
        [4,8,8,12,14,12,8,8,4],[8,12,12,14,16,14,12,12,8],
        [8,12,12,14,16,14,12,12,8],[8,12,12,14,16,14,12,12,8],
        [8,12,12,14,16,14,12,12,8],[8,12,12,14,16,14,12,12,8],
        [10,14,14,16,16,16,14,14,10],[6,10,8,14,14,14,8,10,6]
    ],
    2: [
        [4,2,4,4,0,4,4,2,4],[2,4,8,10,8,10,8,4,2],
        [4,4,6,12,12,12,6,4,4],[2,8,12,12,14,12,12,8,2],
        [4,8,12,14,16,14,12,8,4],[4,8,12,14,16,14,12,8,4],
        [2,8,12,12,14,12,12,8,2],[4,4,6,10,12,10,6,4,4],
        [2,4,6,8,8,8,6,4,2],[0,2,4,4,0,4,4,2,0]
    ],
    6: [
        [4,4,0,0,0,0,0,4,4],[4,4,0,4,8,4,0,4,4],
        [0,0,2,4,6,4,2,0,0],[0,0,0,0,2,0,0,0,0],
        [0,0,0,0,2,0,0,0,0],[0,0,0,0,2,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[2,0,4,2,6,2,4,0,2],
        [0,2,2,6,6,6,2,2,0],[0,0,2,6,6,6,2,0,0]
    ],
    3: [
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,2,0,0,0,2,0,0],
        [0,0,0,0,0,0,0,0,0],[2,0,0,0,4,0,0,0,2],
        [0,0,0,0,0,0,0,0,0],[0,0,2,0,0,0,2,0,0]
    ],
    4: [
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,2,0,2,0,0,0],
        [0,0,0,0,4,0,0,0,0],[0,0,0,2,0,2,0,0,0]
    ],
    5: [
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,2,2,2,0,0,0],
        [0,0,0,4,6,4,0,0,0],[0,0,0,2,8,2,0,0,0]
    ]
};

function getPositionValue(piece, r, c) {
    const absPiece = Math.abs(piece);
    const table = POS_VAL[absPiece];
    if (!table) return 0;
    if (piece > 0) return table[r][c];
    return table[9 - r][8 - c];
}

function evaluate(board) {
    let score = 0;
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const piece = board[r][c];
            if (piece === 0) continue;
            const absPiece = Math.abs(piece);
            const baseVal = PIECE_VALUES[absPiece] || 0;
            const posVal = getPositionValue(piece, r, c);
            if (piece > 0) score += baseVal + posVal;
            else score -= baseVal + posVal;
        }
    }
    return score;
}

function alphaBeta(board, depth, alpha, beta, maximizing) {
    if (depth === 0) return evaluate(board);
    const side = maximizing ? 'red' : 'black';
    const moves = getAllLegalMoves(board, side);
    if (moves.length === 0) {
        return maximizing ? -99999 : 99999;
    }
    moves.sort((a, b) => {
        const capA = Math.abs(board[a.to[0]][a.to[1]]);
        const capB = Math.abs(board[b.to[0]][b.to[1]]);
        return capB - capA;
    });
    if (maximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const captured = makeMove(board, move.from, move.to);
            const val = alphaBeta(board, depth - 1, alpha, beta, false);
            undoMove(board, move.from, move.to, captured);
            maxEval = Math.max(maxEval, val);
            alpha = Math.max(alpha, val);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const captured = makeMove(board, move.from, move.to);
            const val = alphaBeta(board, depth - 1, alpha, beta, true);
            undoMove(board, move.from, move.to, captured);
            minEval = Math.min(minEval, val);
            beta = Math.min(beta, val);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function findBestMove(board, side, depth) {
    const moves = getAllLegalMoves(board, side);
    if (moves.length === 0) return null;
    const maximizing = side === 'red';
    let bestMove = null;
    let bestVal = maximizing ? -Infinity : Infinity;
    moves.sort((a, b) => {
        const capA = Math.abs(board[a.to[0]][a.to[1]]);
        const capB = Math.abs(board[b.to[0]][b.to[1]]);
        return capB - capA;
    });
    for (const move of moves) {
        const captured = makeMove(board, move.from, move.to);
        const val = alphaBeta(board, depth - 1, -Infinity, Infinity, !maximizing);
        undoMove(board, move.from, move.to, captured);
        if (maximizing ? val > bestVal : val < bestVal) {
            bestVal = val;
            bestMove = move;
        }
    }
    return bestMove;
}

self.onmessage = function(e) {
    const { board, side, depth } = e.data;
    const move = findBestMove(board, side, depth || 4);
    self.postMessage({ move: move });
};
`;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.worker = new Worker(url);
        URL.revokeObjectURL(url);
    }

    // 返回 Promise，AI 思考完成后 resolve
    think(board, side, difficulty) {
        return new Promise((resolve) => {
            if (!this.worker) this.init();
            this.thinking = true;

            // 难度对应搜索深度
            const depthMap = { easy: 2, medium: 3, hard: 4 };
            const depth = depthMap[difficulty] || 3;

            // 超时保护：10秒未返回则终止 Worker 并返回 null
            const timeout = setTimeout(() => {
                this.thinking = false;
                this.worker.terminate();
                this.worker = null;
                resolve(null);
            }, 10000);

            this.worker.onmessage = (e) => {
                clearTimeout(timeout);
                this.thinking = false;
                resolve(e.data.move);
            };

            this.worker.onerror = () => {
                clearTimeout(timeout);
                this.thinking = false;
                resolve(null);
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
