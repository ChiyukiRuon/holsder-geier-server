import { Response } from "express";

export interface ApiResponse<T = unknown> {
    code: number;
    message: string;
    data?: T;
    timestamp: number;
}

export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    INTERNAL_SERVER_ERROR = 500,
}

const DEFAULT_MESSAGES: Record<number, string> = {
    [HttpStatus.OK]: "Success",
    [HttpStatus.CREATED]: "Created",
    [HttpStatus.BAD_REQUEST]: "Bad Request",
    [HttpStatus.UNAUTHORIZED]: "Unauthorized",
    [HttpStatus.FORBIDDEN]: "Forbidden",
    [HttpStatus.NOT_FOUND]: "Not Found",
    [HttpStatus.INTERNAL_SERVER_ERROR]: "Internal Server Error",
};

function formatResponse<T>(
    res: Response,
    code: number,
    message: string,
    data?: T,
    status: number = code
): Response {
    const response: ApiResponse<T> = {
        code,
        message,
        timestamp: Date.now(),
    };

    if (data !== undefined) {
        response.data = data;
    }

    return res.status(status).json(response);
}

export function success<T>(res: Response, data?: T, message: string = "Success"): Response {
    return formatResponse(res, HttpStatus.OK, message, data);
}

export function created<T>(res: Response, data?: T, message: string = "Created"): Response {
    return formatResponse(res, HttpStatus.CREATED, message, data, HttpStatus.CREATED);
}

export function badRequest(res: Response, message: string = "Bad Request", data?: unknown): Response {
    return formatResponse(res, HttpStatus.BAD_REQUEST, message, data, HttpStatus.BAD_REQUEST);
}

export function unauthorized(res: Response, message: string = "Unauthorized"): Response {
    return formatResponse(res, HttpStatus.UNAUTHORIZED, message, undefined, HttpStatus.UNAUTHORIZED);
}

export function forbidden(res: Response, message: string = "Forbidden"): Response {
    return formatResponse(res, HttpStatus.FORBIDDEN, message, undefined, HttpStatus.FORBIDDEN);
}

export function notFound(res: Response, message: string = "Not Found"): Response {
    return formatResponse(res, HttpStatus.NOT_FOUND, message, undefined, HttpStatus.NOT_FOUND);
}

export function internalError(res: Response, message: string = "Internal Server Error"): Response {
    return formatResponse(res, HttpStatus.INTERNAL_SERVER_ERROR, message, undefined, HttpStatus.INTERNAL_SERVER_ERROR);
}

export function error(res: Response, status: number, message: string): Response {
    const httpStatus = Object.values(HttpStatus).includes(status) ? status : HttpStatus.INTERNAL_SERVER_ERROR;
    const msg = DEFAULT_MESSAGES[httpStatus] || message;
    return formatResponse(res, httpStatus, message, undefined, httpStatus);
}
