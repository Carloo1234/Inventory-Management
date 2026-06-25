import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export class ErrorHandler {
    handleErrors = (error: Error, req: Request, res: Response, next: NextFunction) => {
        if (error instanceof AppError) {
            res.status(error.status_code).json({
                status: "error",
                message: error.message,
            });
            return;
        }

        console.error(error); // log the real error server-side
        res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    };
}
