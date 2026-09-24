"use client";

import * as React from "react";
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
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import { api } from "@/lib/api";
import type { Role } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

interface DeleteRoleDialogProps {
    shopId: string;
    role: Role;
}

/**
 * DeleteRoleDialog with type-the-name confirmation. Backend answers 409 when
 * managers or invites still use the role — surfaced as an explanatory toast.
 */
export function DeleteRoleDialog({ shopId, role }: DeleteRoleDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [confirmText, setConfirmText] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);
    const queryClient = useQueryClient();

    const isConfirmed = confirmText === role.name;

    const handleDelete = async () => {
        if (!isConfirmed) return;

        setIsDeleting(true);
        try {
            await api.delete(`/shops/${shopId}/roles/${role.id}`);
            toast.success(`Successfully deleted role "${role.name}"`);
            // Refresh the roles list so the removed row disappears.
            await queryClient.invalidateQueries({ queryKey: ["roles", shopId] });
            setOpen(false);
            setConfirmText("");
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.status === 409) {
                    toast.error(`Cannot delete "${role.name}" — managers or invites are still using it.`);
                } else {
                    toast.error(error.response?.data?.toast?.message || "Failed to delete role");
                }
            } else {
                toast.error("An unexpected error occurred while deleting the role.");
            }
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Button variant="destructive" size="sm" onClick={() => setOpen(true)} className="gap-2">
                <Trash2Icon className="size-4" />
                <span>Delete</span>
            </Button>

            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete role "{role.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The role and its{" "}
                            <span className="font-semibold text-foreground">{role.permissions.length}</span>{" "}
                            permission(s) will be removed permanently.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="flex flex-col gap-3 py-2">
                        <Field>
                            <FieldLabel htmlFor={`confirm-role-${role.id}`}>
                                Please type <span className="font-semibold text-foreground">{role.name}</span> to
                                confirm:
                            </FieldLabel>
                            <Input
                                id={`confirm-role-${role.id}`}
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={role.name}
                                disabled={isDeleting}
                            />
                        </Field>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => {
                                setConfirmText("");
                                setOpen(false);
                            }}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            disabled={!isConfirmed || isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Deleting...
                                </>
                            ) : (
                                "Confirm Deletion"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
