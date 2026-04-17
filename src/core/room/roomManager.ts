import {WsContext} from "../../ws/wsContext"
import {PlayerInfo, RoomInfo} from "../../types/ws/room"
import {send} from "../../ws/wsRouter"
import {MessageMap} from "../../types/ws/message"
import {PlayerState} from "./playerState"
import {GameEngine} from "../game/gameEngine"
import {ChatReceivePayload} from "../../types/ws/chat"
import { logger, LogCategory } from "../../utils/logger"
import {UserInfo} from "../../types/ws/user";
import {sendSystemMessage} from "../../ws/handlers/chat";

export class Room {
    roomId: string
    players: Map<string, PlayerState> = new Map()
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
        this.players.set(ctx.userId, player)
        ctx.roomId = this.roomId
        ctx.userState = "room"
    }

    removePlayer(userId: string) {
        this.players.delete(userId)
    }

    getPlayer(userId: string): PlayerState | undefined {
        return this.players.get(userId)
    }

    getPlayerList(): PlayerInfo[] {
        return Array.from(this.players.values()).map((p) => p.toPublicInfo())
    }

    toRoomInfo(): RoomInfo {
        return {
            roomId: this.roomId,
            players: this.getPlayerList(),
            status: this.status,
            maxPlayers: this.maxPlayers,
        }
    }

    broadcast<K extends keyof MessageMap>(type: K, payload: MessageMap[K]) {
        for (const p of this.players.values()) {
            send(p.ctx, type, payload as MessageMap[K])
        }
    }

    broadcastToOthers<K extends keyof MessageMap>(excludeId: string, type: K, payload: MessageMap[K]) {
        for (const p of this.players.values()) {
            if (p.userId !== excludeId) {
                send(p.ctx, type, payload as MessageMap[K])
            }
        }
    }

    allReady(): boolean {
        return Array.from(this.players.values()).every((p) => p.ready)
    }

    startGame() {
        if (this.status !== "waiting") return
        if (!this.allReady()) return

        this.status = "playing"

        for (const player of this.players.values()) {
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

        this.rooms.delete(roomId)
        logger.room("Room deleted", { roomId, totalRooms: this.rooms.size })
    }

    joinRoom(ctx: WsContext, roomId: string, user: UserInfo) {
        const room = this.rooms.get(roomId)
        if (!room) throw new Error("ROOM_NOT_FOUND")

        // 检查是否是该玩家的重连（玩家仍在房间列表中但websocket已断开）
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
            ctx.latency = undefined

            logger.room("Player reconnected to room", {
                roomId,
                userId: user.userId,
                gameStatus: room.status
            })

            sendSystemMessage(room, `${user.nickname} 重新连接`)
        } else {
            // 新加入逻辑
            if (room.players.size >= room.maxPlayers) {
                throw new Error("ROOM_FULL")
            }

            // 先设置 ctx.userId，因为 addPlayer 需要它
            ctx.userId = user.userId

            // 设置用户信息
            ctx.user = {
                userId: user.userId,
                nickname: user.nickname,
                avatar: user.avatar ?? "",
                background: user.background,
                color: user.color,
            }

            // 再添加玩家到房间
            room.addPlayer(ctx)

            logger.room("Player joined room", {
                roomId,
                userId: ctx.userId,
                playerCount: room.players.size
            })

            const nickname = ctx.user?.nickname ?? ctx.userId
            sendSystemMessage(room, `${nickname} 加入了房间`)
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

        room.removePlayer(ctx.userId)
        ctx.roomId = undefined
        ctx.userState = "lobby"

        logger.room("Player left room", { roomId: room.roomId, userId: ctx.userId, playerCount: room.players.size })

        sendSystemMessage(room, `${nickname} 退出了房间`)

        if (room.players.size === 0) {
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
