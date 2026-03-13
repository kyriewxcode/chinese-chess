# 中国象棋 — 架构设计文档

## 1. 技术栈
- **前端**: HTML5 + Canvas + 原生 JavaScript（零依赖，打开即玩）
- **后端**: Node.js + ws（WebSocket 库，用于局域网联机）
- **AI**: Minimax + Alpha-Beta 剪枝，运行在 Web Worker 中（不阻塞 UI）

## 2. 目录结构
```
chinese-chess/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式
├── js/
│   ├── main.js         # 主入口，游戏控制器
│   ├── board.js        # 棋盘渲染（Canvas）
│   ├── rules.js        # 棋规逻辑引擎
│   ├── ai.js           # AI 引擎（Web Worker）
│   ├── ai-worker.js    # AI Worker 线程
│   ├── network.js      # 联机模块（WebSocket 客户端）
│   └── utils.js        # 工具函数
├── server/
│   ├── server.js       # WebSocket 联机服务器
│   └── package.json    # Node.js 依赖
├── assets/
│   └── (棋子图片/音效，可选，也可用 Canvas 绘制)
└── README.md           # 使用说明
```

## 3. 核心模块设计

### 3.1 棋盘数据模型
- 9×10 二维数组，0=空，正数=红方，负数=黑方
- 棋子编码：车1 马2 相/象3 仕/士4 帅/将5 炮6 兵/卒7

### 3.2 棋规引擎 (rules.js)
- `getLegalMoves(board, piece)` — 获取合法走法
- `isCheck(board, side)` — 是否将军
- `isCheckmate(board, side)` — 是否绝杀
- `makeMove(board, from, to)` — 执行走棋
- `undoMove(board, move)` — 悔棋

### 3.3 AI 引擎
- Minimax + Alpha-Beta 剪枝
- 评估函数：子力价值 + 位置价值 + 机动性
- 难度分级：搜索深度 2/4/6
- 运行在 Web Worker，不阻塞主线程

### 3.4 联机协议（WebSocket JSON）
```json
// 创建房间
{"type": "create_room"}
{"type": "room_created", "roomId": "XXXX"}

// 加入房间
{"type": "join_room", "roomId": "XXXX"}
{"type": "game_start", "side": "red|black"}

// 走棋
{"type": "move", "from": [x,y], "to": [x,y]}

// 游戏结束
{"type": "game_over", "winner": "red|black"}
```

## 4. 游戏模式
1. **本地对弈** — 同一浏览器，红黑轮流操作
2. **AI 对战** — 玩家选红/黑，AI 自动应答
3. **局域网联机** — 启动 server.js，两台设备通过 IP 连接
