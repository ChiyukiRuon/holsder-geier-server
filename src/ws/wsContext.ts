import { WebSocket } from "ws"
import {UserInfo} from "../types/ws/user";

export interface WsContext {
    ws: WebSocket
    userId?: string
    roomId?: string

    user?: UserInfo

    userReady?: boolean
    userState?: "lobby" | "room"

    card?: number[] // 手牌列表
    point?: {
        list: number[] // 得分牌列表
        count: number // 得分
    }

    currentPlayedCard?: number | null
    lastPlayedCard?: number | null

    latency?: number        // 延迟（毫秒）
    lastPingTime?: number   // 上次发送 ping 的时间戳
    lastPongTime?: number   // 最后收到 pong 的时间戳
}
