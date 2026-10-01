import { z, ZodError } from "zod";
import { FormError } from "../utils/AppError";
import type { Request, Response, NextFunction } from "express";

// Twin of validateRequest for URL query strings. Query values always arrive
// as strings, so schemas must coerce (z.coerce.number() etc.).
// NOTE: Express 5 exposes req.query through a getter, so the cleaned result
// is stored on req.validatedQuery (see types/express.d.ts) — controllers
// read filters from there, never from req.query directly.
export function validateQuery(schema: z.ZodType) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.validatedQuery = schema.parse(req.query) as Record<string, unknown>;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                console.log("Validation error:", error.message);
                throw FormError.createFromZodError(error);
            }
            throw error;
        }
    };
}
