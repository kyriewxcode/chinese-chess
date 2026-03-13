// ==================== AI 引擎 (Web Worker) ====================
// 在 Web Worker 中运行，不阻塞主线程

importScripts('rules.js');

// 棋子位置价值表（简化版，红方视角）
const POS_VAL = {
    7: [ // 兵
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [2,0,4,0,8,0,4,0,2],[6,12,18,18,20,18,18,12,6],
        [10,20,30,34,40,34,30,20,10],[14,26,42,60,80,60,42,26,14],
        [18,36,56,80,120,80,56,36,18],[0,3,6,9,12,9,6,3,0],[0,0,0,0,0,0,0,0,0]
    ],
    1: [ // 车
        [6,8,6,8,12,8,6,8,6],[6,12,10,12,12,12,10,12,6],
        [4,8,8,12,14,12,8,8,4],[8,12,12,14,16,14,12,12,8],
        [8,12,12,14,16,14,12,12,8],[8,12,12,14,16,14,12,12,8],
        [8,12,12,14,16,14,12,12,8],[8,12,12,14,16,14,12,12,8],
        [10,14,14,16,16,16,14,14,10],[6,10,8,14,14,14,8,10,6]
    ],
    2: [ // 马
        [4,2,4,4,0,4,4,2,4],[2,4,8,10,8,10,8,4,2],
        [4,4,6,12,12,12,6,4,4],[2,8,12,12,14,12,12,8,2],
        [4,8,12,14,16,14,12,8,4],[4,8,12,14,16,14,12,8,4],
        [2,8,12,12,14,12,12,8,2],[4,4,6,10,12,10,6,4,4],
        [2,4,6,8,8,8,6,4,2],[0,2,4,4,0,4,4,2,0]
    ],
    6: [ // 炮
        [4,4,0,0,0,0,0,4,4],[4,4,0,4,8,4,0,4,4],
        [0,0,2,4,6,4,2,0,0],[0,0,0,0,2,0,0,0,0],
        [0,0,0,0,2,0,0,0,0],[0,0,0,0,2,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[2,0,4,2,6,2,4,0,2],
        [0,2,2,6,6,6,2,2,0],[0,0,2,6,6,6,2,0,0]
    ],
    3: [ // 相
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,2,0,0,0,2,0,0],
        [0,0,0,0,0,0,0,0,0],[2,0,0,0,4,0,0,0,2],
        [0,0,0,0,0,0,0,0,0],[0,0,2,0,0,0,2,0,0]
    ],
    4: [ // 仕
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,2,0,2,0,0,0],
        [0,0,0,0,4,0,0,0,0],[0,0,0,2,0,2,0,0,0]
    ],
    5: [ // 帅
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0],[0,0,0,2,2,2,0,0,0],
        [0,0,0,4,6,4,0,0,0],[0,0,0,2,8,2,0,0,0]
    ]
};

// 获取位置价值
function getPositionValue(piece, r, c) {
    const absPiece = Math.abs(piece);
    const table = POS_VAL[absPiece];
    if (!table) return 0;
    if (piece > 0) return table[r][c];
    return table[9 - r][8 - c]; // 黑方镜像
}

// 评估函数：正值有利于红方，负值有利于黑方
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

// Alpha-Beta 剪枝搜索
function alphaBeta(board, depth, alpha, beta, maximizing) {
    if (depth === 0) return evaluate(board);

    const side = maximizing ? 'red' : 'black';
    const moves = getAllLegalMoves(board, side);

    if (moves.length === 0) {
        return maximizing ? -99999 : 99999;
    }

    // 走法排序：吃子优先
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

// AI 选择最佳走法
function findBestMove(board, side, depth) {
    const moves = getAllLegalMoves(board, side);
    if (moves.length === 0) return null;

    const maximizing = side === 'red';
    let bestMove = null;
    let bestVal = maximizing ? -Infinity : Infinity;

    // 走法排序
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

// Worker 消息处理
self.onmessage = function(e) {
    const { board, side, depth } = e.data;
    const move = findBestMove(board, side, depth || 4);
    self.postMessage({ move: move });
};
