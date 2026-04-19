import {WsContext} from "../../ws/wsContext";
import {RoomRole} from "../../types/ws/room";

export class PlayerState {
    ctx: WsContext
    role: RoomRole = "player"

    ready = false

    // 游戏状态
    handCards: number[] = []
    points: number[] = []

    constructor(ctx: WsContext) {
        this.ctx = ctx
    }

    get userId() {
        return this.ctx.userId!
    }

    get latency(): number | undefined {
        return this.ctx.latency
    }

    toPublicInfo() {
        return {
            user: {
                userId: this.userId,
                nickname: this.ctx.user?.nickname ?? "Unknown",
                avatar: this.ctx.user?.avatar ?? "",
                background: this.ctx.user?.background ?? "",
                color: this.ctx.user?.color ?? "",
            },
            role: this.role,
            ready: this.ready,
            card: this.handCards,
            point: {
                count: this.points.length,
                list: this.points,
            },
            currentPlayedCard: this.ctx.currentPlayedCard ?? null,
            lastPlayedCard: this.ctx.lastPlayedCard ?? null,
            latency: this.ctx.ws.readyState === 1 ? (this.ctx.latency ?? -999) : -999,
        }
    }

    getTotalPoint(): number {
        return this.points.reduce((sum, p) => sum + p, 0)
    }

    toPrivateInfo() {
        return {
            handCards: this.handCards,
            points: this.points,
            totalScore: this.getTotalPoint(),
        }
    }
}
