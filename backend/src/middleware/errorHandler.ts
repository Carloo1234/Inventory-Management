import type { Request, Response, NextFunction } from "express";
import { AppError, FormError } from "../utils/AppError";

export class ErrorHandler {
    handleErrors = (error: Error, req: Request, res: Response, next: NextFunction) => {
        // Handle form errors before app errors because FormError is a subclass of AppError
        if (error instanceof FormError) {
            return res.status(400).json({ status: "Bad Request", message: "Validation Error", errors: error.errors });
        }

        if (error instanceof AppError) {
            return res.status(error.status_code).json({
                status: "error",
                message: error.message,
            });
        }

        console.error(error); // log the real error server-side
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
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
