import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { AttributeValuePicker } from "@/components/attribute-value-picker";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    useForm,
    useFieldArray,
    type SubmitHandler,
    type Control,
    type FieldErrors,
    type UseFormRegister,
    Controller,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { attributesQueryOptions, type ShopAttribute } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import axios from "axios";
import { PlusIcon, Trash2Icon } from "lucide-react";

// Mirrors the backend create schema: price is a numeric STRING (snake, not number).
const variantSchema = z.object({
    sku: z.string().trim().min(1, "SKU is required").max(16, "Max 16 characters"),
    barcode: z.string().trim().max(14, "Max 14 characters").optional(),
    price: z
        .string()
        .trim()
        .regex(/^\d+(\.\d+)?$/, "Must be a positive number")
        .refine((v) => Number(v) <= 9999999999.99, "Price is too large"),
    quantity: z.number({ error: "Quantity must be a number" }).int().min(0, "Can't be negative"),
    attributeValueIds: z.array(z.string()).default([]),
});

const productFormSchema = z.object({
    name: z.string().trim().min(1, "Product name is required").max(255, "Max 255 characters"),
    description: z.string().max(2000, "Max 2000 characters").optional(),
    variants: z.array(variantSchema).min(1, "At least one variant is required"),
});

type FormInput = z.input<typeof productFormSchema>;
type FormFields = z.infer<typeof productFormSchema>;

/**
 * Product creation form: name, description, and a dynamic list of variant rows.
 * Each variant row carries SKU/barcode/price/quantity plus one value picker
 * per shop attribute. Server-side per-variant errors (variants.N.field) arrive
 * as a 409 FormError and surface as a banner + toast.
 */
export function ProductForm({ shopId }: { shopId: string }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { data: attributes } = useQuery(attributesQueryOptions(shopId));

    const { register, handleSubmit, reset, control, formState } = useForm<FormInput, unknown, FormFields>({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: "",
            description: "",
            variants: [{ sku: "", barcode: "", price: "", quantity: 0, attributeValueIds: [] }],
        },
    });
    const { errors, isSubmitting } = formState;
    const { fields, append, remove } = useFieldArray({ control, name: "variants" });
    const [serverError, setServerError] = React.useState<string | null>(null);

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        setServerError(null);
        try {
            const payload = {
                ...data,
                description: data.description || undefined,
                variants: data.variants.map((v) => ({
                    ...v,
                    barcode: v.barcode || undefined,
                })),
            };
            const response = await api.post(`/shops/${shopId}/products`, payload);
            const productId = response.data?.data?.product?.id ?? response.validResponse?.data?.product?.id;
            toast.success(`Created product "${data.name}".`);
            await queryClient.invalidateQueries({ queryKey: ["products", shopId] });
            await queryClient.invalidateQueries({ queryKey: ["variants", shopId] });
            if (productId) {
                navigate({ to: "/shops/$shopId/products/$productId", params: { shopId, productId } });
            } else {
                navigate({ to: "/shops/$shopId/products", params: { shopId } });
            }
            reset();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const formErrors = error.response?.data?.formErrors;
                const fieldErrors: Record<string, string[]> | undefined = formErrors?.fieldErrors;
                if (fieldErrors) {
                    // Per-variant server errors: flatten to a readable banner.
                    const messages = Object.entries(fieldErrors).map(([path, msgs]) => `${path}: ${msgs.join(", ")}`);
                    setServerError(messages.join(" · "));
                } else {
                    setServerError(
                        error.response?.data?.toast?.message ||
                            formErrors?.formErrors?.[0] ||
                            "Failed to create product",
                    );
                }
                if (!fieldErrors) toast.error("Failed to create product");
            } else {
                setServerError("An unexpected error occurred.");
            }
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Field>
                <FieldLabel htmlFor="product-name">Product Name</FieldLabel>
                <Input {...register("name")} id="product-name" placeholder="e.g. Classic T-Shirt" />
                {errors.name && <span className="text-destructive text-xs mt-1">{errors.name.message}</span>}
            </Field>
            <Field>
                <FieldLabel htmlFor="product-description">Description (optional)</FieldLabel>
                <Input {...register("description")} id="product-description" placeholder="Short description..." />
                {errors.description && (
                    <span className="text-destructive text-xs mt-1">{errors.description.message}</span>
                )}
            </Field>

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Variants ({fields.length})</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ sku: "", barcode: "", price: "", quantity: 0, attributeValueIds: [] })}
                    >
                        <PlusIcon className="size-4" />
                        <span>Add Variant</span>
                    </Button>
                </div>
                {errors.variants?.root && (
                    <span className="text-destructive text-xs">{errors.variants.root.message}</span>
                )}
                {fields.map((field, index) => (
                    <VariantRow
                        key={field.id}
                        index={index}
                        attributes={attributes}
                        register={register}
                        control={control}
                        errors={errors}
                        onRemove={fields.length > 1 ? () => remove(index) : undefined}
                    />
                ))}
            </div>

            {serverError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</div>
            )}

            <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Spinner data-icon="inline-start" />
                            Creating...
                        </>
                    ) : (
                        "Create Product"
                    )}
                </Button>
            </div>
        </form>
    );
}

