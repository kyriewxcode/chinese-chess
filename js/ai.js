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

// ===== 增强版 AI 引擎 =====

// Zobrist 哈希表（用于置换表）
const ZOBRIST = {};
const ZOBRIST_SIDE = Math.floor(Math.random() * 2147483647);
for (let p = -7; p <= 7; p++) {
    if (p === 0) continue;
    ZOBRIST[p] = [];
    for (let r = 0; r < 10; r++) {
        ZOBRIST[p][r] = [];
        for (let c = 0; c < 9; c++) {
            ZOBRIST[p][r][c] = Math.floor(Math.random() * 2147483647);
        }
    }
}

function computeHash(board) {
    let h = 0;
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++)
            if (board[r][c] !== 0) h ^= ZOBRIST[board[r][c]][r][c];
    return h;
}

// 置换表
const TT_SIZE = 1 << 20; // ~100万条目
const TT_MASK = TT_SIZE - 1;
const TT_EXACT = 0, TT_ALPHA = 1, TT_BETA = 2;
const ttTable = new Array(TT_SIZE);

function ttProbe(hash, depth, alpha, beta) {
    const entry = ttTable[hash & TT_MASK];
    if (!entry || entry.hash !== hash || entry.depth < depth) return null;
    if (entry.flag === TT_EXACT) return entry.score;
    if (entry.flag === TT_ALPHA && entry.score <= alpha) return alpha;
    if (entry.flag === TT_BETA && entry.score >= beta) return beta;
    return null;
}

function ttStore(hash, depth, score, flag, bestMove) {
    const idx = hash & TT_MASK;
    const entry = ttTable[idx];
    if (!entry || entry.depth <= depth) {
        ttTable[idx] = { hash, depth, score, flag, bestMove };
    }
}

function ttGetBestMove(hash) {
    const entry = ttTable[hash & TT_MASK];
    if (entry && entry.hash === hash && entry.bestMove) return entry.bestMove;
    return null;
}

// 杀手走法表
const killerMoves = [];
for (let i = 0; i < 30; i++) killerMoves[i] = [null, null];

// 历史启发表
const historyTable = {};
function historyKey(from, to) {
    return (from[0] * 9 + from[1]) * 90 + to[0] * 9 + to[1];
}

function historyScore(from, to) {
    return historyTable[historyKey(from, to)] || 0;
}

function historyUpdate(from, to, depth) {
    const key = historyKey(from, to);
    historyTable[key] = (historyTable[key] || 0) + depth * depth;
}

// 位置价值表（完善版）
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

function getPositionValue(piece, r, c) {
    const absPiece = Math.abs(piece);
    const table = POS_VAL[absPiece];
    if (!table) return 0;
    if (piece > 0) return table[r][c];
    return table[9 - r][8 - c];
}

// 增强评估函数
function evaluate(board) {
    let score = 0;
    let redMobility = 0, blackMobility = 0;
    let redAttackNearKing = 0, blackAttackNearKing = 0;

    const redKing = findKing(board, 'red');
    const blackKing = findKing(board, 'black');

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const piece = board[r][c];
            if (piece === 0) continue;
            const absPiece = Math.abs(piece);
            const baseVal = PIECE_VALUES[absPiece] || 0;
            const posVal = getPositionValue(piece, r, c);

            if (piece > 0) {
                score += baseVal + posVal;
                // 机动性：可走步数加分
                const moves = getPseudoMoves(board, r, c);
                redMobility += moves.length;
                // 攻击对方将附近加分
                if (blackKing) {
                    for (const m of moves) {
                        if (Math.abs(m[0] - blackKing[0]) <= 1 && Math.abs(m[1] - blackKing[1]) <= 1) {
                            redAttackNearKing++;
                        }
                    }
                }
            } else {
                score -= baseVal + posVal;
                const moves = getPseudoMoves(board, r, c);
                blackMobility += moves.length;
                if (redKing) {
                    for (const m of moves) {
                        if (Math.abs(m[0] - redKing[0]) <= 1 && Math.abs(m[1] - redKing[1]) <= 1) {
                            blackAttackNearKing++;
                        }
                    }
                }
            }
        }
    }

    // 机动性奖励（每步 3 分）
    score += (redMobility - blackMobility) * 3;
    // 攻击王附近奖励（每个 15 分）
    score += (redAttackNearKing - blackAttackNearKing) * 15;

    return score;
}

