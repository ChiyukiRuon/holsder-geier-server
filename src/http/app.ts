import express from "express"
import cors from "cors";
import kookRoutes from "./routes/kook"
import fileRoutes from "./routes/file"
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import {success} from "./utils/response";
import packageJson from "../../package.json";

export function createApp() {
    const app = express()

    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    app.use(cors())

    app.use("/kook", kookRoutes)
    app.use("/file", fileRoutes)
    app.use("/info", (req, res) => {
        return success(res, {
            service: "Holsder Geier Http Service",
            version: packageJson.version,
            environment: process.env.RUNTIME_ENV || "-",
            serverTime: Date.now(),
        })
    })

    app.use(notFoundHandler)
    app.use(errorHandler)

    return app
}
