import z from "zod";

// One sellable unit. Frontend always sends >= 1 variant per product.
export const createProductVariantSchema = z
    .object({
        sku: z.string().trim().min(1, "SKU cannot be empty.").max(16, "SKU cannot exceed 16 characters"),
        barcode: z.string().trim().max(14, "Barcode cannot exceed 14 characters").optional(),
        price: z
            .string()
            .regex(/^\d+(\.\d+)?$/, {
                message: "Must be a positive number or zero",
            })
            // numeric(12,2) overflows past 9999999999.99 — reject before Postgres does.
            .refine((v) => Number(v) <= 9999999999.99, { message: "Price is too large" }),
        quantity: z.number("Quantity must be a number").int("Quantity must be a whole number"),
        attributeValueIds: z.array(z.string()).default([]),
    })
    .strict();

export const createProductSchema = z
    .object({
        name: z.string().trim().min(1, "Product name cannot be empty.").max(255, "Name cannot exceed 255 characters"),
        description: z.string().max(2000, "Description cannot exceed 2000 characters").optional(),
        variants: z.array(createProductVariantSchema).min(1, "A product needs at least one variant"),
    })
    .strict();

// Variant upsert on update: id present = update existing, absent = create new.
export const updateProductVariantSchema = z
    .object({
        id: z.string().optional(),
        sku: z.string().trim().min(1, "SKU cannot be empty.").max(16, "SKU cannot exceed 16 characters").optional(),
        barcode: z.string().trim().max(14, "Barcode cannot exceed 14 characters").optional(),
        price: z
            .string()
            .regex(/^\d+(\.\d+)?$/, {
                message: "Must be a positive number or zero",
            })
            .refine((v) => Number(v) <= 9999999999.99, { message: "Price is too large" })
            .optional(),
        quantity: z.number("Quantity must be a number").int("Quantity must be a whole number").optional(),
        attributeValueIds: z.array(z.string()).optional(),
    })
    .strict();

export const updateProductSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Product name cannot be empty.")
            .max(255, "Name cannot exceed 255 characters")
            .optional(),
        description: z.string().max(2000, "Description cannot exceed 2000 characters").nullable().optional(),
        variants: z.array(updateProductVariantSchema).optional(),
    })
    .strict();

// List filters (?page=&limit=&search=&sortBy=&sortOrder=). Query strings arrive
// as text, hence coerce. Deliberately NOT .strict(): clients append harmless
// extras (cache-busters, analytics tags) that must not 400 the list.
// sortBy is intentionally narrow: variant-level fields have no single
// sortable value on multi-variant products (see repository).
export const productsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Flat variants list (?page=&limit=&search=&sortBy=&sortOrder=&barcode=).
// barcode is an exact match for the scanner flow and bypasses search.
export const productVariantsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    sortBy: z.enum(["sku", "price", "quantity", "createdAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    barcode: z.string().trim().max(14).optional(),
});

// Attach an existing (externally hosted) image URL. variantId omitted means
// shared across the whole product. Multipart file upload arrives later and
// targets the same repository method, so this contract is already final.
export const attachProductImageSchema = z
    .object({
        url: z.string().trim().min(1, "URL cannot be empty.").max(2000, "URL cannot exceed 2000 characters"),
        variantId: z.string().optional(),
    })
    .strict();
