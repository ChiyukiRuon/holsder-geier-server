import dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";
import { unauthorized, forbidden } from "../utils/response";

dotenv.config();

const AUTH_TOKEN = process.env.AUTH_TOKEN || "your-secret-token";

/**
 * 需要鉴权的中间件
 */
export const authRequired = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers["c-auth-token"] as string | undefined;

    if (!token) {
        return unauthorized(res, "Missing token");
    }

    if (token !== AUTH_TOKEN) {
        return forbidden(res, "Invalid token");
    }

    next()
}

