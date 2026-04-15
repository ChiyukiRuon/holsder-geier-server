export interface PingPayload {
    serverTime: number
}

export interface PongPayload {
    clientTime: number
}

export interface AckPayload {
    requestId: string
}

export interface ErrorPayload {
    code: string
    message: string
    requestId?: string
}

export interface InfoPayload {
    service: string
    version: string
    environment: "production" | "development" | "test" | string
}
