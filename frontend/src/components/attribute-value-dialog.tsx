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
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

const valueFormSchema = z.object({
    value: z.string().trim().min(1, "Value is required").max(100, "Max 100 characters"),
});

type FormFields = z.infer<typeof valueFormSchema>;

export interface AttributeValueTarget {
    attributeId: string;
    attributeName: string;
    valueId?: string;
    value?: string;
}

/**
 * Add/edit single attribute value dialog. Duplicate values under one name
 * 409 with a clear toast; nothing else special.
 */
export function AttributeValueDialog({
    shopId,
    target,
    open,
    onOpenChange,
}: {
    shopId: string;
    target: AttributeValueTarget | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const queryClient = useQueryClient();
    const isEdit = !!target?.valueId;

    const { register, handleSubmit, reset, formState } = useForm<FormFields>({
        resolver: zodResolver(valueFormSchema),
        defaultValues: { value: "" },
    });
    const { errors, isSubmitting } = formState;

    React.useEffect(() => {
        if (open) reset({ value: target?.value ?? "" });
    }, [open, target, reset]);

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        if (!target) return;
        try {
            if (isEdit) {
                await api.patch(`/shops/${shopId}/attributes/${target.attributeId}/values/${target.valueId}`, {
                    value: data.value,
                });
                toast.success(`Updated to "${data.value}".`);
            } else {
                await api.post(`/shops/${shopId}/attributes/${target.attributeId}/values`, { value: data.value });
                toast.success(`Added "${data.value}".`);
            }
            await queryClient.invalidateQueries({ queryKey: ["attributes", shopId] });
            reset();
            onOpenChange(false);
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to save value"
                    : "An unexpected error occurred.",
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? `Edit value in "${target?.attributeName}"` : `Add value to "${target?.attributeName}"`}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Renaming never affects linked variants." : "E.g. XL, Red, Cotton."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <Field>
                        <FieldLabel htmlFor="attribute-value">Value</FieldLabel>
                        <Input {...register("value")} id="attribute-value" placeholder="e.g. XL" />
                        {errors.value && (
                            <span className="text-destructive text-xs mt-1">{errors.value.message}</span>
                        )}
                    </Field>
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
                                "Add Value"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
