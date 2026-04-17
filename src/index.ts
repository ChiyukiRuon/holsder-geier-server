import dotenv from "dotenv";
import http from "http"
import { createApp } from "./http/app"
import { createWsServer } from "./ws/wsServer"
import { logger, LogLevel } from "./utils/logger"

dotenv.config();

const PORT = process.env.PORT || 47381

async function bootstrap() {
    logger.setLevel(LogLevel.DEBUG)

    const app = createApp()

    const server = http.createServer(app)

    createWsServer(server)

    server.listen(PORT, () => {
        logger.server(`Server started`, { port: PORT, url: `http://localhost:${PORT}` })
    })
}

bootstrap()
