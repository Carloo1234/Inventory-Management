import z from "zod";
import { PERMISSIONS } from "../../utils/permissions";

export const createRoleSchema = z
    .object({
        name: z.string().trim().min(1, "Role name cannot be empty.").max(255, "Role name cannot exceed 255 characters"),
        permissions: z.array(z.enum([...Object.values(PERMISSIONS).map((p) => p.value)])).optional(),
    })
    .strict();

export const updateRoleSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Role name cannot be empty.")
            .max(255, "Role name cannot exceed 255 characters")
            .optional(),
        permissions: z.array(z.enum([...Object.values(PERMISSIONS).map((p) => p.value)])).optional(),
    })
    .strict();
