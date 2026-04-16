import { WebSocketServer } from "ws"
import http from "http"
import { handleWsConnection, send } from "./wsRouter"
import { roomManager } from "../core/room/roomManager"
import { logger, LogCategory } from "../utils/logger"
import {sendSystemMessage} from "./handlers/chat";

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

        // 收集所有已加入房间的玩家，按房间分组
        const roomsWithPlayers = new Map<string, Set<any>>()
        const playersWithoutRoom: any[] = []

        activeConnections.forEach((ctx) => {
            if (ctx.userId && ctx.roomId) {
                if (!roomsWithPlayers.has(ctx.roomId)) {
                    roomsWithPlayers.set(ctx.roomId, new Set())
                }
                roomsWithPlayers.get(ctx.roomId)!.add(ctx)
            } else if (ctx.userId && !ctx.roomId) {
                // 已连接但未加入房间的玩家，视为离线
                playersWithoutRoom.push(ctx)
            }
        })

        // 为每个房间的玩家发送包含房间内所有玩家延迟的 ping
        roomsWithPlayers.forEach((connectedPlayers, roomId) => {
            const room = roomManager.getRoom(roomId)
            if (!room) return

            // 构建房间内所有玩家的延迟信息（包括可能离线的玩家）
            const latencies: Array<{ userId: string; latency: number }> = []
            room.players.forEach((playerState, userId) => {
                // 获取玩家的延迟，如果玩家当前未连接则为 -999
                const latency = playerState.ctx.ws.readyState === 1 ? (playerState.ctx.latency ?? -999) : -999
                latencies.push({
                    userId,
                    latency,
                })
            })

            // 向房间内所有在线玩家发送 ping
            connectedPlayers.forEach((ctx) => {
                if (ctx.ws && ctx.ws.readyState === 1) {
                    ctx.lastPingTime = now
                    send(ctx, "server.ping", {
                        serverTime: now,
                        latencies: latencies.length > 0 ? latencies : undefined,
                    })
                }
            })
        })

        // 对未加入房间的玩家，直接断开连接（视为离线）
        playersWithoutRoom.forEach((ctx) => {
            logger.warn(LogCategory.WS, "WS client without room detected as offline, closing connection", {
                userId: ctx.userId,
            })
            ctx.ws.terminate()
        })
    }, PING_INTERVAL)

    // 定期检查已加入房间的玩家的离线状态
    setInterval(() => {
        const now = Date.now()
        activeConnections.forEach((ctx) => {
            if (ctx.ws && ctx.ws.readyState === 1 && ctx.roomId) {
                // 如果从未收到过 pong，检查是否超过 PING_TIMEOUT
                const lastPong = ctx.lastPongTime || ctx.lastPingTime
                if (!lastPong) {
                    // 没有任何 ping/pong 记录，跳过（刚连接的客户端）
                    return
                }

                const elapsed = now - lastPong
                // 如果超过 PING_TIMEOUT 未收到响应，认为客户端离线
                if (elapsed > PING_TIMEOUT) {
                    logger.warn(LogCategory.WS, "WS ping timeout, closing connection", {
                        userId: ctx.userId,
                        roomId: ctx.roomId,
                        elapsed,
                        lastPongTime: ctx.lastPongTime,
                        lastPingTime: ctx.lastPingTime
                    })
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
                    const nickname = ctx.user?.nickname ?? ctx.userId

                    sendSystemMessage(room, `${nickname} 断开连接`)

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
