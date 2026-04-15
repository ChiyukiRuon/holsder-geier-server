import axios, { AxiosInstance, AxiosResponse } from "axios";
import dotenv from "dotenv";

dotenv.config();

const handleError = (error: { response?: { data: unknown }; message: string }) =>
    Promise.reject(error.response?.data || error.message);

const createKookClient = (token?: string) => {
    const client = axios.create({
        baseURL: process.env.KOOK_API,
        headers: {
            'Accept-Language': 'zh-cn',
            'Authorization': `${token ? `Bearer ${token}` : `Bot ${process.env.KOOK_BOT_TOKEN}`}`
        }
    });

    client.interceptors.response.use(handleKookResponse, handleError);

    return client;
};

const handleKookResponse = (response: AxiosResponse) => {
    const isOAuthToken = response.config.url === '/oauth2/token' && response.data?.access_token;
    if (response.data?.code === 0 || isOAuthToken) {
        return response;
    }
    throw response.data;
};

interface RequestOptions {
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
}

const get = <T = unknown>(client: AxiosInstance, url: string, options: RequestOptions = {}) =>
    client.get<T>(url, { params: options.params, headers: options.headers }).then((res: AxiosResponse<T>) => res.data);

const post = <T = unknown>(client: AxiosInstance, url: string, data: Record<string, unknown> = {}, options: RequestOptions = {}) =>
    client.post<T>(url, data, { headers: options.headers }).then((res: AxiosResponse<T>) => res.data);

const uploadFile = (client: AxiosInstance, url: string, file: File | Blob, params: Record<string, string> = {}, headers: Record<string, string> = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(params).forEach(([key, value]) => formData.append(key, value));

    return client.post(url, formData, { headers }).then((res: AxiosResponse) => {
        if (res.data?.code !== 0) {
            return Promise.reject(res.data);
        }
        return res;
    });
};

export { createKookClient, get, post, uploadFile };
