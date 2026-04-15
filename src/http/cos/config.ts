import dotenv from "dotenv"

dotenv.config()

export const config = {
    SecretId: process.env.TXCLOUD_SECRET_ID || '',
    SecretKey: process.env.TXCLOUD_SECRET_KEY || '',
    Bucket: process.env.COS_BUCKET || '',
    Region: process.env.COS_REGION || '',
    Domain: process.env.COS_DOMAIN || '',
    ForceSignHost: process.env.COS_FORCE_SIGN_HOST === 'true',
};
