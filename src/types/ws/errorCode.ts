/**
 * WebSocket 错误码定义
 * 统一管理所有 ws 错误状态码，便于前端统一处理和国际化
 */

// 通用错误码
export const CommonError = {
    INVALID_REQUEST: "INVALID_REQUEST",       // 无效请求
    NOT_IN_ROOM: "NOT_IN_ROOM",               // 不在房间中
    UNKNOWN_ERROR: "UNKNOWN_ERROR",           // 未知错误
} as const

// 用户相关错误码
export const UserError = {
    MISSING_USER: "MISSING_USER",             // 缺少用户信息
} as const

// 房间相关错误码
export const RoomError = {
    ROOM_NOT_FOUND: "ROOM_NOT_FOUND",         // 房间不存在
    ROOM_ALREADY_EXISTS: "ROOM_ALREADY_EXISTS", // 房间已存在
    ROOM_FULL: "ROOM_FULL",                   // 房间已满
    JOIN_FAILED: "JOIN_FAILED",               // 加入房间失败
} as const

// 游戏相关错误码
export const GameError = {
    GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED", // 游戏已开始
    GAME_NOT_STARTED: "GAME_NOT_STARTED",         // 游戏未开始
    PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",         // 玩家不存在
    ACTION_FAILED: "ACTION_FAILED",               // 操作失败
    NOT_YOUR_TURN: "NOT_YOUR_TURN",               // 还没轮到你
    INVALID_ACTION: "INVALID_ACTION",             // 无效操作
    INVALID_CARD: "INVALID_CARD",                 // 无效卡牌
} as const

// 聊天相关错误码
export const ChatError = {
    NOT_LOGGED_IN: "NOT_LOGGED_IN",               // 未登录
} as const

// 导出所有错误码的联合类型
export type WsErrorCode =
    | typeof CommonError[keyof typeof CommonError]
    | typeof UserError[keyof typeof UserError]
    | typeof RoomError[keyof typeof RoomError]
    | typeof GameError[keyof typeof GameError]

// 便捷导出，方便直接引用
export const WsError = {
    ...CommonError,
    ...UserError,
    ...RoomError,
    ...GameError,
    ...ChatError,
} as const

export type WsErrorType = keyof typeof WsError
