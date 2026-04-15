import {WsContext} from "../../ws/wsContext";

export class PlayerState {
    ctx: WsContext

    // 房间状态
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
            userId: this.userId,
            nickname: this.ctx.user?.nickname ?? "Unknown",
            avatar: this.ctx.user?.avatar ?? "",

            ready: this.ready,

            card: {
                count: this.handCards.length,
                list: [],
                background: null,
            },

            point: {
                count: this.points.length,
                list: this.points,
            },

            latency: this.ctx.latency,
        }
    }

    getTotalScore(): number {
        return this.points.reduce((sum, p) => sum + p, 0)
    }

    toPrivateInfo() {
        return {
            handCards: this.handCards,
            points: this.points,
            totalScore: this.getTotalScore(),
        }
    }
}