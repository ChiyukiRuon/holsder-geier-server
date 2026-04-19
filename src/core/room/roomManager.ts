import {WsContext} from "../../ws/wsContext"
import {RoomInfo} from "../../types/ws/room"
import {send} from "../../ws/wsRouter"
import {MessageMap} from "../../types/ws/message"
import {PlayerState} from "./playerState"
import {GameEngine} from "../game/gameEngine"
import {ChatReceivePayload} from "../../types/ws/chat"
import { logger } from "../../utils/logger"
import {UserInfo} from "../../types/ws/user";
import {sendSystemMessage} from "../../ws/handlers/chat";

export class Room {
    roomId: string
    players: Map<string, PlayerState> = new Map()
    spectators: Map<string, PlayerState> = new Map()
    maxPlayers: number
    status: "waiting" | "playing" = "waiting"
    game?: GameEngine
    chatHistory: ChatReceivePayload[] = []
    maxChatHistory = 100

    constructor(roomId: string, maxPlayers: number) {
        this.roomId = roomId
        this.maxPlayers = maxPlayers
    }

    addPlayer(ctx: WsContext) {
        if (!ctx.userId) throw new Error("NO_USER_ID")

        if (this.players.size >= this.maxPlayers) {
            throw new Error("ROOM_FULL")
        }

        const player = new PlayerState(ctx)
        player.role = "player"
        this.players.set(ctx.userId, player)
        ctx.roomId = this.roomId
        ctx.userState = "room"
    }

    addSpectator(ctx: WsContext) {
        if (!ctx.userId) throw new Error("NO_USER_ID")

        const spectator = new PlayerState(ctx)
        spectator.role = "spectator"
        this.spectators.set(ctx.userId, spectator)
        ctx.roomId = this.roomId
        ctx.userState = "room"
    }

    removePlayer(userId: string) {
        this.players.delete(userId)
    }

    removeSpectator(userId: string) {
        this.spectators.delete(userId)
    }

    getPlayer(userId: string): PlayerState | undefined {
        return this.players.get(userId)
    }

    getSpectator(userId: string): PlayerState | undefined {
        return this.spectators.get(userId)
    }

    getUser(userId: string): PlayerState | undefined {
        return this.players.get(userId) || this.spectators.get(userId)
    }

    getPlayers(): PlayerState[] {
        return Array.from(this.players.values())
    }

    getSpectators(): PlayerState[] {
        return Array.from(this.spectators.values())
    }

    getAllUsers(): PlayerState[] {
        return [...this.getPlayers(), ...this.getSpectators()]
    }

    toRoomInfo(): RoomInfo {
        return {
            roomId: this.roomId,
            players: this.getPlayers().map((p) => p.toPublicInfo()),
            spectators: this.getSpectators().map((p) => p.toPublicInfo()),
            status: this.status,
            maxPlayers: this.maxPlayers,
        }
    }

    broadcast<K extends keyof MessageMap>(type: K, payload: MessageMap[K]) {
        // 向所有玩家广播
        for (const p of this.players.values()) {
            send(p.ctx, type, payload as MessageMap[K])
        }
        // 向所有观战者广播
        for (const s of this.spectators.values()) {
            send(s.ctx, type, payload as MessageMap[K])
        }
    }

    broadcastToOthers<K extends keyof MessageMap>(excludeId: string, type: K, payload: MessageMap[K]) {
        // 向其他玩家广播
        for (const p of this.players.values()) {
            if (p.userId !== excludeId) {
                send(p.ctx, type, payload as MessageMap[K])
            }
        }
        // 向其他观战者广播
        for (const s of this.spectators.values()) {
            if (s.userId !== excludeId) {
                send(s.ctx, type, payload as MessageMap[K])
            }
        }
    }

    broadcastGameMessage(
        type: "game.state" | "game.resolve",
        buildPlayerPayload: (player: PlayerState) => any,
        buildSpectatorPayload: () => any
    ) {
        const players = this.getPlayers()
        const spectators = this.getSpectators()

        // 向玩家发送加密后的信息
        players.forEach((player) => {
            const payload = buildPlayerPayload(player)
            send(player.ctx, type, payload)
        })

        // 向观战者发送未加密的完整信息
        if (spectators.length > 0) {
            const payload = buildSpectatorPayload()
            spectators.forEach((spectator) => {
                send(spectator.ctx, type, payload)
            })
        }
    }

    allReady(): boolean {
        if (this.players.size === 0) return false
        return Array.from(this.players.values()).every((p) => p.ready)
    }

    startGame() {
        if (this.status !== "waiting") return

        const players = this.getPlayers()
        if (players.length < 2) {
            return
        }
        if (!this.allReady()) return

        this.status = "playing"

        for (const player of players) {
            player.ready = false
        }

        this.game = new GameEngine(this)
        this.game.start()
    }

    addChatMessage(message: ChatReceivePayload) {
        this.chatHistory.push(message)
        if (this.chatHistory.length > this.maxChatHistory) {
            this.chatHistory.shift()
        }
    }

    getChatHistory(): ChatReceivePayload[] {
        return [...this.chatHistory]
    }
}

export class RoomManager {
    private rooms: Map<string, Room> = new Map()

