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

    // 心跳
    setInterval(() => {
        const now = Date.now()

        activeConnections.forEach((ctx) => {
            if (!ctx.ws || ctx.ws.readyState !== 1) return

            ctx.lastPingTime = now

            // 在房间就带上房间延迟信息
            let latencies: Array<{ userId: string; latency: number }> | undefined

            if (ctx.userState === "room" && ctx.roomId) {
                const room = roomManager.getRoom(ctx.roomId)
                if (room) {
                    latencies = []

                    room.players.forEach((playerState, userId) => {
                        const latency =
                            playerState.ctx.ws.readyState === 1
                                ? (playerState.ctx.latency ?? -999)
                                : -999

                        latencies!.push({ userId, latency })
                    })
                }
            }

            send(ctx, "server.ping", {
                serverTime: now,
                latencies,
            })
        })
    }, PING_INTERVAL)

    // 在线状态检测
    setInterval(() => {
        const now = Date.now()
        activeConnections.forEach((ctx) => {
            if (ctx.ws && ctx.ws.readyState === 1) {
                const lastPong = ctx.lastPongTime || ctx.lastPingTime
                if (!lastPong) return

                const elapsed = now - lastPong

                if (elapsed > PING_TIMEOUT) {
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
                    const isGamePlaying = room.status === "playing"

                    if (isGamePlaying) {
                        // 游戏进行中：认定为掉线，保留玩家信息
                        logger.info(LogCategory.WS, "Player disconnected during game (marked as offline)", {
                            userId: ctx.userId,
                            roomId: ctx.roomId
                        })

                        sendSystemMessage(room, `${nickname} 掉线`)

                        // 检查是否所有玩家都断开连接
                        checkAndDestroyEmptyRoom(room)
                    } else {
                        // 游戏未开始：直接离开房间
                        logger.info(LogCategory.WS, "Player left room before game started", {
                            userId: ctx.userId,
                            roomId: ctx.roomId
                        })

                        sendSystemMessage(room, `${nickname} 离开了房间`)

                        room.removePlayer(ctx.userId)
                        ctx.roomId = undefined
                        ctx.userState = "lobby"

                        // 检查是否所有玩家都断开连接
                        if (room.players.size === 0) {
                            roomManager.deleteRoom(ctx.roomId)
                            logger.room("Room deleted (all players disconnected before game)", {
                                roomId: ctx.roomId
                            })
                        } else {
                            room.broadcast("room.update", {
                                room: room.toRoomInfo(),
                            })
                        }
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

// 检查并销毁空房间（所有玩家都断开连接）
function checkAndDestroyEmptyRoom(room: any) {
    let allDisconnected = true

    room.players.forEach((playerState: any) => {
        if (playerState.ctx.ws && playerState.ctx.ws.readyState === 1) {
            allDisconnected = false
        }
    })

    if (allDisconnected && room.players.size > 0) {
        logger.room("All players disconnected, destroying room immediately", {
            roomId: room.roomId,
            playerCount: room.players.size
        })

        // 如果游戏正在进行，需要清理游戏状态
        if (room.game && room.status === "playing") {
            logger.game("Cleaning up game state due to all players disconnecting", {
                roomId: room.roomId
            })
        }

        // 销毁房间
        roomManager.deleteRoom(room.roomId)
    }
}

// 导出用于其他模块访问活跃连接（用于更新延迟等）
export { activeConnections }
