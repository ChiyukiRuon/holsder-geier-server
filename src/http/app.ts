import express from "express"
import cors from "cors";
import kookRoutes from "./routes/kook"
import fileRoutes from "./routes/file"
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import multer from "multer"

export function createApp() {
    const app = express()

    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    app.use(cors())

    app.use("/kook", kookRoutes)
    app.use("/file", fileRoutes)

    app.use(notFoundHandler)
    app.use(errorHandler)

    return app
}
