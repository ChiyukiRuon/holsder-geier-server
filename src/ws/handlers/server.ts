import {HandlerMap, send} from "../wsRouter"
import packageJson from '../../../package.json';

export const serverHandlers: HandlerMap = {
    "server.info": async (ctx, msg) => {
        send(ctx, "server.info", {
            service: "Holsder Geier Websocket Service",
            version: packageJson.version,
            environment: process.env.RUNTIME_ENV || "-"
        })
    },
}