// MVV-LVA 走法排序分数
function moveScore(board, move, ply, ttBestMove) {
    // 置换表最佳走法最优先
    if (ttBestMove &&
        move.from[0] === ttBestMove.from[0] && move.from[1] === ttBestMove.from[1] &&
        move.to[0] === ttBestMove.to[0] && move.to[1] === ttBestMove.to[1]) {
        return 1000000;
    }

    const captured = board[move.to[0]][move.to[1]];
    if (captured !== 0) {
        // MVV-LVA: 被吃子价值 * 10 - 攻击子价值
        const victim = PIECE_VALUES[Math.abs(captured)] || 0;
        const attacker = PIECE_VALUES[Math.abs(board[move.from[0]][move.from[1]])] || 0;
        return 100000 + victim * 10 - attacker;
    }

    // 杀手走法
    if (ply < 30) {
        for (let k = 0; k < 2; k++) {
            const km = killerMoves[ply][k];
            if (km &&
                move.from[0] === km.from[0] && move.from[1] === km.from[1] &&
                move.to[0] === km.to[0] && move.to[1] === km.to[1]) {
                return 90000 - k;
            }
        }
    }

    // 历史启发
    return historyScore(move.from, move.to);
}

function sortMoves(board, moves, ply, ttBestMove) {
    for (const m of moves) {
        m._score = moveScore(board, m, ply, ttBestMove);
    }
    moves.sort((a, b) => b._score - a._score);
}

// 静态搜索（Quiescence Search）- 只搜索吃子走法
function quiescence(board, alpha, beta, maximizing) {
    const standPat = evaluate(board);
    if (maximizing) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;
    } else {
        if (standPat <= alpha) return alpha;
        if (standPat < beta) beta = standPat;
    }

    const side = maximizing ? 'red' : 'black';
    const moves = getAllLegalMoves(board, side);

    // 只搜索吃子走法
    const captures = moves.filter(m => board[m.to[0]][m.to[1]] !== 0);
    // MVV-LVA 排序
    captures.sort((a, b) => {
        const va = PIECE_VALUES[Math.abs(board[a.to[0]][a.to[1]])] || 0;
        const vb = PIECE_VALUES[Math.abs(board[b.to[0]][b.to[1]])] || 0;
        return vb - va;
    });

    if (maximizing) {
        for (const move of captures) {
            const captured = makeMove(board, move.from, move.to);
            const val = quiescence(board, alpha, beta, false);
            undoMove(board, move.from, move.to, captured);
            if (val > alpha) alpha = val;
            if (alpha >= beta) break;
        }
        return alpha;
    } else {
        for (const move of captures) {
            const captured = makeMove(board, move.from, move.to);
            const val = quiescence(board, alpha, beta, true);
            undoMove(board, move.from, move.to, captured);
            if (val < beta) beta = val;
            if (alpha >= beta) break;
        }
        return beta;
    }
}

// 主搜索：Alpha-Beta + 置换表 + 空着裁剪 + 静态搜索
let searchAborted = false;
let nodeCount = 0;

function alphaBeta(board, depth, alpha, beta, maximizing, ply, hash, nullAllowed) {
    if (searchAborted) return 0;
    nodeCount++;

    // 置换表查询
    const ttVal = ttProbe(hash, depth, alpha, beta);
    if (ttVal !== null) return ttVal;

    // 叶节点 -> 静态搜索
    if (depth <= 0) return quiescence(board, alpha, beta, maximizing);

    const side = maximizing ? 'red' : 'black';
    const inCheck = isCheck(board, side);

    // 空着裁剪（不在被将军时使用）
    if (nullAllowed && depth >= 3 && !inCheck) {
        const R = 2; // 裁剪深度
        const nullHash = hash ^ ZOBRIST_SIDE;
        const nullVal = alphaBeta(board, depth - 1 - R, -beta, -beta + 1, !maximizing, ply + 1, nullHash, false);
        const adjustedNull = maximizing ? nullVal : -nullVal;
        if (maximizing ? adjustedNull >= beta : adjustedNull <= alpha) {
            return maximizing ? beta : alpha;
        }
    }

    const moves = getAllLegalMoves(board, side);
    if (moves.length === 0) {
        return maximizing ? -99999 + ply : 99999 - ply;
    }

    // 将军延伸
    const extension = inCheck ? 1 : 0;

    const ttBestMove = ttGetBestMove(hash);
    sortMoves(board, moves, ply, ttBestMove);

    let bestMove = moves[0];
    let flag = TT_ALPHA;

    if (maximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const captured = makeMove(board, move.from, move.to);
            let newHash = hash;
            newHash ^= ZOBRIST[board[move.to[0]][move.to[1]]][move.to[0]][move.to[1]];
            if (captured !== 0) newHash ^= ZOBRIST[captured][move.to[0]][move.to[1]];
            newHash ^= ZOBRIST[board[move.to[0]][move.to[1]]][move.from[0]][move.from[1]];
            newHash ^= ZOBRIST_SIDE;

            const val = alphaBeta(board, depth - 1 + extension, alpha, beta, false, ply + 1, newHash, true);
            undoMove(board, move.from, move.to, captured);
            if (searchAborted) return 0;

            if (val > maxEval) {
                maxEval = val;
                bestMove = move;
            }
            if (val > alpha) {
                alpha = val;
                flag = TT_EXACT;
            }
            if (beta <= alpha) {
                flag = TT_BETA;
                // 更新杀手走法和历史启发
                if (captured === 0 && ply < 30) {
                    killerMoves[ply][1] = killerMoves[ply][0];
                    killerMoves[ply][0] = move;
                }
                historyUpdate(move.from, move.to, depth);
                break;
            }
        }
        ttStore(hash, depth, maxEval, flag, bestMove);
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const captured = makeMove(board, move.from, move.to);
            let newHash = hash;
            newHash ^= ZOBRIST[board[move.to[0]][move.to[1]]][move.to[0]][move.to[1]];
            if (captured !== 0) newHash ^= ZOBRIST[captured][move.to[0]][move.to[1]];
            newHash ^= ZOBRIST[board[move.to[0]][move.to[1]]][move.from[0]][move.from[1]];
            newHash ^= ZOBRIST_SIDE;

            const val = alphaBeta(board, depth - 1 + extension, alpha, beta, true, ply + 1, newHash, true);
            undoMove(board, move.from, move.to, captured);
            if (searchAborted) return 0;

            if (val < minEval) {
                minEval = val;
                bestMove = move;
            }
            if (val < beta) {
                beta = val;
                flag = TT_EXACT;
            }
            if (beta <= alpha) {
                flag = TT_BETA;
                if (captured === 0 && ply < 30) {
                    killerMoves[ply][1] = killerMoves[ply][0];
                    killerMoves[ply][0] = move;
                }
                historyUpdate(move.from, move.to, depth);
                break;
            }
        }
        ttStore(hash, depth, minEval, flag, bestMove);
        return minEval;
    }
}

