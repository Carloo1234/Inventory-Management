import z from "zod";

export interface CleanErrors {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
}
interface Toast {
    type: "success" | "error" | "warning" | "info";
    message: string;
}
interface Redirect {
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

const cleanErrorsSchema = z.object({
    formErrors: z.array(z.string()),
    fieldErrors: z.record(z.string(), z.array(z.string())),
});

const toastSchema = z.object({
    type: z.enum(["success", "error", "warning", "info"]),
    message: z.string(),
});

const redirectSchema = z.object({
    name: z.string(),
    params: z.record(z.string(), z.any()).nullable(),
});

// Reusable Envelope Schema Factory
export function createResponseSchema<T extends z.ZodTypeAny>(dataSchema?: T) {
    if (!dataSchema)
        return z.object({
            success: z.boolean(),
            data: z.any(),
            formErrors: cleanErrorsSchema.nullable(),
            toast: toastSchema.nullable(),
            redirect: redirectSchema.nullable(),
        });
    return z.object({
        success: z.boolean(),
        data: dataSchema.nullable(),
        formErrors: cleanErrorsSchema.nullable(),
        toast: toastSchema.nullable(),
        redirect: redirectSchema.nullable(),
    });
}

export function validateDataWithSchema<T extends z.ZodType>(data: unknown, schema: T) {
    const result = schema.safeParse(data);
    if (result.success) {
        return result.data;
    } else {
        console.log("Validation errors:", result.error.format());
        return undefined;
    }
}