function VariantRow({
    index,
    attributes,
    register,
    control,
    errors,
    onRemove,
}: {
    index: number;
    attributes: ShopAttribute[] | undefined;
    register: UseFormRegister<FormInput>;
    control: Control<FormInput, unknown, FormFields>;
    errors: FieldErrors<FormFields>;
    onRemove?: () => void;
}) {
    const variantErrors = errors.variants?.[index];
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Variant {index + 1}</CardTitle>
                    {onRemove && (
                        <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="Remove variant">
                            <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
                <Field>
                    <FieldLabel htmlFor={`variants.${index}.sku`}>SKU</FieldLabel>
                    <Input
                        {...register(`variants.${index}.sku`)}
                        id={`variants.${index}.sku`}
                        placeholder="SHIRT-RED-M"
                    />
                    {typeof variantErrors?.sku?.message === "string" && (
                        <span className="text-destructive text-xs mt-1">{variantErrors.sku.message}</span>
                    )}
                </Field>
                <Field>
                    <FieldLabel htmlFor={`variants.${index}.barcode`}>Barcode (optional)</FieldLabel>
                    <Input
                        {...register(`variants.${index}.barcode`)}
                        id={`variants.${index}.barcode`}
                        placeholder="123456789012"
                    />
                    {typeof variantErrors?.barcode?.message === "string" && (
                        <span className="text-destructive text-xs mt-1">{variantErrors.barcode.message}</span>
                    )}
                </Field>
                <Field>
                    <FieldLabel htmlFor={`variants.${index}.price`}>Price</FieldLabel>
                    <Input
                        {...register(`variants.${index}.price`)}
                        id={`variants.${index}.price`}
                        placeholder="19.99"
                        inputMode="decimal"
                    />
                    {typeof variantErrors?.price?.message === "string" && (
                        <span className="text-destructive text-xs mt-1">{variantErrors.price.message}</span>
                    )}
                </Field>
                <Field>
                    <FieldLabel htmlFor={`variants.${index}.quantity`}>Quantity</FieldLabel>
                    <Input
                        {...register(`variants.${index}.quantity`, { valueAsNumber: true })}
                        id={`variants.${index}.quantity`}
                        type="number"
                        min={0}
                    />
                    {typeof variantErrors?.quantity?.message === "string" && (
                        <span className="text-destructive text-xs mt-1">{variantErrors.quantity.message}</span>
                    )}
                </Field>
                <Controller
                    control={control}
                    name={`variants.${index}.attributeValueIds`}
                    render={({ field }) => (
                        <AttributeValuePicker
                            attributes={attributes}
                            selectedIds={field.value ?? []}
                            onChange={field.onChange}
                        />
                    )}
                />
            </CardContent>
        </Card>
    );
}
