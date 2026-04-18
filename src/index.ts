import dotenv from "dotenv";
import http from "http"
import { createApp } from "./http/app"
import { createWsServer } from "./ws/wsServer"
import {logger, logLevel, LogLevel} from "./utils/logger"

dotenv.config();

const PORT = process.env.PORT || 47381
const LOG_LEVEL = process.env.LOG_LEVEL || "INFO"

async function bootstrap() {
    logger.setLevel(logLevel(LOG_LEVEL))

    const app = createApp()

    const server = http.createServer(app)

    createWsServer(server)

    server.listen(PORT, () => {
        logger.server(`Server started`, { port: PORT, url: `http://localhost:${PORT}` })
    })
}

bootstrap()
