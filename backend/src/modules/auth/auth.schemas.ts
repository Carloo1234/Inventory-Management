import { z } from "zod";

export const signupSchema = z
    .object({
        name: z.string({ error: "Name is required" }).max(255, { error: "Must be less than 256 characters long" }),
        email: z
            .email({ error: "Must be in the format example@mail.com" })
            .max(255, { error: "Must be less than 256 characters long" }),
        password: z
            .string({ error: "Password is required" })
            .min(8, { message: "Password must be at least 8 characters long" })
            .regex(/[A-Za-z]/, { message: "Password must contain at least one letter" })
            .regex(/[0-9]/, { message: "Password must contain at least one number" }),
        confirm: z.string({ error: "Password is required" }),
    })
    .refine((data) => data.password === data.confirm, { error: "Passwords don't match", path: ["confirm"] });

export const signinSchema = z.object({
    email: z
        .email({ error: "Must be in the format example@mail.com" })
        .max(255, { error: "Must be less than 256 characters long" }),
    password: z.string({ error: "Password is required" }),
});
