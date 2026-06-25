import type { ZodError } from "zod";

export class AppError extends Error {
    public status_code: number;
    constructor(message: string, status_code: number) {
        super(message);
        this.status_code = status_code;

        Error.captureStackTrace(this, this.constructor);
    }
}

export interface CleanErrors {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
}

export class FormError extends AppError {
    public errors: CleanErrors;
    constructor(message: string, status_code: number, errors: CleanErrors) {
        super(message, status_code);
        this.status_code = status_code;
        this.errors = errors;

        Error.captureStackTrace(this, this.constructor);
    }

    static createFromZodError(error: ZodError) {
        const errors: { path: string; message: string }[] = [];
        for (const issue of error.issues) {
            const path = issue.path.length > 0 ? issue.path.join(".") : "_form";
            errors.push({ path, message: issue.message });
        }
        // Clean up errors
        const cleanedErrors: CleanErrors = {
            formErrors: [],
            fieldErrors: {},
        };
        for (const e of errors) {
            if (e.path === "_form") {
                cleanedErrors.formErrors.push(e.message);
            } else if (Object.hasOwn(cleanedErrors.fieldErrors, e.path)) {
                cleanedErrors.fieldErrors[e.path]?.push(e.message);
            } else {
                cleanedErrors.fieldErrors[e.path] = [e.message];
            }
        }
        return new FormError("Validation Error", 400, cleanedErrors);
    }
}
