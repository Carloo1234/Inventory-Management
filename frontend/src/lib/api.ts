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
