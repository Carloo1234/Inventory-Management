"use client";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useForm, type SubmitHandler, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { rolesQueryOptions } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

// Client-side shape mirrors the backend createInviteSchema.
const inviteFormSchema = z.object({
    email: z.email("Must be a valid email address"),
    roleId: z.string().min(1, "Please choose a role"),
});

type FormFields = z.infer<typeof inviteFormSchema>;

interface InviteDialogProps {
    shopId: string;
    /** Pre-selects a role (e.g. "invite with this role" from the roles page). */
    defaultRoleId?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Invite creation dialog: email input plus a role picker loaded from the
 * live roles list. Backend subset-gate 403s surface the offending permission.
 */
export function InviteDialog({ shopId, defaultRoleId, open, onOpenChange }: InviteDialogProps) {
    const queryClient = useQueryClient();
    const { data: roles, isLoading: rolesLoading } = useQuery(rolesQueryOptions(shopId));

    const { register, handleSubmit, reset, control, formState } = useForm<FormFields>({
        resolver: zodResolver(inviteFormSchema),
        defaultValues: { email: "", roleId: defaultRoleId ?? "" },
    });
    const { errors, isSubmitting } = formState;

    // Refresh defaults every open (preset may change between openings).
    React.useEffect(() => {
        if (open) reset({ email: "", roleId: defaultRoleId ?? "" });
    }, [open, defaultRoleId, reset]);

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        try {
            await api.post(`/shops/${shopId}/invites`, data);
            toast.success(`Invited ${data.email}.`);
            // Refresh the outgoing invites list.
            await queryClient.invalidateQueries({ queryKey: ["invites", shopId] });
            reset();
            onOpenChange(false);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const fieldMessage = error.response?.data?.formErrors?.fieldErrors?.email?.[0];
                const message =
                    fieldMessage ||
                    error.response?.data?.toast?.message ||
                    error.response?.data?.formErrors?.formErrors?.[0] ||
                    "Failed to send invite";
                toast.error(message);
            } else {
                toast.error("An unexpected error occurred while sending the invite.");
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Invite Manager</DialogTitle>
                    <DialogDescription>
                        They must already have an account. They accept from their own invites inbox.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <Field>
                        <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                        <Input
                            {...register("email")}
                            id="invite-email"
                            type="email"
                            placeholder="teammate@example.com"
                        />
                        {errors.email && (
                            <span className="text-destructive text-xs mt-1">{errors.email.message}</span>
                        )}
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                        {rolesLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Spinner className="size-4" /> Loading roles...
                            </div>
                        ) : (
                            <Controller
                                control={control}
                                name="roleId"
                                render={({ field }) => (
                                    <Select
                                        value={field.value}
                                        onValueChange={(value) => field.onChange(value ?? "")}
                                    >
                                        <SelectTrigger id="invite-role" className="w-full py-2.5">
                                            <SelectValue placeholder="Choose a role">
                                                {(value: string | null) =>
                                                    roles?.find((role) => role.id === value)?.name ?? "Choose a role"
                                                }
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="p-1.5">
                                            {(roles ?? []).map((role) => (
                                                <SelectItem key={role.id} value={role.id}>
                                                    {role.name} · {role.permissions.length} permission
                                                    {role.permissions.length === 1 ? "" : "s"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        )}
                        {errors.roleId && (
                            <span className="text-destructive text-xs mt-1">{errors.roleId.message}</span>
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
                                    Sending...
                                </>
                            ) : (
                                "Send Invite"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
