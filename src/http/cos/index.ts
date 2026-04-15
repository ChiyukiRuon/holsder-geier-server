import COS from 'cos-nodejs-sdk-v5';
import { config } from './config';
import { Readable } from 'stream';

let cosInstance: COS | null = null;

const getCosInstance = (): COS => {
    if (!cosInstance) {
        cosInstance = new COS({
            SecretId: config.SecretId,
            SecretKey: config.SecretKey,
            Protocol: "https:",
            ForceSignHost: config.ForceSignHost,
        });
    }
    return cosInstance;
};

export interface UploadOptions {
    /** 对象存储的路径，例如 'images/avatar.png' */
    key: string;
    /** 文件内容，可以是 Buffer、ReadableStream 或 string */
    body: Buffer | Readable | string;
    /** 文件内容的 MIME 类型 */
    contentType?: string;
    /** 文件大小（字节） */
    contentLength?: number;
}

export interface UploadResult {
    /** 文件的 URL */
    url: string;
    /** 对象的存储路径 */
    key: string;
    /** ETag */
    etag: string;
}

export interface DeleteResult {
    /** 是否删除成功 */
    success: boolean;
}

/**
 * 上传文件到腾讯云COS
 */
const upload = (options: UploadOptions): Promise<UploadResult> => {
    const { key, body, contentType, contentLength } = options;

    return new Promise((resolve, reject) => {
        getCosInstance().putObject(
            {
                Bucket: config.Bucket,
                Region: config.Region,
                Key: key,
                Body: body,
                ContentType: contentType,
                ContentLength: contentLength,
                onProgress: function(progressData) {
                    console.log(JSON.stringify(progressData));
                }
            },
            (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({
                    url: data.Location,
                    key: key,
                    etag: data.ETag,
                });
            }
        );
    });
};

/**
 * 删除COS中的文件
 */
const remove = (key: string): Promise<DeleteResult> => {
    return new Promise((resolve, reject) => {
        getCosInstance().deleteObject(
            {
                Bucket: config.Bucket,
                Region: config.Region,
                Key: key,
            },
            (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ success: true });
            }
        );
    });
};

/**
 * 获取文件的签名URL（用于临时访问）
 */
const getSignedUrl = (key: string, expires: number = 3600): Promise<string> => {
    return new Promise((resolve, reject) => {
        getCosInstance().getObjectUrl(
            {
                Bucket: config.Bucket,
                Region: config.Region,
                Key: key,
                Expires: expires,
            },
            (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data.Url);
            }
        );
    });
};

/**
 * 检查文件是否存在
 */
const isExist = (key: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        getCosInstance().headObject(
            {
                Bucket: config.Bucket,
                Region: config.Region,
                Key: key,
            },
            (err) => {
                if (err) {
                    if ((err as unknown as { statusCode: number }).statusCode === 404) {
                        resolve(false);
                        return;
                    }
                    reject(err);
                    return;
                }
                resolve(true);
            }
        );
    });
};

/**
 * 获取文件列表
 */
const getFileList = (prefix: string = '', maxResults: number = 100): Promise<any> => {
    return new Promise((resolve, reject) => {
        getCosInstance().getBucket(
            {
                Bucket: config.Bucket,
                Region: config.Region,
                Prefix: prefix,
                MaxKeys: maxResults,
            },
            (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
            }
        );
    });
};

/**
 * 获取文件的公开URL
 */
const getPublicUrl = (key: string): string => {
    return `https://${config.Domain}/${key}`;
};

export { upload, remove, getSignedUrl, isExist, getFileList, getPublicUrl };
