import { HandlerMap } from "../wsRouter"
import { send } from "../wsRouter"
import { roomManager } from "../../core/room/roomManager"
import { ChatReceivePayload } from "../../types/ws/chat"
import { logger } from "../../utils/logger"
import { ChatError } from "../../types/ws/errorCode"
import { Room } from "../../core/room/roomManager"

export function sendSystemMessage(room: Room, message: string) {
    const payload: ChatReceivePayload = {
        type: 'system',
        message,
        timestamp: Date.now(),
    }
    room.addChatMessage(payload)
    room.broadcast("chat.receive", payload)
}

export const chatHandlers: HandlerMap = {
    "chat.send": async (ctx, msg) => {
        const { message } = msg.payload

        if (!ctx.userId || !ctx.user) {
            send(ctx, "server.error", {
                code: ChatError.NOT_LOGGED_IN,
                message: "Please set user info first",
                requestId: msg.requestId,
            })
            return
        }

        const payload: ChatReceivePayload = {
            user: ctx.user,
            type: 'user',
            message,
            timestamp: Date.now(),
        }

        if (ctx.roomId) {
            const room = roomManager.getRoom(ctx.roomId)
            if (room) {
                room.addChatMessage(payload)
                room.broadcast("chat.receive", payload)
                logger.chat("Room message sent", { roomId: ctx.roomId, userId: ctx.userId, messageLength: message.length })
            }
        } else {
            send(ctx, "chat.receive", payload)
            logger.chat("Global message sent", { userId: ctx.userId, messageLength: message.length })
        }

        send(ctx, "server.ack", { requestId: msg.requestId! })
    },
}
