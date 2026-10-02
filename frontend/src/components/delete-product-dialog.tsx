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

/**
 * Product deletion with type-the-name confirmation. Cascades to variants,
 * attribute links and image rows (files cleaned server-side).
 */
export function DeleteProductDialog({
    shopId,
    productId,
    productName,
}: {
    shopId: string;
    productId: string;
    productName: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [confirmText, setConfirmText] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const isConfirmed = confirmText === productName;

    const handleDelete = async () => {
        if (!isConfirmed) return;
        setIsDeleting(true);
        try {
            await api.delete(`/shops/${shopId}/products/${productId}`);
            toast.success(`Deleted product "${productName}".`);
            await queryClient.invalidateQueries({ queryKey: ["products", shopId] });
            await queryClient.invalidateQueries({ queryKey: ["variants", shopId] });
            navigate({ to: "/shops/$shopId/products", params: { shopId } });
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to delete product"
                    : "An unexpected error occurred.",
            );
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
                <span>Delete Product</span>
            </Button>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete product "{productName}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the product with all its variants and images, and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                        <Field>
                            <FieldLabel htmlFor={`confirm-product-${productId}`}>
                                Please type <span className="font-semibold text-foreground">{productName}</span> to
                                confirm:
                            </FieldLabel>
                            <Input
                                id={`confirm-product-${productId}`}
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={productName}
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
