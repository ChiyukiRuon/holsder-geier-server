import { WebSocket } from "ws"
import { handlers } from "./handlers"
import { WsContext } from "./wsContext"
import {MessageMap, WsMessage} from "../types/ws/message";
import { logger, LogCategory } from "../utils/logger";
import packageJson from "../../package.json";
import {PongPayload} from "../types/ws/server";

export type { MessageMap, WsMessage }
export type HandlerMap = {
    [K in keyof MessageMap]?: (
        ctx: WsContext,
        msg: WsMessage<K>
    ) => void | Promise<void>
}

export function handleWsConnection(ws: WebSocket) {
    const ctx: WsContext = { ws, userState: "lobby" }

    send(ctx, "server.info", {
        service: "Holsder Geier Websocket Service",
        version: packageJson.version,
        environment: process.env.RUNTIME_ENV || "-",
        serverTime: Date.now(),
    })

    // 保存ctx到ws对象，以便关闭事件中访问
    ;(ws as any)._ctx = ctx

    ws.on("message", async (data) => {
        let msg: WsMessage

        try {
            msg = JSON.parse(data.toString())
        } catch (err) {
            return sendError(ctx, "INVALID_JSON", "Invalid JSON format")
        }

        // 处理 pong 消息，计算延迟
        if (msg.type === "client.pong") {
            const payload = msg.payload as PongPayload
            if (payload.pingTime !== undefined) {
                const now = Date.now()
                ctx.latency = now - payload.pingTime
                ctx.lastPongTime = now
                logger.debug(LogCategory.WS, "Pong received", { userId: ctx.userId, latency: ctx.latency })
            }
            return
        }

        logger.debug(LogCategory.WS, "Routing message", { type: msg.type, userId: ctx.userId, requestId: msg.requestId })
        await routeMessage(ctx, msg)
    })
}

async function routeMessage(ctx: WsContext, msg: WsMessage) {
    const handler = (handlers as HandlerMap)[msg.type]

    if (!handler) {
        logger.warn(LogCategory.WS, "Unknown message type", { type: msg.type, userId: ctx.userId })
        return sendError(ctx, "UNKNOWN_TYPE", `Unknown type: ${msg.type}`)
    }

    try {
        await handler(ctx, msg as any)
    } catch (err: any) {
        logger.error(LogCategory.WS, "Handler error", { type: msg.type, userId: ctx.userId, error: err.message, stack: err.stack })
        sendError(ctx, "INTERNAL_ERROR", "Server error", msg.requestId)
    }
}

// 通用发送

export function send<T extends keyof MessageMap>(
    ctx: WsContext,
    type: T,
    payload: MessageMap[T],
    requestId?: string
) {
    ctx.ws.send(
        JSON.stringify({
            type,
            requestId,
            payload,
        })
    )
}

export function sendError(
    ctx: WsContext,
    code: string,
    message: string,
    requestId?: string
) {
    send(ctx, "server.error", { code, message, requestId })
}
