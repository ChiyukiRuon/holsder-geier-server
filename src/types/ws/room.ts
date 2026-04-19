import {UserInfo} from "./user";

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type RoomRole = 'player' | 'spectator';

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

export interface RoomRolePayload {
    role: RoomRole
}

export interface RoomInfo {
    roomId: string
    players: PlayerInfo[]
    spectators: PlayerInfo[]
    status: RoomStatus
    maxPlayers: number
}

export interface RoomUpdatePayload {
    room: RoomInfo
}

export interface PlayerInfo {
    user: UserInfo;
    role: RoomRole;
    card: number[];
    point: {
        count: number;
        list: number[];
    };
    currentPlayedCard: number |  null;
    lastPlayedCard: number | null;
    ready: boolean;
    latency: number;
}
