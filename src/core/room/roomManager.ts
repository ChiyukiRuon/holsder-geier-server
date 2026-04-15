import {WsContext} from "../../ws/wsContext"
import {PlayerInfo, RoomInfo} from "../../types/ws/room"
import {send} from "../../ws/wsRouter"
import {MessageMap} from "../../types/ws/message"
import {PlayerState} from "./playerState"
import {GameEngine} from "../game/gameEngine"
import {ChatReceivePayload} from "../../types/ws/chat"
import { logger, LogCategory } from "../../utils/logger"

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

    joinRoom(ctx: WsContext, roomId: string) {
        const room = this.rooms.get(roomId)
        if (!room) throw new Error("ROOM_NOT_FOUND")

        room.addPlayer(ctx)
        logger.room("Player joined room", { roomId, userId: ctx.userId, playerCount: room.players.size })

        room.broadcast("room.update", {
            room: room.toRoomInfo(),
        })

        return room
    }

    // 断线重连：将新的ctx关联到现有玩家
    rejoinRoom(ctx: WsContext, roomId: string, user: { userId: string; nickname: string; avatar: string; background?: string }) {
        const room = this.rooms.get(roomId)
        if (!room) throw new Error("ROOM_NOT_FOUND")

        const player = room.getPlayer(user.userId)
        if (!player) throw new Error("PLAYER_NOT_FOUND")

        // 更新PlayerState的ctx引用
        player.ctx = ctx
        ctx.userId = user.userId
        ctx.roomId = roomId

        // 更新用户信息（允许用户信息在断线期间更新）
        ctx.user = {
            nickname: user.nickname,
            avatar: user.avatar,
            background: user.background,
        }

        logger.room("Player reconnected", { roomId, userId: user.userId, gameStatus: room.game ? "playing" : "waiting" })

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

        room.removePlayer(ctx.userId)
        ctx.roomId = undefined

        logger.room("Player left room", { roomId: room.roomId, userId: ctx.userId, playerCount: room.players.size })

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
