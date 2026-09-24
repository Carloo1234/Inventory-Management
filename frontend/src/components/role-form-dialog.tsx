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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import {
    groupPermissions,
    permissionsQueryOptions,
    rolePresetsQueryOptions,
    roleUpdateResultSchema,
    type Role,
} from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

// Client-side shape mirrors the backend create/update schemas.
const roleFormSchema = z.object({
    name: z.string().trim().min(1, "Role name is required").max(255, "Role name must be less than 256 characters"),
    permissions: z.array(z.string()),
});

type FormFields = z.infer<typeof roleFormSchema>;

interface RoleFormDialogProps {
    shopId: string;
    /** When set, the dialog edits this role; otherwise it creates a new one. */
    role?: Role | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Shared create/edit role dialog with grouped permission checkboxes.
 * Permission catalog comes from the live backend endpoint so the UI can
 * never drift from what the server accepts. Each group has a select-all
 * toggle; individual permissions stay individually toggleable.
 */
export function RoleFormDialog({ shopId, role, open, onOpenChange }: RoleFormDialogProps) {
    const queryClient = useQueryClient();
    const isEdit = !!role;

    // Live permission catalog + preset bundles (cached 5 min, see queries.ts).
    const { data: permissions, isLoading: permissionsLoading } = useQuery(permissionsQueryOptions(shopId));
    const { data: presets } = useQuery(rolePresetsQueryOptions(shopId));
    const groups = React.useMemo(() => (permissions ? groupPermissions(permissions) : []), [permissions]);

    const { register, handleSubmit, reset, watch, setValue, formState } = useForm<FormFields>({
        resolver: zodResolver(roleFormSchema),
        defaultValues: { name: "", permissions: [] },
    });
    const { errors, isSubmitting } = formState;
    const selected = watch("permissions");

    // Refresh form contents every time the dialog opens or the target role changes.
    React.useEffect(() => {
        if (open) {
            reset({ name: role?.name ?? "", permissions: role?.permissions ?? [] });
        }
    }, [open, role, reset]);

    const togglePermission = (value: string, checked: boolean) => {
        setValue("permissions", checked ? [...selected, value] : selected.filter((p) => p !== value), {
            shouldDirty: true,
        });
    };

    const toggleGroup = (values: string[], checked: boolean) => {
        const rest = selected.filter((p) => !values.includes(p));
        setValue("permissions", checked ? [...rest, ...values] : rest, { shouldDirty: true });
    };

    const applyPreset = (presetPermissions: string[]) => {
        // Deduplicate defensively: backend treats these as sets.
        setValue("permissions", [...new Set(presetPermissions)], { shouldDirty: true });
    };

    // Which preset (if any) exactly matches the current selection.
    // Order-insensitive set equality; anything else reads as Custom.
    const activePresetId = React.useMemo(() => {
        const sorted = [...selected].sort().join("|");
        return presets?.find((p) => [...p.permissions].sort().join("|") === sorted)?.id ?? null;
    }, [presets, selected]);

    const onSubmit: SubmitHandler<FormFields> = async (data) => {
        try {
            if (isEdit && role) {
                const response = await api.patch(`/shops/${shopId}/roles/${role.id}`, data);
                // Backend answers { role, affectedManagers } — surface the impact.
                const parsed = roleUpdateResultSchema.parse(response.validResponse?.data ?? response.data);
                const { count } = parsed.affectedManagers;
                toast.success(
                    count > 0
                        ? `Updated "${parsed.role.name}" — ${count} manager${count === 1 ? "" : "s"} affected.`
                        : `Updated "${parsed.role.name}".`,
                );
            } else {
                await api.post(`/shops/${shopId}/roles`, data);
                toast.success(`Created role "${data.name}".`);
            }
            // Refresh the roles list.
            await queryClient.invalidateQueries({ queryKey: ["roles", shopId] });
            reset();
            onOpenChange(false);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message =
                    error.response?.data?.toast?.message ||
                    error.response?.data?.formErrors?.formErrors?.[0] ||
                    `Failed to ${isEdit ? "update" : "create"} role`;
                toast.error(message);
            } else {
                toast.error(`An unexpected error occurred while ${isEdit ? "updating" : "creating"} the role.`);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Edit role "${role?.name}"` : "Create New Role"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Rename the role or adjust its permissions. Managers holding this role are affected immediately."
                            : "Define a reusable permission set for this shop's managers."}
                    </DialogDescription>
                </DialogHeader>

                {permissionsLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Spinner className="size-6" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                        <Field>
                            <FieldLabel htmlFor="role-name">Role Name</FieldLabel>
                            <Input {...register("name")} id="role-name" type="text" placeholder="e.g. Cashier" />
                            {errors.name && (
                                <span className="text-destructive text-xs mt-1">{errors.name.message}</span>
                            )}
                        </Field>

                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Permissions</span>
                                <Badge variant="secondary">
                                    {activePresetId
                                        ? presets?.find((p) => p.id === activePresetId)?.name
                                        : selected.length === 0
                                          ? "None"
                                          : "Custom"}{" "}
                                    · {selected.length} selected
                                </Badge>
                            </div>

                            {/* One-click preset bundles from the live backend catalog.
                                Any manual tweak drops the indicator back to Custom. */}
                            {(presets ?? []).length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {presets!.map((preset) => {
                                        const active = activePresetId === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => applyPreset(preset.permissions)}
                                                title={preset.description}
                                                className={`rounded-lg border p-2.5 text-left transition-colors hover:border-primary ${
                                                    active ? "border-primary bg-primary/5" : ""
                                                }`}
                                            >
                                                <div className="text-sm font-semibold">{preset.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {preset.permissions.length} permissions
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {groups.map((group) => {
                                const values = group.items.map((i) => i.value);
                                const selectedCount = values.filter((v) => selected.includes(v)).length;
                                const allSelected = selectedCount === values.length;
                                const someSelected = selectedCount > 0 && !allSelected;
                                return (
                                    <div key={group.namespace} className="rounded-lg border p-3">
                                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                                            <Checkbox
                                                checked={allSelected}
                                                indeterminate={someSelected}
                                                onCheckedChange={(checked) => toggleGroup(values, checked === true)}
                                            />
                                            <span className="text-sm font-semibold capitalize">{group.namespace}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                {selectedCount}/{values.length}
                                            </span>
                                        </label>
                                        <div className="flex flex-col gap-1.5 pl-6">
                                            {group.items.map((item) => (
                                                <label
                                                    key={item.value}
                                                    className="flex items-center gap-2 cursor-pointer text-sm"
                                                    title={item.value}
                                                >
                                                    <Checkbox
                                                        checked={selected.includes(item.value)}
                                                        onCheckedChange={(checked) =>
                                                            togglePermission(item.value, checked === true)
                                                        }
                                                    />
                                                    <span>{item.friendlyName}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

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
                                        {isEdit ? "Saving..." : "Creating..."}
                                    </>
                                ) : isEdit ? (
                                    "Save Changes"
                                ) : (
                                    "Create Role"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
