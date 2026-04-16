import {UserInfo} from "./user";

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface RoomCreatePayload {
    roomId: string
    user?: UserInfo
}

export interface RoomJoinPayload {
    roomId: string
    user: UserInfo
    reconnect?: boolean  // 标识为重连请求
}

export interface RoomLeavePayload {}

export interface RoomListPayload {
    rooms: RoomInfo[]
}

export interface RoomInfo {
    roomId: string
    players: PlayerInfo[]
    status: RoomStatus
    maxPlayers: number
}

export interface RoomUpdatePayload {
    room: RoomInfo
}

export interface PlayerInfo {
    user: UserInfo;
    card: number[];
    point: {
        count: number;
        list: number[];
    };
    currentPlayerCard?: number;
    lastPlayerCard?: number;
    ready: boolean;
    latency: number | "offline" | null;
}
