import type { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { AppError, FormError } from "../utils/AppError";
import { ApiResponse } from "../utils/apiResponse";

export class ErrorHandler {
    handleErrors = (error: Error, req: Request, res: Response, next: NextFunction) => {
        // Handle form errors before app errors because FormError is a subclass of AppError
        if (error instanceof FormError) {
            return ApiResponse.error(res, error.status_code, null, error.errors, {
                type: "error",
                message: "Invalid form entry. Please fix the highlighted fields and try again.",
            });
        }

        if (error instanceof AppError) {
            return ApiResponse.error(res, error.status_code, null, null, { type: "error", message: error.message });
        }

        // Multer upload failures (file too large, too many files): always the
        // caller's fault, never a 500. fileFilter rejections already arrive as
        // AppError and are handled above.
        console.log("DEBUG err:", error.constructor.name, (error as { code?: string }).code, error.message.slice(0, 160));
        if (error instanceof MulterError) {
            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? "Image must be smaller than 5MB"
                    : "Image upload failed, please try again";
            return ApiResponse.error(res, 400, null, null, { type: "error", message });
        }

        console.error(error); // log the real error server-side

        return ApiResponse.error(res, 500, null, null, { type: "error", message: "Internal server error" });
    };
}

/* Error output structure for validation errors:
{
  formErrors: ['Unrecognized key: "full_name"'],
  fieldErrors: {
    path1: [ 'Must be a string' ],
    path2: [ 'Must be a number' ]
  }
}
*/
