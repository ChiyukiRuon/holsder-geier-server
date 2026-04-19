import { HandlerMap } from "../wsRouter"
import { send } from "../wsRouter"
import { roomManager } from "../../core/room/roomManager"
import { logger } from "../../utils/logger"
import { RoomError, UserError, CommonError } from "../../types/ws/errorCode"
import {sendSystemMessage} from "./chat";
import {roomConfig} from "../../utils/config";
import {PlayerState} from "../../core/room/playerState";

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

        const room = roomManager.createRoom(roomId, roomConfig.maxPlayers)
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

            room = roomManager.createRoom(roomId, roomConfig.maxPlayers)
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
            roomManager.joinRoom(ctx, roomId, user)

            // 获取用户信息（可能是玩家或观战者）
            const player = room.getPlayer(user.userId)
            const spectator = room.getSpectator(user.userId)
            const currentUser = (player || spectator) as PlayerState

            logger.room("User processed for room", {
                roomId,
                userId: user.userId,
                role: currentUser.role,
                isReconnect: player !== undefined  // 只有玩家支持重连
            })

            // 发送聊天历史
            send(ctx, "chat.sync", {
                messages: room.getChatHistory(),
            })

            // 如果游戏正在进行，发送游戏状态
            if (room.status === "playing" && room.game) {
                logger.game("Sending game state to joining user", {
                    roomId,
                    userId: user.userId,
                    role: currentUser.role,
                    gameStage: room.game.stage
                })

                // 根据角色发送不同的游戏状态
                if (spectator) {
                    // 观战者：发送未加密的完整信息
                    send(ctx, "game.state", {
                        players: room.game.buildPlayerListForSpectator(),
                        spectators: room.game.buildSpectatorList(),
                        state: room.game.buildStateForSpectator(),
                    })
                } else if (player) {
                    // 玩家：发送加密后的信息
                    const playerList = room.game.buildPlayerListForPlayer(user.userId)
                    const gameState = room.game.buildStateForPlayer(user.userId)

                    send(ctx, "game.state", {
                        players: playerList,
                        spectators: room.game.buildSpectatorList(),
                        state: gameState,
                    })
                }
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

        roomManager.leaveRoom(ctx)

        send(ctx, "server.ack", {
            requestId: msg.requestId!,
        })
    },

    "room.role": async (ctx, msg) => {
        if (!ctx.roomId) {
            send(ctx, "server.error", {
                code: CommonError.NOT_IN_ROOM,
                message: "You are not in any room",
                requestId: msg.requestId,
            })
            return
        }

        const { role } = msg.payload
        const room = roomManager.getRoom(ctx.roomId)

        if (!room) {
            send(ctx, "server.error", {
                code: RoomError.ROOM_NOT_FOUND,
                message: "Room not found",
                requestId: msg.requestId,
            })
            return
        }

        // 查找用户当前在哪个列表
        const currentPlayer = room.getPlayer(ctx.userId!)
        const currentSpectator = room.getSpectator(ctx.userId!)
        const currentUser = currentPlayer || currentSpectator

        if (!currentUser) {
            send(ctx, "server.error", {
                code: RoomError.JOIN_FAILED,
                message: "User not found in room",
                requestId: msg.requestId,
            })
            return
        }

        if (role !== "player" && role !== "spectator") {
            send(ctx, "server.error", {
                code: RoomError.INVALID_ROLE,
                message: "Invalid role",
                requestId: msg.requestId,
            })
            return
        }

        // 如果已经是目标角色，无需切换
        if (currentUser.role === role) {
            send(ctx, "server.ack", { requestId: msg.requestId! })
            return
        }

        if (room.status === "playing") {
            send(ctx, "server.error", {
                code: RoomError.GAME_IN_PROGRESS,
                message: "Cannot change role during game",
                requestId: msg.requestId,
            })
            return
        }

        const nickname = ctx.user?.nickname ?? ctx.userId

        // 执行角色切换：从一个Map移动到另一个Map
        if (role === "spectator") {
            // 玩家 -> 观战者
            if (currentPlayer) {
                room.removePlayer(ctx.userId!)
                room.addSpectator(ctx)
                sendSystemMessage(room, `${nickname} 切换为旁观者`)
            }
        } else {
            // 观战者 -> 玩家
            if (currentSpectator) {
                // 检查玩家人数是否已满
                if (room.players.size >= room.maxPlayers) {
                    send(ctx, "server.error", {
                        code: RoomError.ROOM_FULL,
                        message: "玩家人数已满，无法切换为玩家",
                        requestId: msg.requestId,
                    })
                    return
                }

                room.removeSpectator(ctx.userId!)
                room.addPlayer(ctx)
                sendSystemMessage(room, `${nickname} 切换为玩家`)
            }
        }

        room.broadcast("room.update", {
            room: room.toRoomInfo(),
        })

        send(ctx, "server.ack", { requestId: msg.requestId! })
    },

    "room.list": async (ctx) => {
        const rooms = roomManager.listRooms()

        send(ctx, "room.list", {
            rooms,
        })
    },
}
