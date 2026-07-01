import type { Response } from "express";
import type { CleanErrors } from "./AppError";
export class ApiResponse {
    static success(
        res: Response,
        status_code: number = 200,
        data: Record<string, any> | null = null,
        toast: Toast | null = null,
        redirect: Redirect | null = null,
    ) {
        const response: ResponseStructure = {
            success: true,
            data: data,
            formErrors: null,
            toast: toast,
            redirect: redirect,
        };

        res.status(status_code).json(response);
    }
    static error(
        res: Response,
        status_code = 500,
        data = null,
        formErrors: CleanErrors | null = null,
        toast: Toast | null = null,
        redirect: Redirect | null = null,
    ) {
        const response: ResponseStructure = {
            success: false,
            data: data,
            formErrors: formErrors,
            toast: toast,
            redirect: redirect,
        };

        res.status(status_code).json(response);
    }
}
export interface Toast {
    type: "success" | "error" | "warning" | "info";
    message: string;
}
export interface Redirect {
    name: string;
    params: Record<string, any> | null;
}

export interface ResponseStructure<T = any> {
    success: boolean;
    data: T | null;
    formErrors: CleanErrors | null; // Any form errors.
    toast: Toast | null;
    redirect: Redirect | null;
}
