export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export enum LogCategory {
    SERVER = "SERVER",
    WS = "WS",
    ROOM = "ROOM",
    GAME = "GAME",
    CHAT = "CHAT",
    HTTP = "HTTP",
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: "DBG",
    [LogLevel.INFO]: "INF",
    [LogLevel.WARN]: "WRN",
    [LogLevel.ERROR]: "ERR",
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: "\x1b[36m",   // 青色
    [LogLevel.INFO]: "\x1b[32m",   // 绿色
    [LogLevel.WARN]: "\x1b[33m",    // 黄色
    [LogLevel.ERROR]: "\x1b[31m",  // 红色
}

const RESET_COLOR = "\x1b[0m"

export const logLevel = (level: string) => {
    switch (level) {
        case "DEBUG":
            return LogLevel.DEBUG
        case "INFO":
            return LogLevel.INFO
        case "WARN":
            return LogLevel.WARN
        case "ERROR":
            return LogLevel.ERROR
        default:
            return LogLevel.INFO
    }
}

class Logger {
    private minLevel: LogLevel = LogLevel.INFO
    private enableColors: boolean = true

    setLevel(level: LogLevel) {
        this.minLevel = level
    }

    setEnableColors(enable: boolean) {
        this.enableColors = enable
    }

    private formatTime(): string {
        const now = new Date()
        const pad = (n: number) => n.toString().padStart(2, "0")
        return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds())}`
    }

    private formatMessage(level: LogLevel, category: LogCategory, message: string, meta?: any): string {
        const time = this.formatTime()
        const levelName = LOG_LEVEL_NAMES[level]
        const color = this.enableColors ? LOG_LEVEL_COLORS[level] : ""
        const reset = this.enableColors ? RESET_COLOR : ""

        const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : ""

        return `${color}[${time}] [${levelName}] [${category}] ${message}${metaStr}${reset}`
    }

    debug(category: LogCategory, message: string, meta?: any) {
        if (this.minLevel > LogLevel.DEBUG) return
        console.log(this.formatMessage(LogLevel.DEBUG, category, message, meta))
    }

    info(category: LogCategory, message: string, meta?: any) {
        if (this.minLevel > LogLevel.INFO) return
        console.log(this.formatMessage(LogLevel.INFO, category, message, meta))
    }

    warn(category: LogCategory, message: string, meta?: any) {
        if (this.minLevel > LogLevel.WARN) return
        console.warn(this.formatMessage(LogLevel.WARN, category, message, meta))
    }

    error(category: LogCategory, message: string, meta?: any) {
        if (this.minLevel > LogLevel.ERROR) return
        console.error(this.formatMessage(LogLevel.ERROR, category, message, meta))
    }

    // 便捷方法 - 简化调用
    server(message: string, meta?: any) {
        this.info(LogCategory.SERVER, message, meta)
    }

    ws(message: string, meta?: any) {
        this.info(LogCategory.WS, message, meta)
    }

    room(message: string, meta?: any) {
        this.info(LogCategory.ROOM, message, meta)
    }

    game(message: string, meta?: any) {
        this.info(LogCategory.GAME, message, meta)
    }

    chat(message: string, meta?: any) {
        this.debug(LogCategory.CHAT, message, meta)
    }

    http(message: string, meta?: any) {
        this.info(LogCategory.HTTP, message, meta)
    }

    // 分类专用的 warn/error 方法
    serverWarn(message: string, meta?: any) {
        this.warn(LogCategory.SERVER, message, meta)
    }

    wsWarn(message: string, meta?: any) {
        this.warn(LogCategory.WS, message, meta)
    }

    roomWarn(message: string, meta?: any) {
        this.warn(LogCategory.ROOM, message, meta)
    }

    gameWarn(message: string, meta?: any) {
        this.warn(LogCategory.GAME, message, meta)
    }

    chatWarn(message: string, meta?: any) {
        this.warn(LogCategory.CHAT, message, meta)
    }

    httpWarn(message: string, meta?: any) {
        this.warn(LogCategory.HTTP, message, meta)
    }

    serverError(message: string, meta?: any) {
        this.error(LogCategory.SERVER, message, meta)
    }

    wsError(message: string, meta?: any) {
        this.error(LogCategory.WS, message, meta)
    }

    roomError(message: string, meta?: any) {
        this.error(LogCategory.ROOM, message, meta)
    }

    gameError(message: string, meta?: any) {
        this.error(LogCategory.GAME, message, meta)
    }

    chatError(message: string, meta?: any) {
        this.error(LogCategory.CHAT, message, meta)
    }

    httpError(message: string, meta?: any) {
        this.error(LogCategory.HTTP, message, meta)
    }
}

export const logger = new Logger()
