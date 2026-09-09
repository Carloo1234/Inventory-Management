"use client";

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
import { shopsQueryOptions, userQueryOptions } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import axios from "axios";

// Schema for shop creation form validation
const createShopSchema = z.object({
    name: z.string().min(1, "Shop name is required").max(255, "Shop name must be less than 256 characters"),
});

type FormFields = z.infer<typeof createShopSchema>;

interface AddShopDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * AddShopDialog component allowing users to create a new shop while respecting their shop limit.
 */
export function AddShopDialog({ open, onOpenChange }: AddShopDialogProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { data: shops } = useQuery(shopsQueryOptions);
    const { data: user } = useQuery(userQueryOptions);

    const shopLimit = user?.shopLimit ?? 1;
    const currentShopCount = shops?.length ?? 0;
    const hasReachedLimit = currentShopCount >= shopLimit;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormFields>({
        resolver: zodResolver(createShopSchema),
    });

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        if (hasReachedLimit) {
            toast.error(`You have reached your shop limit of ${shopLimit}.`);
            return;
        }

        try {
            await api.post("/shops", { name: data.name });
            // Invalidate shops query to refetch the updated list
            await queryClient.invalidateQueries({ queryKey: ["shops", "me"] });
            const updatedShops = await queryClient.ensureQueryData(shopsQueryOptions);
            const newlyCreated = updatedShops[updatedShops.length - 1];

            if (newlyCreated) {
                navigate({ to: "/shops/$shopId", params: { shopId: newlyCreated.id } });
            } else {
                navigate({ to: "/shops" });
            }

            reset();
            onOpenChange(false);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message =
                    error.response?.data?.formErrors?.formErrors?.[0] ||
                    error.response?.data?.message ||
                    "Failed to create shop";
                toast.error(message);
            } else {
                toast.error("An unexpected error occurred while creating the shop.");
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Shop</DialogTitle>
                    <DialogDescription>
                        Add a new point of sale shop workspace. You currently have {currentShopCount} of {shopLimit} allowed shops.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <Field>
                        <FieldLabel htmlFor="shop-name">Shop Name</FieldLabel>
                        <Input
                            {...register("name")}
                            id="shop-name"
                            type="text"
                            placeholder="e.g. Downtown Branch"
                            disabled={hasReachedLimit}
                        />
                        {errors.name && <span className="text-destructive text-xs mt-1">{errors.name.message}</span>}
                    </Field>

                    {hasReachedLimit && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            Shop limit reached ({shopLimit}). You cannot create any more shops.
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
                        <Button type="submit" disabled={isSubmitting || hasReachedLimit}>
                            {isSubmitting ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Creating...
                                </>
                            ) : (
                                "Create Shop"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
