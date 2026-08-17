import z from "zod";

export const createShopSchema = z
    .object({
        name: z
            .string("Shop name is required")
            .trim()
            .min(1, "Shop name can not be empty.")
            .max(255, "Name can not exceed 255 characters"),
    })
    .strict();

export const patchShopSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Shop name can not be empty.")
            .max(255, "Name can not exceed 255 characters")
            .optional(),
    })
    .strict();

export type PatchShopBody = z.infer<typeof patchShopSchema>;

export interface Shop {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    ownerId: string;
    softDelete: boolean;
    isOwner: boolean;
    managerPermissions: string[] | null;
}