// 迭代加深搜索
function findBestMove(board, side, maxDepth, timeLimit) {
    const startTime = Date.now();
    const maximizing = side === 'red';
    const hash = computeHash(board);
    searchAborted = false;
    nodeCount = 0;

    let bestMove = null;
    let bestVal = maximizing ? -Infinity : Infinity;

    // 迭代加深：从 1 层开始逐步加深
    for (let depth = 1; depth <= maxDepth; depth++) {
        const moves = getAllLegalMoves(board, side);
        if (moves.length === 0) return null;

        const ttBestMove = ttGetBestMove(hash);
        sortMoves(board, moves, 0, ttBestMove);

        let depthBestMove = moves[0];
        let depthBestVal = maximizing ? -Infinity : Infinity;

        for (const move of moves) {
            const captured = makeMove(board, move.from, move.to);
            let newHash = hash;
            newHash ^= ZOBRIST[board[move.to[0]][move.to[1]]][move.to[0]][move.to[1]];
            if (captured !== 0) newHash ^= ZOBRIST[captured][move.to[0]][move.to[1]];
            newHash ^= ZOBRIST[board[move.to[0]][move.to[1]]][move.from[0]][move.from[1]];
            newHash ^= ZOBRIST_SIDE;

            const val = alphaBeta(board, depth - 1, -Infinity, Infinity, !maximizing, 1, newHash, true);
            undoMove(board, move.from, move.to, captured);

            if (searchAborted) break;

            if (maximizing ? val > depthBestVal : val < depthBestVal) {
                depthBestVal = val;
                depthBestMove = move;
            }

            // 时间检查
            if (Date.now() - startTime > timeLimit) {
                searchAborted = true;
                break;
            }
        }

        if (!searchAborted) {
            bestMove = depthBestMove;
            bestVal = depthBestVal;
        }

        // 时间超限则停止加深
        if (Date.now() - startTime > timeLimit * 0.6) break;
        // 已找到杀棋则停止
        if (Math.abs(bestVal) > 90000) break;
    }

    return bestMove;
}

