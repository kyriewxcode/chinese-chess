# 🏯 中国象棋

支持本地对弈、AI 对战、局域网联机的中国象棋游戏。

## ✨ 功能特性

- **本地对弈** — 同一设备两人轮流下棋
- **AI 对战** — 三档难度（初级/中级/高级），基于 Alpha-Beta 剪枝算法
- **局域网联机** — 同一局域网内两台设备对战
- **完整棋规** — 蹩马腿、塞象眼、将军、绝杀、飞将等
- **悔棋功能** — 本地和 AI 模式支持悔棋
- **走法提示** — 点击棋子显示合法走法

## 🚀 快速开始

### 本地对弈 / AI 对战

直接用浏览器打开 `index.html` 即可，无需任何服务器。

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

### 局域网联机

**第一步：启动服务器**

```bash
cd server
npm install       # 首次运行需要安装依赖
npm start         # 启动服务器（默认端口 3000）
```

**第二步：获取本机 IP**

```bash
# macOS / Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

**第三步：连接游戏**

1. 两台设备都用浏览器打开 `index.html`
2. 点击「局域网联机」
3. 输入服务器 IP 和端口
4. 一人点「创建房间」，获得 4 位房间号
5. 另一人输入房间号，点「加入房间」
6. 双方自动匹配，开始对战！

## 🎮 操作说明

- **选子**：点击自己的棋子，绿色圆点显示可走位置
- **走棋**：点击绿色圆点位置完成走棋
- **切换**：点击其他自己的棋子切换选中
- **悔棋**：点击「悔棋」按钮（AI 模式会撤销两步）

## 🤖 AI 难度说明

| 难度 | 搜索深度 | 说明 |
|------|---------|------|
| 初级 | 2 层 | 适合新手，AI 只看一步 |
| 中级 | 3 层 | 有一定挑战，会简单算计 |
| 高级 | 4 层 | 较强，会深入计算 |

## 📁 项目结构

```
chinese-chess/
├── index.html              # 主页面
├── css/
│   └── style.css           # 样式
├── js/
│   ├── main.js             # 游戏主控制器
│   ├── board.js            # 棋盘渲染（Canvas）
│   ├── rules.js            # 棋规逻辑引擎
│   ├── ai.js               # AI 接口封装
│   ├── ai-worker.js        # AI 引擎（Web Worker）
│   └── network.js          # 联机模块
├── server/
│   ├── server.js           # WebSocket 联机服务器
│   └── package.json        # Node.js 依赖
└── README.md               # 本文件
```

## 🛠 技术栈

- **前端**: HTML5 Canvas + 原生 JavaScript（零依赖）
- **后端**: Node.js + ws（WebSocket）
- **AI**: Minimax + Alpha-Beta 剪枝 + 位置评估

---
Made with ♟ by Kyrie
