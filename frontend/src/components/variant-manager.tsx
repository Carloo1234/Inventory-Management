import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, type SubmitHandler, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { attributesQueryOptions, type Variant } from "@/lib/queries";
import { AttributeValuePicker } from "@/components/attribute-value-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

const variantSchema = z.object({
    sku: z.string().trim().min(1, "SKU is required").max(16, "Max 16 characters").optional(),
    barcode: z.string().trim().max(14, "Max 14 characters").optional(),
    price: z
        .string()
        .trim()
        .regex(/^\d+(\.\d+)?$/, "Must be a positive number")
        .optional(),
    quantity: z.number({ error: "Quantity must be a number" }).int().min(0).optional(),
    attributeValueIds: z.array(z.string()).optional(),
});

type FormFields = z.infer<typeof variantSchema>;

/**
 * Variant rows for the product detail page, with add/edit dialog and guarded delete.
 * Price stays a string (backend numeric serializes as string).
 */
export function VariantManager({
    shopId,
    productId,
    variants,
    canUpdate,
    canDelete,
}: {
    shopId: string;
    productId: string;
    variants: Variant[];
    canUpdate: boolean;
    canDelete: boolean;
}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = React.useState<Variant | "new" | null>(null);
    const [deleting, setDeleting] = React.useState<Variant | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ["product", shopId, productId] }),
            queryClient.invalidateQueries({ queryKey: ["products", shopId] }),
            queryClient.invalidateQueries({ queryKey: ["variants", shopId] }),
        ]);

    const handleDelete = async () => {
        if (!deleting) return;
        setIsDeleting(true);
        try {
            await api.delete(`/shops/${shopId}/products/variants/${deleting.id}`);
            toast.success(`Deleted variant ${deleting.sku}.`);
            await refresh();
            setDeleting(null);
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to delete variant"
                    : "An unexpected error occurred.",
            );
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Variants ({variants.length})</span>
                    {canUpdate && (
                        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
                            <PlusIcon className="size-4" />
                            <span>Add Variant</span>
                        </Button>
                    )}
                </div>
                {variants.map((variant) => (
                    <Card key={variant.id}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-sm font-mono">{variant.sku}</CardTitle>
                                    <CardDescription>
                                        ${Number(variant.price).toFixed(2)} · {variant.quantity} in stock
                                        {variant.barcode ? ` · ${variant.barcode}` : ""}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {canUpdate && (
                                        <Button variant="outline" size="sm" onClick={() => setEditing(variant)}>
                                            <PencilIcon className="size-4" />
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button variant="ghost" size="sm" onClick={() => setDeleting(variant)}>
                                            <Trash2Icon className="size-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        {variant.variantAttributeValues.length > 0 && (
                            <CardContent className="flex flex-wrap gap-1.5 pt-0">
                                {variant.variantAttributeValues.map((link) => (
                                    <Badge key={link.attributeValue.id} variant="secondary">
                                        {link.attributeValue.attributeName.name}: {link.attributeValue.value}
                                    </Badge>
                                ))}
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>

            <VariantDialog
                shopId={shopId}
                productId={productId}
                variant={editing === "new" ? null : editing}
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                onSaved={refresh}
            />

            <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete variant {deleting?.sku}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The last variant of a product cannot be deleted — delete the product instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete Variant"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function VariantDialog({
    shopId,
    productId,
    variant,
    open,
    onOpenChange,
    onSaved,
}: {
    shopId: string;
    productId: string;
    variant: Variant | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => Promise<unknown>;
}) {
    const isEdit = !!variant;
    const { data: attributes } = useQuery(attributesQueryOptions(shopId));
    const { register, handleSubmit, reset, control, formState } = useForm<FormFields>({
        resolver: zodResolver(variantSchema),
    });
    const { errors, isSubmitting } = formState;

    React.useEffect(() => {
        if (open) {
            reset({
                sku: variant?.sku ?? "",
                barcode: variant?.barcode ?? "",
                price: variant?.price ?? "",
                quantity: variant?.quantity ?? 0,
                attributeValueIds: variant?.variantAttributeValues.map((link) => link.attributeValue.id) ?? [],
            });
        }
    }, [open, variant, reset]);

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        try {
            const payload = {
                ...(data.sku ? { sku: data.sku } : {}),
                ...(data.barcode ? { barcode: data.barcode } : {}),
                ...(data.price ? { price: data.price } : {}),
                ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
                ...(data.attributeValueIds ? { attributeValueIds: data.attributeValueIds } : {}),
            };
            if (isEdit && variant) {
                await api.patch(`/shops/${shopId}/products/variants/${variant.id}`, payload);
                toast.success(`Updated variant ${variant.sku}.`);
            } else {
                // Nested create goes through the product PATCH upsert contract.
                await api.patch(`/shops/${shopId}/products/${productId}`, { variants: [payload] });
                toast.success("Added variant.");
            }
            await onSaved();
            onOpenChange(false);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const fieldErrors: Record<string, string[]> | undefined = error.response?.data?.formErrors?.fieldErrors;
                const first = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined;
                toast.error(first ?? error.response?.data?.toast?.message ?? "Failed to save variant");
            } else {
                toast.error("An unexpected error occurred.");
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Edit variant ${variant?.sku}` : "Add Variant"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Only provided fields change."
                            : "SKU, price and quantity are required for new variants."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field>
                            <FieldLabel>SKU</FieldLabel>
                            <Input {...register("sku")} placeholder="SHIRT-RED-M" />
                            {errors.sku && <span className="text-destructive text-xs mt-1">{errors.sku.message}</span>}
                        </Field>
                        <Field>
                            <FieldLabel>Barcode</FieldLabel>
                            <Input {...register("barcode")} placeholder="Optional" />
                            {errors.barcode && (
                                <span className="text-destructive text-xs mt-1">{errors.barcode.message}</span>
                            )}
                        </Field>
                        <Field>
                            <FieldLabel>Price</FieldLabel>
                            <Input {...register("price")} placeholder="19.99" inputMode="decimal" />
                            {errors.price && (
                                <span className="text-destructive text-xs mt-1">{errors.price.message}</span>
                            )}
                        </Field>
                        <Field>
                            <FieldLabel>Quantity</FieldLabel>
                            <Input {...register("quantity", { valueAsNumber: true })} type="number" min={0} />
                            {errors.quantity && (
                                <span className="text-destructive text-xs mt-1">{errors.quantity.message}</span>
                            )}
                        </Field>
                    </div>
                    <Controller
                        control={control}
                        name="attributeValueIds"
                        render={({ field }) => (
                            <AttributeValuePicker
                                attributes={attributes}
                                selectedIds={field.value ?? []}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Saving...
                                </>
                            ) : isEdit ? (
                                "Save Changes"
                            ) : (
                                "Add Variant"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
