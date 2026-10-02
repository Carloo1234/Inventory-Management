import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import type { ShopAttribute } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { PlusIcon, Trash2Icon } from "lucide-react";

const attributeFormSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Max 100 characters"),
    values: z.array(z.object({ value: z.string().trim().max(100, "Max 100 characters") })),
});

type FormFields = z.infer<typeof attributeFormSchema>;

interface AttributeFormDialogProps {
    shopId: string;
    /** Set for rename mode; omitted for create mode. */
    attribute?: ShopAttribute | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Shared create/rename attribute dialog. Create mode includes an inline
 * dynamic values list (each non-empty value is POSTed after the name).
 * Rename mode edits the name only — values are managed on the page.
 */
export function AttributeFormDialog({ shopId, attribute, open, onOpenChange }: AttributeFormDialogProps) {
    const queryClient = useQueryClient();
    const isEdit = !!attribute;

    const { register, handleSubmit, reset, control, formState } = useForm<FormFields>({
        resolver: zodResolver(attributeFormSchema),
        defaultValues: { name: "", values: [{ value: "" }] },
    });
    const { errors, isSubmitting } = formState;
    const { fields, append, remove } = useFieldArray({ control, name: "values" });

    React.useEffect(() => {
        if (open) reset({ name: attribute?.name ?? "", values: [{ value: "" }] });
    }, [open, attribute, reset]);

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["attributes", shopId] });

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        try {
            if (isEdit && attribute) {
                await api.patch(`/shops/${shopId}/attributes/${attribute.id}`, { name: data.name });
                toast.success(`Renamed to "${data.name}".`);
            } else {
                const created = await api.post(`/shops/${shopId}/attributes`, { name: data.name });
                const attributeId: string | undefined =
                    created.data?.data?.id ?? created.validResponse?.data?.id;
                if (!attributeId) throw new Error("Attribute created without an id");
                const values = data.values.map((v) => v.value.trim()).filter(Boolean);
                for (const value of values) {
                    await api.post(`/shops/${shopId}/attributes/${attributeId}/values`, { value });
                }
                toast.success(
                    values.length > 0
                        ? `Created "${data.name}" with ${values.length} value${values.length === 1 ? "" : "s"}.`
                        : `Created "${data.name}".`,
                );
            }
            await refresh();
            reset();
            onOpenChange(false);
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to save attribute"
                    : error instanceof Error
                      ? error.message
                      : "An unexpected error occurred.",
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Rename "${attribute?.name}"` : "New Attribute"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Renaming never affects linked variants."
                            : "E.g. Size, Color, Material — with its allowed values."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <Field>
                        <FieldLabel htmlFor="attribute-name">Name</FieldLabel>
                        <Input {...register("name")} id="attribute-name" placeholder="e.g. Size" />
                        {errors.name && (
                            <span className="text-destructive text-xs mt-1">{errors.name.message}</span>
                        )}
                    </Field>

                    {!isEdit && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Values (optional)</span>
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ value: "" })}>
                                    <PlusIcon className="size-4" />
                                    <span>Add</span>
                                </Button>
                            </div>
                            {fields.map((field, index) => (
                                <div key={field.id} className="flex items-center gap-2">
                                    <Input
                                        {...register(`values.${index}.value`)}
                                        placeholder={`Value ${index + 1} (e.g. Large)`}
                                    />
                                    {fields.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => remove(index)}
                                            aria-label="Remove value"
                                        >
                                            <Trash2Icon className="size-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                reset();
                                onOpenChange(false);
                            }}
                        >
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
                                "Create Attribute"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
