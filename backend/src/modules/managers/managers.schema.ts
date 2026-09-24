import z from "zod";

export const updateManagerSchema = z
    .object({
        roleId: z.string().trim().min(1, "Role ID cannot be empty."),
    })
    .strict();
