import { z } from "zod";

export const signupSchema = z
    .object({
        name: z.string("Name is required").max(255, "Must be less than 256 characters long"),
        email: z.email("Must be in the format example@mail.com").max(255, "Must be less than 256 characters long"),
        password: z
            .string("Password is required")
            .min(8, "Password must be at least 8 characters long")
            .regex(/[A-Za-z]/, "Password must contain at least one letter")
            .regex(/[0-9]/, "Password must contain at least one number")
            .max(255, "Password must be less than 255 characters."),
        confirm: z.string({ error: "Password is required" }),
    })
    .refine((data) => data.password === data.confirm, { error: "Passwords don't match", path: ["confirm"] })
    .strict();

export const signinSchema = z
    .object({
        email: z.email("Must be in the format example@mail.com").max(255, "Must be less than 256 characters long"),
        password: z.string("Password is required").max(255, "Password must be less than 255 characters."),
    })
    .strict();
