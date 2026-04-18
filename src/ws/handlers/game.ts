import { HandlerMap } from "../wsRouter"
import { send } from "../wsRouter"
import { roomManager } from "../../core/room/roomManager"
import { logger } from "../../utils/logger"
import { CommonError, RoomError, GameError } from "../../types/ws/errorCode"

export const gameHandlers: HandlerMap = {
    "game.ready": async (ctx, msg) => {
        const { ready } = msg.payload

        if (!ctx.roomId || !ctx.userId) {
            send(ctx, "server.error", {
                code: CommonError.NOT_IN_ROOM,
                message: "You are not in any room",
                requestId: msg.requestId,
            })
            return
        }

        const room = roomManager.getRoom(ctx.roomId)
        if (!room) {
            send(ctx, "server.error", {
                code: RoomError.ROOM_NOT_FOUND,
                message: "Room not found",
                requestId: msg.requestId,
            })
            return
        }

        if (room.status !== "waiting") {
            send(ctx, "server.error", {
                code: GameError.GAME_ALREADY_STARTED,
                message: "Game already started",
                requestId: msg.requestId,
            })
            return
        }

        const player = room.getPlayer(ctx.userId)
        if (!player) {
            send(ctx, "server.error", {
                code: GameError.PLAYER_NOT_FOUND,
                message: "Player not found",
                requestId: msg.requestId,
            })
            return
        }

        player.ready = ready
        room.broadcast("room.update", { room: room.toRoomInfo() })

        logger.game("Player ready state changed", { roomId: ctx.roomId, userId: ctx.userId, ready })

        // 检查是否所有玩家都准备，且至少2名玩家
        if (room.allReady() && room.players.size >= 2) {
            logger.game("All players ready, starting game", { roomId: ctx.roomId, playerCount: room.players.size })
            room.startGame()
        } else if (room.allReady()) {
            logger.game("Not enough players ready, waiting for more players", {
                roomId: ctx.roomId,
                playerCount: room.players.size,
            })
            room.broadcast("server.toast", {
                type: "info",
                message: "至少需要 2 名玩家才能开始游戏",
            })
        }

        send(ctx, "server.ack", { requestId: msg.requestId! })
    },

    "game.start": async (ctx, msg) => {
        send(ctx, "server.error", {
            code: CommonError.INVALID_REQUEST,
            message: "game.start is server-push only",
            requestId: msg.requestId,
        })
    },

    "game.end": async (ctx, msg) => {
        send(ctx, "server.error", {
            code: CommonError.INVALID_REQUEST,
            message: "game.end is server-push only",
            requestId: msg.requestId,
        })
    },

    "game.state": async (ctx, msg) => {
        send(ctx, "server.error", {
            code: CommonError.INVALID_REQUEST,
            message: "game.sync is server-push only",
            requestId: msg.requestId,
        })
    },

    "game.sync": async (ctx, msg) => {
        send(ctx, "server.error", {
            code: CommonError.INVALID_REQUEST,
            message: "game.sync is server-push only",
            requestId: msg.requestId,
        })
    },

    "game.action": async (ctx, msg) => {
        const { action } = msg.payload

        if (!ctx.roomId || !ctx.userId) {
            send(ctx, "server.error", {
                code: CommonError.NOT_IN_ROOM,
                message: "You are not in any room",
                requestId: msg.requestId,
            })
            return
        }

        const room = roomManager.getRoom(ctx.roomId)
        if (!room || !room.game) {
            send(ctx, "server.error", {
                code: GameError.GAME_NOT_STARTED,
                message: "Game has not started",
                requestId: msg.requestId,
            })
            return
        }

        try {
            room.game.handleAction(ctx.userId, {
                data: { card: action.card }
            })
            logger.game("Player action received", { roomId: ctx.roomId, userId: ctx.userId, card: action.card })

            send(ctx, "server.ack", { requestId: msg.requestId! })
        } catch (err: any) {
            logger.gameWarn("Player action failed", { roomId: ctx.roomId, userId: ctx.userId, error: err.message })
            send(ctx, "server.error", {
                code: err.message || GameError.ACTION_FAILED,
                message: err.message || "Action failed",
                requestId: msg.requestId,
            })
        }
    },
}
