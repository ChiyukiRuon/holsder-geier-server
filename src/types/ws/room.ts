export interface RoomCreatePayload {
    roomId: string
    user?: {
        userId: string
        nickname: string
        avatar: string
        background?: string
    }
}

export interface RoomJoinPayload {
    roomId: string
    user: {
        userId: string
        nickname: string
        avatar: string
        background?: string
    }
    reconnect?: boolean  // 标识为重连请求
}

export interface RoomLeavePayload {}

export interface RoomListPayload {
    rooms: RoomInfo[]
}

export interface RoomInfo {
    roomId: string
    players: PlayerInfo[]
    status: "waiting" | "playing"
    maxPlayers: number
}

export interface RoomUpdatePayload {
    room: RoomInfo
}

export interface PlayerInfo {
    userId: string
    avatar: string
    card: {
        count: number
        list: number[]
        background: string | null
    }
    point: {
        count: number
        list: number[]
    }
    nickname: string
    ready: boolean
    latency?: number  // 延迟（毫秒），undefined 表示未连接或未知
}