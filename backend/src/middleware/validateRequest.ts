import { z, ZodError } from "zod";
import { FormError } from "../utils/AppError";
import type { Request, Response, NextFunction } from "express";
export function validateRequest(schema: z.ZodType) {
    return (req: Request, res: Response, next: NextFunction) => {
        // If the request is invalid, this line throws ZodError which goes to main error handler.
        try {
            const cleanReqBody = schema.parse(req.body);
            req.body = cleanReqBody;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                throw FormError.createFromZodError(error);
            }
            throw error;
        }
    };
}
