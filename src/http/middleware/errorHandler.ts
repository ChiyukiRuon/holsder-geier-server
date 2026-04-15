import { Request, Response, NextFunction } from "express";
import { internalError } from "../utils/response";

export interface HttpError extends Error {
    status?: number;
    code?: string;
}

export function errorHandler(
    err: HttpError,
    req: Request,
    res: Response,
    next: NextFunction
): Response {
    console.error(`[HTTP Error] ${req.method} ${req.path}:`, err);

    const status = err.status || 500;
    const message = err.message || "Internal Server Error";

    return internalError(res, message);
}

export function notFoundHandler(req: Request, res: Response): Response {
    return res.status(404).json({
        code: 404,
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: Date.now(),
    });
}
