import { HandlerMap } from "../wsRouter"
import { send } from "../wsRouter"
import { roomManager } from "../../core/room/roomManager"
import { logger, LogCategory } from "../../utils/logger"
import { RoomError, UserError, CommonError } from "../../types/ws/errorCode"

export const roomHandlers: HandlerMap = {
    "room.create": async (ctx, msg) => {
        const { roomId, user } = msg.payload

        if (roomManager.getRoom(roomId)) {
            send(ctx, "server.error", {
                code: RoomError.ROOM_ALREADY_EXISTS,
                message: "Room already exists",
                requestId: msg.requestId,
            })
            return
        }

        // 如果提供了用户信息，初始化ctx
        if (user) {
            ctx.userId = user.userId
            ctx.user = {
                userId: user.userId,
                nickname: user.nickname,
                avatar: user.avatar ?? "",
                background: user.background,
                color: user.color,
            }
        }

        const room = roomManager.createRoom(roomId, 4)
        room.addPlayer(ctx)

        logger.room("Room created and player joined", { roomId, userId: ctx.userId })

        send(ctx, "room.update", {
            room: room.toRoomInfo(),
        })

        send(ctx, "server.ack", {
            requestId: msg.requestId!,
        })
    },

    "room.join": async (ctx, msg) => {
        const { roomId, user } = msg.payload

        if (!user) {
            send(ctx, "server.error", {
                code: UserError.MISSING_USER,
                message: "User information is required",
                requestId: msg.requestId,
            })
            return
        }

        let room = roomManager.getRoom(roomId)

        // 如果房间不存在，自动创建房间
        if (!room) {
            ctx.userId = user.userId
            ctx.user = {
                userId: user.userId,
                nickname: user.nickname,
                avatar: user.avatar ?? "",
                background: user.background,
                color: user.color,
            }

            room = roomManager.createRoom(roomId, 5)
            room.addPlayer(ctx)

            logger.room("Room auto-created and player joined", { roomId, userId: user.userId })

            send(ctx, "room.update", {
                room: room.toRoomInfo(),
            })

            send(ctx, "server.ack", {
                requestId: msg.requestId!,
            })
            return
        }

        try {
            // joinRoom 会自动判断是重连还是新加入
            roomManager.joinRoom(ctx, roomId, user)

            logger.room("Player processed for room", {
                roomId,
                userId: user.userId,
                isReconnect: room.getPlayer(user.userId)?.ctx.ws.readyState === 1
            })

            // 发送聊天历史
            send(ctx, "chat.sync", {
                messages: room.getChatHistory(),
            })

            // 如果游戏正在进行，发送游戏状态
            if (room.status === "playing" && room.game) {
                logger.game("Sending game state to player", {
                    roomId,
                    userId: user.userId,
                    gameStage: room.game.stage
                })

                const playerList = room.game.buildPlayerListForPlayer(user.userId)
                const gameState = room.game.buildStateForPlayer(user.userId)

                send(ctx, "game.state", {
                    players: playerList,
                    state: gameState,
                })
            }

            send(ctx, "server.ack", {
                requestId: msg.requestId!,
            })
        } catch (err: any) {
            send(ctx, "server.error", {
                code: err.message || RoomError.JOIN_FAILED,
                message: err.message || "Join room failed",
                requestId: msg.requestId,
            })
        }
    },

    "room.leave": async (ctx, msg) => {
        if (!ctx.roomId) {
            send(ctx, "server.error", {
                code: CommonError.NOT_IN_ROOM,
                message: "You are not in any room",
                requestId: msg.requestId,
            })
            return
        }

        const oldRoomId = ctx.roomId
        roomManager.leaveRoom(ctx)

        send(ctx, "server.ack", {
            requestId: msg.requestId!,
        })
    },

    "room.list": async (ctx, msg) => {
        const rooms = roomManager.listRooms()

        send(ctx, "room.list", {
            rooms,
        })
    },
}
