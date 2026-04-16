import { HandlerMap } from "../wsRouter"
import { send } from "../wsRouter"
import { roomManager } from "../../core/room/roomManager"
import { logger, LogCategory } from "../../utils/logger"

export const userHandlers: HandlerMap = {
    "user.update": async (ctx, msg) => {
        const { nickname, avatar, background, color } = msg.payload

        if (!ctx.user) {
            ctx.user = {
                userId: ctx.userId || '',
                nickname: '',
                avatar: '',
                background: '',
                color: '',
            }
        }

        if (nickname !== undefined) {
            ctx.user.nickname = nickname
        }

        if (avatar !== undefined) {
            ctx.user.avatar = avatar
        }

        if (background !== undefined) {
            ctx.user.background = background
        }

        if (color !== undefined) {
            ctx.user.color = color
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
