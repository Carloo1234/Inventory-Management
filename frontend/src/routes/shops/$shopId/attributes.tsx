import { createFileRoute, redirect } from "@tanstack/react-router";
import { attributesQueryOptions, shopDetailQueryOptions, type ShopAttribute } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
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
import { PlusIcon, PencilIcon, Trash2Icon, ShieldAlertIcon } from "lucide-react";
import { AttributeFormDialog } from "@/components/attribute-form-dialog";
import { AttributeValueDialog, type AttributeValueTarget } from "@/components/attribute-value-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Attributes page for `/shops/$shopId/attributes`.
 * Names with their values, full create/rename/delete for both levels.
 * Deleting a name or value in use 409s (backend restrict) with an explanatory toast.
 */
export const Route = createFileRoute("/shops/$shopId/attributes")({
    loader: async ({ context: { queryClient }, params: { shopId } }) => {
        try {
            await queryClient.query(shopDetailQueryOptions(shopId));
            return await queryClient.query(attributesQueryOptions(shopId));
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: AttributesPageComponent,
});

type DeleteTarget =
    | { kind: "name"; attribute: ShopAttribute }
    | { kind: "value"; attribute: ShopAttribute; valueId: string; value: string };

function AttributesPageComponent() {
    const { shopId } = Route.useParams();
    const queryClient = useQueryClient();
    const { data: shop } = useQuery(shopDetailQueryOptions(shopId));
    const { data: attributes, isLoading, error } = useQuery(attributesQueryOptions(shopId));

    const [nameDialog, setNameDialog] = React.useState<{ open: boolean; attribute: ShopAttribute | null }>({
        open: false,
        attribute: null,
    });
    const [valueDialog, setValueDialog] = React.useState<{ open: boolean; target: AttributeValueTarget | null }>({
        open: false,
        target: null,
    });
    const [deleting, setDeleting] = React.useState<DeleteTarget | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const canCreate = shop?.isOwner || shop?.managerPermissions?.includes("product:create") || false;
    const canUpdate = shop?.isOwner || shop?.managerPermissions?.includes("product:update") || false;
    const canDelete = shop?.isOwner || shop?.managerPermissions?.includes("product:delete") || false;

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["attributes", shopId] });

    const handleDelete = async () => {
        if (!deleting) return;
        setIsDeleting(true);
        try {
            const url =
                deleting.kind === "name"
                    ? `/shops/${shopId}/attributes/${deleting.attribute.id}`
                    : `/shops/${shopId}/attributes/${deleting.attribute.id}/values/${deleting.valueId}`;
            await api.delete(url);
            toast.success(deleting.kind === "name" ? `Deleted "${deleting.attribute.name}".` : "Deleted value.");
            await refresh();
            setDeleting(null);
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.status === 409
                        ? "Still in use by products — remove it from every variant first."
                        : error.response?.data?.toast?.message || "Failed to delete"
                    : "An unexpected error occurred.",
            );
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !attributes) {
        const status = axios.isAxiosError(error) ? error.status : undefined;
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">
                    {status === 403 || status === 404
                        ? "You don't have permission to view attributes."
                        : "Failed to load attributes."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-xl font-semibold">Attributes</h2>
                    <p className="text-sm text-muted-foreground">
                        Reusable variant dimensions for {shop?.name ?? "this shop"} — e.g. Size, Color.
                    </p>
                </div>
                {canCreate && (
                    <Button
                        onClick={() => setNameDialog({ open: true, attribute: null })}
                        className="gap-2 shrink-0"
                    >
                        <PlusIcon className="size-4" />
                        <span>New Attribute</span>
                    </Button>
                )}
            </div>

            {attributes.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                    <h3 className="text-lg font-semibold mb-1">No attributes yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        Create dimensions like Size or Color, then attach their values to variants.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {attributes.map((attribute) => (
                        <Card key={attribute.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-base">{attribute.name}</CardTitle>
                                        <CardDescription>
                                            {attribute.values.length} value
                                            {attribute.values.length === 1 ? "" : "s"}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {canUpdate && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setNameDialog({ open: true, attribute })}
                                            >
                                                <PencilIcon className="size-4" />
                                                <span className="hidden sm:inline">Rename</span>
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleting({ kind: "name", attribute })}
                                                aria-label={`Delete ${attribute.name}`}
                                            >
                                                <Trash2Icon className="size-4 text-destructive" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {attribute.values.map((value) => (
                                        <span
                                            key={value.id}
                                            className="inline-flex items-center gap-0.5 rounded-full bg-secondary py-0.5 pl-2.5 pr-1 text-xs font-medium text-secondary-foreground"
                                        >
                                            {value.value}
                                            {canUpdate && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setValueDialog({
                                                            open: true,
                                                            target: {
                                                                attributeId: attribute.id,
                                                                attributeName: attribute.name,
                                                                valueId: value.id,
                                                                value: value.value,
                                                            },
                                                        })
                                                    }
                                                    aria-label={`Edit ${value.value}`}
                                                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                                >
                                                    <PencilIcon className="size-3" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDeleting({
                                                            kind: "value",
                                                            attribute,
                                                            valueId: value.id,
                                                            value: value.value,
                                                        })
                                                    }
                                                    aria-label={`Delete ${value.value}`}
                                                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                                                >
                                                    <Trash2Icon className="size-3" />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                    {canCreate && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-5 gap-1 px-2 text-xs"
                                            onClick={() =>
                                                setValueDialog({
                                                    open: true,
                                                    target: { attributeId: attribute.id, attributeName: attribute.name },
                                                })
                                            }
                                        >
                                            <PlusIcon className="size-3" />
                                            <span>Add value</span>
                                        </Button>
                                    )}
                                </div>
                                {attribute.values.length === 0 && !canCreate && (
                                    <p className="text-xs text-muted-foreground">No values yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AttributeFormDialog
                shopId={shopId}
                attribute={nameDialog.attribute}
                open={nameDialog.open}
                onOpenChange={(open) => setNameDialog((prev) => ({ ...prev, open }))}
            />
            <AttributeValueDialog
                shopId={shopId}
                target={valueDialog.target}
                open={valueDialog.open}
                onOpenChange={(open) => setValueDialog((prev) => ({ ...prev, open }))}
            />

            <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleting?.kind === "name"
                                ? `Delete attribute "${deleting.attribute.name}"?`
                                : `Delete value "${deleting?.kind === "value" ? deleting.value : ""}"?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting?.kind === "name"
                                ? "Its values delete with it. Deletion is blocked while any variant still uses it."
                                : "Blocked while any variant still uses this value."}
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
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
