// ==================== 中国象棋棋规引擎 ====================

// 棋子编码: 正数=红方, 负数=黑方
// 1=车 2=马 3=相/象 4=仕/士 5=帅/将 6=炮 7=兵/卒
const PIECE_NAMES_RED = { 1: '車', 2: '馬', 3: '相', 4: '仕', 5: '帥', 6: '炮', 7: '兵' };
const PIECE_NAMES_BLACK = { 1: '車', 2: '馬', 3: '象', 4: '士', 5: '將', 6: '砲', 7: '卒' };

const PIECE_VALUES = { 1: 600, 2: 270, 3: 120, 4: 120, 5: 10000, 6: 285, 7: 30 };

// 棋子位置价值表（红方视角，黑方镜像）
const POSITION_VALUES = {
    // 兵/卒
    7: [
        [0,  0,  0,  0,  0,  0,  0,  0,  0],
        [0,  0,  0,  0,  0,  0,  0,  0,  0],
        [0,  0,  0,  0,  0,  0,  0,  0,  0],
        [2,  0,  4,  0,  8,  0,  4,  0,  2],
        [6,  12, 18, 18, 20, 18, 18, 12, 6],
        [10, 20, 30, 34, 40, 34, 30, 20, 10],
        [14, 26, 42, 60, 80, 60, 42, 26, 14],
        [18, 36, 56, 80, 120,80, 56, 36, 18],
        [0,  3,  6,  9,  12, 9,  6,  3,  0],
        [0,  0,  0,  0,  0,  0,  0,  0,  0]
    ],
    // 车
    1: [
        [6,  8,  6,  8,  12, 8,  6,  8,  6],
        [6,  12, 10, 12, 12, 12, 10, 12, 6],
        [4,  8,  8,  12, 14, 12, 8,  8,  4],
        [8,  12, 12, 14, 16, 14, 12, 12, 8],
        [8,  12, 12, 14, 16, 14, 12, 12, 8],
        [8,  12, 12, 14, 16, 14, 12, 12, 8],
        [8,  12, 12, 14, 16, 14, 12, 12, 8],
        [8,  12, 12, 14, 16, 14, 12, 12, 8],
        [10, 14, 14, 16, 16, 16, 14, 14, 10],
        [6,  10, 8,  14, 14, 14, 8,  10, 6]
    ]
};

function createInitialBoard() {
    return [
        [-1, -2, -3, -4, -5, -4, -3, -2, -1],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
        [ 0, -6,  0,  0,  0,  0,  0, -6,  0],
        [-7,  0, -7,  0, -7,  0, -7,  0, -7],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
        [ 7,  0,  7,  0,  7,  0,  7,  0,  7],
        [ 0,  6,  0,  0,  0,  0,  0,  6,  0],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
        [ 1,  2,  3,  4,  5,  4,  3,  2,  1]
    ];
}

function cloneBoard(board) {
    return board.map(row => [...row]);
}

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

// 获取某个棋子的所有伪合法走法（不考虑被将军）
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
        case 1: // 車 — 直线
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

        case 2: // 馬 — 日字，蹩马腿
            const horseMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
            const horseBlocks = [[-1,0],[-1,0],[0,-1],[0,1],[0,-1],[0,1],[1,0],[1,0]];
            for (let i = 0; i < 8; i++) {
                const tr = r + horseMoves[i][0], tc = c + horseMoves[i][1];
                const br = r + horseBlocks[i][0], bc = c + horseBlocks[i][1];
                if (isInBoard(tr, tc) && board[br][bc] === 0) addMove(tr, tc);
            }
            break;

        case 3: // 相/象 — 田字，塞象眼，不过河
            const elephantMoves = [[-2,-2],[-2,2],[2,-2],[2,2]];
            const elephantBlocks = [[-1,-1],[-1,1],[1,-1],[1,1]];
            for (let i = 0; i < 4; i++) {
                const tr = r + elephantMoves[i][0], tc = c + elephantMoves[i][1];
                const br = r + elephantBlocks[i][0], bc = c + elephantBlocks[i][1];
                if (isInBoard(tr, tc) && isOnSide(tr, side) && board[br][bc] === 0) addMove(tr, tc);
            }
            break;

        case 4: // 仕/士 — 九宫斜线
            for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
                const tr = r + dr, tc = c + dc;
                if (isInPalace(tr, tc, side)) addMove(tr, tc);
            }
            break;

        case 5: // 帅/将 — 九宫直线 + 飞将
            for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                const tr = r + dr, tc = c + dc;
                if (isInPalace(tr, tc, side)) addMove(tr, tc);
            }
            // 飞将
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

        case 6: // 炮 — 直线，隔一个吃
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

        case 7: // 兵/卒
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

function isCheck(board, side) {
    const kingPos = findKing(board, side);
    if (!kingPos) return true;
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

function isCheckmate(board, side) {
    return getAllLegalMoves(board, side).length === 0;
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

function getPieceName(piece) {
    if (piece > 0) return PIECE_NAMES_RED[piece];
    if (piece < 0) return PIECE_NAMES_BLACK[Math.abs(piece)];
    return '';
}
