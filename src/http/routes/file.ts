import { Router, Request, Response } from "express"
import multer from "multer"
import { success, created, badRequest } from "../utils/response"
import { upload as cosUpload, remove as cosRemove, getPublicUrl, getSignedUrl, isExist as cosFileExist } from "../cos"

const router = Router()

interface MulterRequest extends Request {
    file?: Express.Multer.File
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true)
        } else {
            cb(new Error("Only image files are allowed"))
        }
    },
})

/**
 * 上传图片
 * POST /file/images
 */
router.post("/images", upload.single("file"), async (req: MulterRequest, res: Response) => {
    const file = req.file
    const {usage} = req.body
    console.log("Uploaded file:", usage)

    if (!file) {
        return badRequest(res, "No file uploaded")
    }

    if (!usage) {
        return badRequest(res, "Missing usage")
    } else if (usage !== "avatar" && usage !== "background") {
        return badRequest(res, "Invalid usage")
    }

    const ext = file.mimetype.split("/")[1] || "png"
    const key = `hdg/${usage}/${crypto.randomUUID()}.${ext}`

    try {
        const result = await cosUpload({
            key,
            body: file.buffer,
            contentType: file.mimetype,
            contentLength: file.size,
        })

        return created(res, {
            // url: result.url,
            key: result.key,
            etag: result.etag,
            size: file.size,
            mimetype: file.mimetype,
        }, "Image uploaded")
    } catch (err) {
        console.error("Upload error:", err)
        const message = err instanceof Error ? err.message : "Failed to upload file"
        return badRequest(res, message)
    }
})

/**
 * 获取图片URL
 * GET /file/images/:key
 */
router.get("/images/:key", async (req: Request, res: Response) => {
    const key = req.params.key as string

    if (!key) {
        return badRequest(res, "Missing file key")
    }

    try {
        const exists = await cosFileExist(key)
        if (!exists) {
            return res.status(404).json({ code: 404, message: "File not found", timestamp: Date.now() })
        }

        const url = getPublicUrl(key)
        return success(res, { url, key })
    } catch (err) {
        return badRequest(res, "Failed to get file info")
    }
})

/**
 * 获取图片签名URL（临时访问）
 * GET /file/images/:key/signed?expires=3600
 */
router.get("/images/:key/signed", async (req: Request, res: Response) => {
    const key = req.params.key as string
    const expires = parseInt((req.query.expires as string) || "3600")

    if (!key) {
        return badRequest(res, "Missing file key")
    }

    try {
        const url = await getSignedUrl(key, expires)
        return success(res, { url, expires })
    } catch (err) {
        return badRequest(res, "Failed to generate signed url")
    }
})

/**
 * 删除图片
 * DELETE /file/images/:key
 */
router.delete("/images/:key", async (req: Request, res: Response) => {
    const key = req.params.key as string

    if (!key) {
        return badRequest(res, "Missing file key")
    }

    try {
        await cosRemove(key)
        return success(res, { key }, "Image deleted")
    } catch (err) {
        return badRequest(res, "Failed to delete file")
    }
})

/**
 * 批量删除图片
 * POST /file/images/batch-delete
 */
router.post("/images/batch-delete", async (req: Request, res: Response) => {
    const { keys } = req.body as { keys: string[] }

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return badRequest(res, "Invalid keys")
    }

    try {
        await Promise.all(keys.map(key => cosRemove(key)))
        return success(res, { deleted: keys.length }, "Images deleted")
    } catch (err) {
        return badRequest(res, "Failed to delete files")
    }
})

export default router
