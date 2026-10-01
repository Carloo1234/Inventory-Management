import z from "zod";

export const createAttributeNameSchema = z
    .object({ name: z.string().max(100, "Name cannot excced 100 characters") })
    .strict();

export const createAttributeValueSchema = z
    .object({ value: z.string().max(100, "Value cannot excced 100 characters") })
    .strict();

// This can even fully replace createAttributeName endpoint cuz u can pass empty values array and just create name.
export const createAttributeNameValuesSetSchema = z.object({
    name: z.string().max(100, "Name cannot excced 100 characters"),
    values: z.array(z.string().max(100, "Value cannot excced 100 characters")),
});

export const updateAttributeNameSchema = z
    .object({ name: z.string().trim().min(1, "Name cannot be empty.").max(100, "Name cannot excced 100 characters").optional() })
    .strict();

export const updateAttributeValueSchema = z
    .object({ value: z.string().trim().min(1, "Value cannot be empty.").max(100, "Value cannot excced 100 characters").optional() })
    .strict();
