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
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import axios from "axios";

interface DeleteShopDialogProps {
    shopId: string;
    shopName: string;
}

/**
 * DeleteShopDialog component providing a secure deletion confirmation flow requiring exact shop name verification.
 */
export function DeleteShopDialog({ shopId, shopName }: DeleteShopDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [confirmText, setConfirmText] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const isConfirmed = confirmText === shopName;

    const handleDelete = async () => {
        if (!isConfirmed) return;

        setIsDeleting(true);
        try {
            await api.delete(`/shops/${shopId}`);
            toast.success(`Successfully deleted shop "${shopName}"`);
            // Invalidate shops query cache so sidebar and routes update
            await queryClient.invalidateQueries({ queryKey: ["shops", "me"] });
            navigate({ to: "/shops" });
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || "Failed to delete shop";
                toast.error(message);
            } else {
                toast.error("An unexpected error occurred while deleting the shop.");
            }
        } finally {
            setIsDeleting(false);
            setOpen(false);
            setConfirmText("");
        }
    };

    return (
        <>
            <Button variant="destructive" size="sm" onClick={() => setOpen(true)} className="gap-2">
                <Trash2Icon className="size-4" />
                <span>Delete Shop</span>
            </Button>

            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete <span className="font-semibold text-foreground">{shopName}</span> and remove all associated point of sale records from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="flex flex-col gap-3 py-2">
                        <Field>
                            <FieldLabel htmlFor="confirm-shop-name">
                                Please type <span className="font-semibold text-foreground">{shopName}</span> to confirm:
                            </FieldLabel>
                            <Input
                                id="confirm-shop-name"
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={shopName}
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
