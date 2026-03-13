# Task: 中国象棋游戏开发

## Objective
开发一个中国象棋游戏，支持本地对弈、局域网联机对战、AI 对战三种模式。

## 技术选型（待确认）
- 建议使用 Web 技术栈（HTML5 Canvas + WebSocket），方便局域网内跨平台使用
- 前端：HTML5 + Canvas/SVG 棋盘渲染
- 后端：Node.js/Python WebSocket 服务器（局域网联机）
- AI：基于 Minimax + Alpha-Beta 剪枝算法

## Steps

- [ ] 1. 架构设计 — 咨询 Atlas 确定整体架构和技术方案
  - Details: 确定技术栈、模块划分、通信协议
  - Output: 架构设计文档

- [ ] 2. 棋盘与棋子渲染模块
  - Details: 实现 9x10 棋盘绘制、32 颗棋子渲染、棋子拖拽/点选移动
  - Output: 前端棋盘 UI 代码
  - Depends on: Step 1

- [ ] 3. 棋规逻辑引擎
  - Details: 实现所有棋子走法规则、将军/绝杀判定、禁手规则（蹩马腿、塞象眼等）
  - Output: 棋规逻辑模块
  - Depends on: Step 1

- [ ] 4. AI 对战引擎
  - Details: 实现 Minimax + Alpha-Beta 剪枝、棋局评估函数、难度分级
  - Output: AI 引擎模块
  - Depends on: Step 3

- [ ] 5. 局域网联机模块
  - Details: WebSocket 服务器、房间创建/加入、棋步同步、断线重连
  - Output: 联机服务端和客户端代码
  - Depends on: Step 3

- [ ] 6. 游戏主界面与模式选择
  - Details: 主菜单、模式选择（本地/联机/AI）、设置页面
  - Output: 完整 UI 界面
  - Depends on: Step 2

- [ ] 7. 集成与测试
  - Details: 模块集成、功能测试、AI 强度测试、联机稳定性测试
  - Output: 测试报告
  - Depends on: Steps 4, 5, 6

- [ ] 8. 打包与部署说明
  - Details: 编写使用说明、启动脚本、部署文档
  - Output: 完整可运行项目 + 文档

## Status
- Created: 2026-03-13
- Current Step: Step 1 — 架构设计
- Progress: 0/8

## Notes
- 需要确认 Kyrie 偏好的平台（Web/桌面/移动端）
- AI 难度可分为初级、中级、高级三档
- 局域网联机基于同一网段内的 WebSocket 通信
