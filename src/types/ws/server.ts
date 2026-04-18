export interface PingPayload {
    serverTime: number
    latencies?: Array<{ userId: string; latency: number }>
}

export interface PongPayload {
    pingTime: number
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
    environment: "production" | "development" | "test" | string,
    serverTime: number
}

export interface ToastPayload {
    message: string
    type: "info" | "success" | "warning" | "danger"
}
