# Holsder Geier Server

一个基于 Node.js + TypeScript 的实时多人游戏服务器(獴鹫派对)，支持 WebSocket 通信和 HTTP API，集成了 KOOK Bot 功能和腾讯云 COS 文件存储服务。

## 项目结构

```
holsder-geier-server/
├── src/
│   ├── core/                  # 核心业务逻辑
│   │   ├── game/             # 游戏引擎
│   │   │   └── gameEngine.ts
│   │   └── room/             # 房间管理
│   │       ├── playerState.ts
│   │       └── roomManager.ts
│   ├── http/                 # HTTP 服务
│   │   ├── axios/            # Axios 客户端封装
│   │   │   └── index.ts
│   │   ├── cos/              # 腾讯云 COS 集成
│   │   │   ├── config.ts
│   │   │   └── index.ts
│   │   ├── middleware/       # 中间件
│   │   │   ├── auth.ts       # 认证中间件
│   │   │   └── errorHandler.ts
│   │   ├── routes/           # 路由
│   │   │   ├── file.ts       # 文件上传路由
│   │   │   └── kook.ts       # KOOK API 路由
│   │   ├── utils/            # HTTP 工具函数
│   │   │   └── response.ts
│   │   └── app.ts            # Express 应用配置
│   ├── types/ws/             # WebSocket 类型定义
│   │   ├── chat.ts           # 聊天相关类型
│   │   ├── errorCode.ts      # 错误码定义
│   │   ├── game.ts           # 游戏相关类型
│   │   ├── message.ts        # 消息类型映射
│   │   ├── room.ts           # 房间相关类型
│   │   ├── server.ts         # 服务器相关类型
│   │   └── user.ts           # 用户相关类型
│   ├── utils/                # 通用工具
│   │   └── logger.ts         # 日志系统
│   ├── ws/                   # WebSocket 服务
│   │   ├── handlers/         # 消息处理器
│   │   │   ├── chat.ts       # 聊天处理
│   │   │   ├── game.ts       # 游戏处理
│   │   │   ├── index.ts
│   │   │   ├── room.ts       # 房间处理
│   │   │   ├── server.ts     # 服务器处理
│   │   │   └── user.ts       # 用户处理
│   │   ├── wsContext.ts      # WebSocket 上下文
│   │   ├── wsRouter.ts       # WebSocket 路由
│   │   └── wsServer.ts       # WebSocket 服务器
│   └── index.ts              # 入口文件
├── .env.example              # 环境变量示例
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始
### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量示例文件并修改配置：

编辑 `.env` 文件，填入配置信息。

### 3. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:47381` 启动（端口可在 `.env` 中配置）。

## 配置说明

在 `.env` 文件中配置以下参数：

### 服务器配置
| 参数           | 说明       | 默认值     |
|--------------|----------|---------|
| `PORT`       | 服务器监听端口  | `47381` |
| `AUTH_TOKEN` | API 认证令牌 | -       |

### KOOK Bot 配置
| 参数               | 说明              | 默认值                             |
|------------------|-----------------|---------------------------------|
| `KOOK_API`       | KOOK API 基础 URL | `https://www.kookapp.cn/api/v3` |
| `KOOK_BOT_TOKEN` | KOOK Bot Token  | -                               |

### 腾讯云 COS 配置
| 参数                    | 说明             | 默认值          |
|-----------------------|----------------|--------------|
| `TXCLOUD_SECRET_ID`   | 腾讯云 Secret ID  | -            |
| `TXCLOUD_SECRET_KEY`  | 腾讯云 Secret Key | -            |
| `COS_BUCKET`          | COS 存储桶名称      | -            |
| `COS_REGION`          | COS 地域         | `ap-beijing` |
| `COS_DOMAIN`          | COS 访问域名       | -            |
| `COS_FORCE_SIGN_HOST` | 是否强制签名主机       | `false`      |

## API 文档

### HTTP API

#### 文件上传
- `POST /file/upload` - 上传文件到腾讯云 COS

#### KOOK 集成
- `GET /kook/*` - KOOK API 代理接口
- `POST /kook/*` - KOOK API 代理接口

### WebSocket 协议

连接地址：`ws://localhost:47381/ws`

#### 消息格式

```typescript
{
  type: string,      // 消息类型
  payload: any       // 消息数据
}
```

#### 主要消息类型

**服务器消息**
- `server.ping` - 心跳 ping（服务器 → 客户端）
- `client.pong` - 心跳 pong 响应（客户端 → 服务器）

**用户消息**
- `user.login` - 用户登录
- `user.info` - 用户信息同步

**房间消息**
- `room.create` - 创建房间
- `room.join` - 加入房间
- `room.leave` - 离开房间
- `room.update` - 房间状态更新
- `room.ready` - 玩家准备状态切换

**聊天消息**
- `chat.send` - 发送聊天消息
- `chat.receive` - 接收聊天消息

**游戏消息**
- `game.start` - 开始游戏
- `game.state` - 游戏状态同步
- `game.action` - 游戏操作

详细类型定义请参考 `src/types/ws/` 目录下的类型文件。

## 开发指南

### 添加新的 WebSocket 消息类型

1. 在 `src/types/ws/message.ts` 中定义消息类型映射
2. 在 `src/types/ws/` 对应模块中定义 payload 类型
3. 在 `src/ws/handlers/` 中创建或更新处理器
4. 在 `src/ws/wsRouter.ts` 中注册路由

### 添加新的 HTTP API

1. 在 `src/http/routes/` 中创建路由文件
2. 在 `src/http/app.ts` 中注册路由
3. 根据需要添加中间件（认证、错误处理等）

### 扩展游戏引擎

在 `src/core/game/gameEngine.ts` 中实现游戏逻辑，参考现有代码结构。

### 日志系统

使用内置的日志系统：

```typescript
import { logger, LogCategory } from "./utils/logger"

logger.info(LogCategory.WS, "消息内容", { 额外数据 })
logger.error(LogCategory.GAME, "错误信息", { error })
```

支持的日志类别：
- `WS` - WebSocket 相关
- `ROOM` - 房间管理相关
- `GAME` - 游戏引擎相关
- `HTTP` - HTTP 请求相关
- `SYSTEM` - 系统级日志

## 部署

### 生产环境构建

```bash
# 编译 TypeScript
npx tsc

# 使用编译后的代码启动
node dist/index.js
```

### 使用 PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name "holsder-geier"

# 设置开机自启
pm2 startup
pm2 save
```

## 许可证

MIT License

---
