import { WebSocket } from "ws"

export interface WsContext {
    ws: WebSocket
    userId?: string
    roomId?: string

    user?: {
        nickname: string
        avatar: string
        background?: string
    }

    ready?: boolean

    card?: number[] // 手牌列表
    point?: {
        list: number[] // 得分牌列表
        count: number // 得分
    }

    // Ping/Pong 相关
    latency?: number        // 延迟（毫秒）
    lastPingTime?: number   // 上次发送 ping 的时间戳
    lastPongTime?: number   // 最后收到 pong 的时间戳
}