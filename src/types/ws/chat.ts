import {UserInfo} from "./user";

export interface ChatSendPayload {
    user: UserInfo
    message: string
    timestamp: number
}

export interface ChatReceivePayload {
    user?: UserInfo
    type: 'system' | 'user'
    message: string
    timestamp: number
}

export interface ChatSyncPayload {
    messages: ChatReceivePayload[]
}
