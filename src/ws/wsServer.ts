import { WebSocketServer } from "ws"
import http from "http"
import { handleWsConnection, send } from "./wsRouter"
import { roomManager } from "../core/room/roomManager"
import { logger, LogCategory } from "../utils/logger"

const PING_INTERVAL = 5000 // 5秒
const PING_TIMEOUT = 10000  // 10秒无响应视为离线

// 存储所有活跃的连接上下文
const activeConnections: Set<any> = new Set()

export function createWsServer(server: http.Server) {
    const wss = new WebSocketServer({ server, path: "/ws" })

    logger.ws("WebSocket server initialized", { path: "/ws" })

    // 定时发送 ping
    setInterval(() => {
        const now = Date.now()
        activeConnections.forEach((ctx) => {
            if (ctx.ws && ctx.ws.readyState === 1) { // 1 = OPEN
                // 记录发送时间，用于计算延迟
                ctx.lastPingTime = now
                send(ctx, "server.ping", {
                    serverTime: now,
                })
            }
        })
    }, PING_INTERVAL)

    // 定期检查离线连接
    setInterval(() => {
        const now = Date.now()
        activeConnections.forEach((ctx) => {
            if (ctx.lastPongTime && ctx.ws && ctx.ws.readyState === 1) {
                const elapsed = now - ctx.lastPongTime
                // 如果超过 PING_TIMEOUT 未收到响应，认为客户端离线
                if (elapsed > PING_TIMEOUT) {
                    logger.warn(LogCategory.WS, "WS ping timeout, closing connection", { userId: ctx.userId })
                    ctx.ws.terminate()
                }
            }
        })
    }, PING_INTERVAL)

    wss.on("connection", (ws) => {
        logger.ws("New WS connection established", { totalConnections: activeConnections.size + 1 })

        // 监听连接关闭事件，处理断线逻辑
        ws.on("close", (code, reason) => {
            const ctx = (ws as any)._ctx
            if (ctx) {
                activeConnections.delete(ctx)
            }

            logger.ws("WS connection closed", { code, reason: reason.toString(), userId: ctx?.userId })

            if (ctx && ctx.userId && ctx.roomId) {
                const room = roomManager.getRoom(ctx.roomId)
                if (room) {
                    room.broadcast("room.update", {
                        room: room.toRoomInfo(),
                    })

                    if (room.game) {
                        logger.info(LogCategory.WS, "Player disconnected from room", { userId: ctx.userId, roomId: ctx.roomId })
                    }
                }
            }
        })

        handleWsConnection(ws)

        // 新连接加入活跃连接集合
        const ctx = (ws as any)._ctx
        if (ctx) {
            activeConnections.add(ctx)
        }
    })

    wss.on("error", (error) => {
        logger.error(LogCategory.WS, "WebSocket server error", { error: error.message, stack: error.stack })
    })

    wss.on("close", () => {
        logger.ws("WebSocket server closed")
    })
}

// 导出用于其他模块访问活跃连接（用于更新延迟等）
export { activeConnections }
