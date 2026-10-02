import axios from "axios";
import { createResponseSchema, validateDataWithSchema, type ResponseStructure } from "./response";
import { toast } from "sonner";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});
declare module "axios" {
    export interface AxiosResponse<T = any, D = any> {
        // Add your custom properties here
        validResponse?: ResponseStructure<any>;
    }
}

export interface UploadResult {
    status: number;
    data: ResponseStructure<any> | null;
}

/**
 * Resolves a stored image URL to a fetchable absolute URL. Backend stores
 * root-relative paths ("/uploads/...") and remote URLs alike; the former
 * must be anchored at the API origin, because the browser would otherwise
 * resolve them against the frontend origin (:5173) and 404.
 */
export function resolvePublicUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    const base = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
    return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * Multipart upload helper. Uses native fetch (not the axios instance) because
 * axios would send its default `Content-Type: application/json` header and
 * break the multipart boundary the browser would otherwise set itself.
 * Cookies ride along via credentials:include (same httpOnly session).
 */
export async function uploadForm(url: string, form: FormData): Promise<UploadResult> {
    // VITE_API_URL ends with "/" and paths start with "/" — strip one side so
    // we never produce "//shops/..." (Express treats that as a different route → 404).
    const base = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
    const response = await fetch(`${base}${url}`, {
        method: "POST",
        credentials: "include",
        body: form,
    });
    let data: ResponseStructure<any> | null = null;
    try {
        data = (await response.json()) as ResponseStructure<any>;
    } catch {
        data = null;
    }
    return { status: response.status, data };
}

api.interceptors.response.use((response) => {
    const validatedData = validateDataWithSchema(response.data, createResponseSchema());
    if (!validatedData) {
        return response;
    }
    response.validResponse = validatedData;
    const toastData = validatedData.toast;
    if (!toastData) return response;
    if (toastData.type === "success") {
        toast.success(toastData.message);
    } else if (toastData.type === "error") {
        toast.error(toastData.message);
    } else if (toastData.type === "warning") {
        toast.warning(toastData.message);
    } else if (toastData.type === "info") {
        toast.info(toastData.message);
    }
    return response;
});
