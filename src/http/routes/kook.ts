import { Router } from "express"
import {badRequest, internalError, success} from "../utils/response";
import {createKookClient, post} from "../axios";

const router = Router()

interface KookError {
    code: string
    message: string
    data?: unknown
}

interface AccessToken {
    access_token: string
    expires_in: number
    token_type: string
    scope: string
}

router.get("/user", async (req, res) => {
    const {code, redirectUrl} = req.query

    if (!code || !redirectUrl) return badRequest(res, "Invalid query")

    try {
        const token = await post<AccessToken>(createKookClient(), "/oauth2/token", {
            grant_type: 'authorization_code',
            client_id: process.env.KOOK_BOT_ID,
            client_secret: process.env.KOOK_BOT_SECRET,
            code: code,
            redirect_uri: redirectUrl,
        })

        const userInfo = await post(createKookClient(token.access_token), "/v3/user/me", {}, {
            headers: {
                Authorization: `Bearer ${token.access_token}`,
            }
        })

        return success(res, userInfo)
    } catch (error) {
        const kookError = error as KookError
        console.error('获取用户 AccessToken 时出现错误:', kookError)

        if (kookError.message === "Authorization code doesn't exist or is invalid for the client") {
            return badRequest(res, "Invalid code")
        }
        return internalError(res)
    }
})

export default router