// Worker 消息处理
self.onmessage = function(e) {
    const { board, side, depth, timeLimit } = e.data;
    const move = findBestMove(board, side, depth || 6, timeLimit || 8000);
    self.postMessage({ move: move });
};
`;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.worker = new Worker(url);
        URL.revokeObjectURL(url);
    }

    // 本地 AI 思考
    think(board, side, difficulty) {
        return new Promise((resolve) => {
            if (!this.worker) this.init();
            this.thinking = true;

            // 难度对应搜索深度和时间限制
            const config = {
                easy:   { depth: 3, timeLimit: 2000 },
                medium: { depth: 5, timeLimit: 5000 },
                hard:   { depth: 8, timeLimit: 8000 }
            };
            const { depth, timeLimit } = config[difficulty] || config.medium;

            // 超时保护
            const timeout = setTimeout(() => {
                this.thinking = false;
                this.worker.terminate();
                this.worker = null;
                resolve(null);
            }, timeLimit + 5000);

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
                depth: depth,
                timeLimit: timeLimit
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

// ==================== Claude 大模型 AI ====================

class ClaudeChessAI {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = (baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
        this.thinking = false;
        this.moveHistory = [];
    }

    boardToText(board) {
        const NAMES = {
            1: '车', 2: '马', 3: '相', 4: '仕', 5: '帅', 6: '炮', 7: '兵',
            '-1': '車', '-2': '馬', '-3': '象', '-4': '士', '-5': '将', '-6': '砲', '-7': '卒'
        };
        const colLabels = 'ABCDEFGHI';
        let text = '    A   B   C   D   E   F   G   H   I\n';
        text += '  +---+---+---+---+---+---+---+---+---+\n';
        for (let r = 0; r < 10; r++) {
            text += r + ' |';
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === 0) text += '   |';
                else text += (p > 0 ? 'r' : 'b') + NAMES[p] + '|';
            }
            text += '\n  +---+---+---+---+---+---+---+---+---+\n';
        }
        return text;
    }

    formatMoveHistory() {
        if (this.moveHistory.length === 0) return '无';
        return this.moveHistory.map((m, i) => {
            const side = i % 2 === 0 ? '红' : '黑';
            return `${Math.floor(i/2)+1}.${side}: (${m.from[0]},${m.from[1]})->(${m.to[0]},${m.to[1]})`;
        }).join(', ');
    }

    async think(board, side, difficulty) {
        if (!this.apiKey) return null;
        this.thinking = true;

        const boardText = this.boardToText(board);
        const sideText = side === 'red' ? '红方' : '黑方';
        const legalMoves = getAllLegalMoves(board, side);

        const movesText = legalMoves.map(m =>
            `(${m.from[0]},${m.from[1]})->(${m.to[0]},${m.to[1]})`
        ).join('; ');

        const prompt = `你是一个中国象棋大师。请分析当前棋局并选择最佳走法。

棋盘坐标系：行0-9（上到下），列0-8（左到右）
棋盘上方（行0-2）是黑方阵地，下方（行7-9）是红方阵地。
r前缀=红方棋子，b前缀=黑方棋子。

当前棋盘:
${boardText}

走棋历史: ${this.formatMoveHistory()}

你执${sideText}。

所有合法走法:
${movesText}

请从以上合法走法中选择最佳的一步。考虑：
1. 子力价值和交换
2. 棋子活跃度和控制力
3. 将帅安全
4. 攻守平衡
5. 战术组合（如抽将、捉双、牵制等）

请只回复一个JSON对象，格式如下，不要任何其他文字：
{"from":[行,列],"to":[行,列],"reason":"简短理由"}`;

        try {
            const isAnthropic = this.baseUrl.includes('anthropic.com');
            let response;

            if (isAnthropic) {
                // Anthropic 原生 API
                response = await fetch(this.baseUrl + '/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 300,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });
            } else {
                // OpenAI 兼容格式（中转站、OpenRouter 等）
                const url = this.baseUrl + '/v1/chat/completions';
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + this.apiKey
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 300,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });
            }

            if (!response.ok) {
                console.error('API error:', response.status, await response.text());
                this.thinking = false;
                return null;
            }

            const data = await response.json();

            // 兼容两种返回格式
            let text;
            if (data.content && data.content[0]) {
                // Anthropic 格式
                text = data.content[0].text.trim();
            } else if (data.choices && data.choices[0]) {
                // OpenAI 格式
                text = data.choices[0].message.content.trim();
            } else {
                console.error('未知的返回格式:', data);
                this.thinking = false;
                return null;
            }

            // 提取 JSON
            const jsonMatch = text.match(/\{[\s\S]*?\}/);
            if (!jsonMatch) {
                console.error('Claude 返回格式错误:', text);
                this.thinking = false;
                return null;
            }

            const move = JSON.parse(jsonMatch[0]);
            // 验证走法合法性
            const isLegal = legalMoves.some(m =>
                m.from[0] === move.from[0] && m.from[1] === move.from[1] &&
                m.to[0] === move.to[0] && m.to[1] === move.to[1]
            );

            this.thinking = false;
            if (isLegal) {
                return { from: move.from, to: move.to, reason: move.reason };
            } else {
                console.error('Claude 返回了非法走法:', move);
                return null;
            }
        } catch (e) {
            console.error('Claude API 调用失败:', e);
            this.thinking = false;
            return null;
        }
    }

    recordMove(from, to) {
        this.moveHistory.push({ from, to });
    }

    destroy() {
        this.moveHistory = [];
    }
}
