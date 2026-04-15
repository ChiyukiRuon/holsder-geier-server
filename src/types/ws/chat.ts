export interface ChatSendPayload {
    message: string
}

export interface ChatReceivePayload {
    userId: string
    message: string
    timestamp: number
}

export interface ChatSyncPayload {
    messages: ChatReceivePayload[]
}