    createRoom(roomId: string, maxPlayers: number) {
        if (this.rooms.has(roomId)) {
            throw new Error("ROOM_ALREADY_EXISTS")
        }

        const room = new Room(roomId, maxPlayers)
        this.rooms.set(roomId, room)
        logger.room("Room created", { roomId, maxPlayers, totalRooms: this.rooms.size })

        return room
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId)
    }

    deleteRoom(roomId: string) {
        const room = this.rooms.get(roomId)
        if (!room) return

        // 清理所有玩家的房间状态
        room.players.forEach((player) => {
            player.ctx.roomId = undefined
            player.ctx.userState = "lobby"
        })

        // 清理所有观战者的房间状态
        room.spectators.forEach((spectator) => {
            spectator.ctx.roomId = undefined
            spectator.ctx.userState = "lobby"
        })

        this.rooms.delete(roomId)
        logger.room("Room deleted", { roomId, totalRooms: this.rooms.size })
    }

    joinRoom(ctx: WsContext, roomId: string, user: UserInfo) {
        const room = this.rooms.get(roomId)
        if (!room) throw new Error("ROOM_NOT_FOUND")

        // 检查是否是玩家的重连（只有玩家支持重连，观战者不支持）
        const existingPlayer = room.getPlayer(user.userId)
        const isReconnect = existingPlayer !== undefined

        if (isReconnect) {
            // 重连逻辑：更新现有玩家的ctx引用
            existingPlayer.ctx = ctx
            ctx.userId = user.userId
            ctx.roomId = roomId
            ctx.userState = "room"

            // 更新用户信息（允许用户信息在断线期间更新）
            ctx.user = {
                userId: user.userId,
                nickname: user.nickname,
                avatar: user.avatar,
                background: user.background,
                color: user.color,
            }

            // 重置ping/pong状态，避免立即被判定为离线
            ctx.lastPongTime = Date.now()
            ctx.latency = 0

            logger.room("Player reconnected to room", {
                roomId,
                userId: user.userId,
                gameStatus: room.status,
                role: existingPlayer.role
            })

            sendSystemMessage(room, `${user.nickname} 重新连接`)
        } else {
            // 先设置 ctx.userId 和用户信息
            ctx.userId = user.userId
            ctx.user = {
                userId: user.userId,
                nickname: user.nickname,
                avatar: user.avatar ?? "",
                background: user.background,
                color: user.color,
            }

            // 检查是否应该以观战者身份加入
            const isGamePlaying = room.status === "playing"
            const isPlayerFull = room.players.size >= room.maxPlayers

            if (isGamePlaying || isPlayerFull) {
                // 游戏进行中或玩家人数已满，以观战者身份加入
                room.addSpectator(ctx)

                logger.room("User joined as spectator", {
                    roomId,
                    userId: ctx.userId,
                    reason: isGamePlaying ? "game_in_progress" : "room_full",
                    playerCount: room.players.size,
                    spectatorCount: room.spectators.size
                })

                if (isGamePlaying) {
                    send(ctx, "server.toast", {
                        type: "info",
                        message: "游戏进行中，正在观战",
                    })
                    sendSystemMessage(room, `${user.nickname} 加入观战`)
                } else {
                    send(ctx, "server.toast", {
                        type: "info",
                        message: `玩家已满(${room.players.size}/${room.maxPlayers})，加入观战`,
                    })
                    sendSystemMessage(room, `${user.nickname} 加入观战`)
                }
            } else {
                // 玩家人数未满且游戏未开始，以玩家身份加入
                room.addPlayer(ctx)

                logger.room("User joined room as player", {
                    roomId,
                    userId: ctx.userId,
                    playerCount: room.players.size
                })

                sendSystemMessage(room, `${user.nickname} 加入了房间`)
            }
        }

        // 广播房间更新
        room.broadcast("room.update", {
            room: room.toRoomInfo(),
        })

        return room
    }

    leaveRoom(ctx: WsContext) {
        if (!ctx.roomId || !ctx.userId) return

        const room = this.rooms.get(ctx.roomId)
        if (!room) return

        const nickname = ctx.user?.nickname ?? ctx.userId

        // 尝试从玩家列表移除
        const isPlayer = room.players.has(ctx.userId)
        if (isPlayer) {
            room.removePlayer(ctx.userId)
            sendSystemMessage(room, `${nickname} 离开房间`)
        } else {
            // 尝试从观战者列表移除
            room.removeSpectator(ctx.userId)
            sendSystemMessage(room, `${nickname} 退出观战`)
        }

        ctx.roomId = undefined
        ctx.userState = "lobby"

        logger.room("User left room", {
            roomId: room.roomId,
            userId: ctx.userId,
            role: isPlayer ? "player" : "spectator",
            playerCount: room.players.size,
            spectatorCount: room.spectators.size
        })

        // 如果房间没有任何人，销毁房间
        if (room.players.size === 0 && room.spectators.size === 0) {
            this.rooms.delete(room.roomId)
            logger.room("Room deleted (empty)", { roomId: room.roomId, totalRooms: this.rooms.size })
            return
        }

        room.broadcast("room.update", {
            room: room.toRoomInfo(),
        })
    }

    listRooms(): RoomInfo[] {
        return Array.from(this.rooms.values()).map((room) =>
            room.toRoomInfo()
        )
    }
}

export const roomManager = new RoomManager()
