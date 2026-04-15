import { HandlerMap } from "../wsRouter"
import { send } from "../wsRouter"
import { roomManager } from "../../core/room/roomManager"
import { logger, LogCategory } from "../../utils/logger"

export const userHandlers: HandlerMap = {
    "user.update": async (ctx, msg) => {
        const { nickname, avatar, background } = msg.payload

        if (nickname !== undefined) {
            if (!ctx.user) {
                ctx.user = { nickname: '', avatar: '' }
            }
            ctx.user.nickname = nickname
        }

        if (avatar !== undefined) {
            if (!ctx.user) {
                ctx.user = { nickname: '', avatar: '' }
            }
            ctx.user.avatar = avatar
        }

        if (background !== undefined) {
            if (!ctx.user) {
                ctx.user = { nickname: '', avatar: '' }
            }
            ctx.user.background = background
        }

        // 如果在房间里,广播用户信息更新
        if (ctx.roomId) {
            const room = roomManager.getRoom(ctx.roomId)
            if (room) {
                logger.room("Player info updated", { roomId: ctx.roomId, userId: ctx.userId, changes: { nickname, avatar, background } })
                room.broadcast("room.update", {
                    room: room.toRoomInfo(),
                })
            }
        }

        send(ctx, "server.ack", {
            requestId: msg.requestId!,
        })
    },
}
