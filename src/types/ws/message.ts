import * as Chat from "./chat"
import * as User from "./user"
import * as Room from "./room"
import * as Game from "./game"
import * as Server from "./server"

export interface MessageMap {
    // chat
    "chat.send": Chat.ChatSendPayload
    "chat.receive": Chat.ChatReceivePayload
    "chat.sync": Chat.ChatSyncPayload

    // user
    "user.update": User.UserUpdatePayload

    // room
    "room.create": Room.RoomCreatePayload
    "room.join": Room.RoomJoinPayload
    "room.leave": Room.RoomLeavePayload
    "room.list": Room.RoomListPayload
    "room.update": Room.RoomUpdatePayload

    // game
    "game.ready": Game.GameReadyPayload
    "game.start": Game.GameStartPayload
    "game.end": Game.GameEndPayload
    "game.stage": Game.GameStagePayload
    "game.action": Game.GameActionPayload
    "game.sync": Game.GameSyncPayload
    "game.resolve": Game.GameResolvePayload

    // server
    "server.ping": Server.PingPayload
    "server.pong": Server.PongPayload
    "server.ack": Server.AckPayload
    "server.error": Server.ErrorPayload
    "server.info": Server.InfoPayload
}

export type WsMessage<T extends keyof MessageMap = keyof MessageMap> = {
    type: T
    requestId?: string
    payload: MessageMap[T]
}
