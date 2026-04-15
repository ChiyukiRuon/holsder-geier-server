import { roomHandlers } from "./room"
import { gameHandlers } from "./game"
import { chatHandlers } from "./chat"
import { userHandlers } from "./user"
import { serverHandlers } from "./server"

export const handlers = {
    ...roomHandlers,
    ...gameHandlers,
    ...chatHandlers,
    ...userHandlers,
    ...serverHandlers,
}
