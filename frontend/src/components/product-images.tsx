import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, resolvePublicUrl, uploadForm } from "@/lib/api";
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
import type { Product, ProductImage, Variant } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { ImagePlusIcon, Trash2Icon, StarIcon } from "lucide-react";

type UploadState = { id: string; name: string; status: "uploading" | "error"; error?: string };

/**
 * Image manager for the product detail page: shared pool + per-variant groups.
 * Uploads fire in parallel (one request per file) with per-thumbnail status;
 * failures retry individually without touching the successes.
 * Position 0 is always the main image of its scope.
 */
export function ProductImages({
    shopId,
    product,
    canManage,
}: {
    shopId: string;
    product: Product;
    canManage: boolean;
}) {
    const queryClient = useQueryClient();
    const fileRef = React.useRef<HTMLInputElement>(null);
    const [targetVariantId, setTargetVariantId] = React.useState<string>("shared");
    const [uploads, setUploads] = React.useState<UploadState[]>([]);

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ["product", shopId, product.id] }),
            queryClient.invalidateQueries({ queryKey: ["products", shopId] }),
            queryClient.invalidateQueries({ queryKey: ["variants", shopId] }),
        ]);

    const uploadOne = async (file: File, variantId: string | undefined, key: string) => {
        const form = new FormData();
        form.append("image", file);
        if (variantId) form.append("variantId", variantId);
        try {
            const { status, data } = await uploadForm(`/shops/${shopId}/products/${product.id}/images/upload`, form);
            if (status !== 201 || !data?.success) {
                throw new Error(data?.toast?.message || data?.formErrors?.formErrors?.[0] || "Upload failed");
            }
            setUploads((prev) => prev.filter((u) => u.id !== key));
            await refresh();
        } catch (error) {
            setUploads((prev) =>
                prev.map((u) =>
                    u.id === key
                        ? { ...u, status: "error", error: error instanceof Error ? error.message : "Upload failed" }
                        : u,
                ),
            );
        }
    };

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const variantId = targetVariantId === "shared" ? undefined : targetVariantId;
        const batch = Array.from(files).map((file) => ({
            file,
            key: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }));
        setUploads((prev) => [
            ...prev,
            ...batch.map(({ file, key }) => ({ id: key, name: file.name, status: "uploading" as const })),
        ]);
        // Parallel, independent requests — one bad file never blocks the rest.
        for (const { file, key } of batch) {
            uploadOne(file, variantId, key);
        }
        if (fileRef.current) fileRef.current.value = "";
    };

    const [pendingDelete, setPendingDelete] = React.useState<ProductImage | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleDelete = async () => {
        if (!pendingDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/shops/${shopId}/products/${product.id}/images/${pendingDelete.id}`);
            toast.success("Deleted image.");
            await refresh();
            setPendingDelete(null);
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to delete image"
                    : "An unexpected error occurred.",
            );
        } finally {
            setIsDeleting(false);
        }
    };

    const shared = product.images;
    const byVariant = new Map<string, ProductImage[]>();
    for (const variant of product.productVariants) {
        byVariant.set(variant.id, variant.images.length > 0 ? variant.images : shared);
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Images</span>
                {canManage && (
                    <div className="flex items-center gap-2 min-w-0">
                        <Select value={targetVariantId} onValueChange={(value) => value && setTargetVariantId(value)}>
                            <SelectTrigger size="sm" className="max-w-44 py-2">
                                <SelectValue>
                                    {(value: string | null) =>
                                        value === "shared"
                                            ? "Shared (all variants)"
                                            : (product.productVariants.find((v) => v.id === value)?.sku ??
                                              "Choose target")
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="p-1.5">
                                <SelectItem value="shared">Shared (all variants)</SelectItem>
                                {product.productVariants.map((variant) => (
                                    <SelectItem key={variant.id} value={variant.id}>
                                        {variant.sku}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                            <ImagePlusIcon className="size-4" />
                            <span>Upload</span>
                        </Button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </div>
                )}
            </div>

            {uploads.map((upload) => (
                <div key={upload.id} className="flex items-center gap-2 rounded-lg border border-dashed p-2 text-sm">
                    {upload.status === "uploading" ? (
                        <>
                            <Spinner className="size-4" />
                            <span className="truncate">Uploading {upload.name}...</span>
                        </>
                    ) : (
                        <>
                            <span className="truncate text-destructive">
                                {upload.name} failed{upload.error ? `: ${upload.error}` : ""}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto shrink-0"
                                onClick={() => setUploads((prev) => prev.filter((u) => u.id !== upload.id))}
                            >
                                Dismiss
                            </Button>
                        </>
                    )}
                </div>
            ))}

            {shared.length === 0 && product.productVariants.every((v) => v.images.length === 0) ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
                    <p className="text-sm font-medium">No images for this product yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {canManage
                            ? "Upload above — shared images show on every variant."
                            : "Images will appear here once added."}
                    </p>
                </div>
            ) : (
                <>
                    <ImageGroup
                        title="Shared images"
                        images={shared}
                        emptyHint="No shared images."
                        canManage={canManage}
                        onDelete={setPendingDelete}
                    />
                    {product.productVariants.map((variant: Variant) => (
                        <ImageGroup
                            key={variant.id}
                            title={`${variant.sku}${variant.images.length === 0 ? " (using shared)" : ""}`}
                            images={byVariant.get(variant.id) ?? []}
                            emptyHint="Using shared images."
                            canManage={canManage && variant.images.length > 0}
                            onDelete={setPendingDelete}
                        />
                    ))}
                </>
            )}

            <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this image?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The image file and its record are removed permanently. Other scopes using shared
                            images are unaffected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {pendingDelete && (
                        <div className="flex justify-center rounded-lg border bg-muted p-4">
                            <img
                                src={resolvePublicUrl(pendingDelete.url)}
                                alt="Image to delete"
                                className="h-40 object-contain"
                            />
                        </div>
                    )}
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
                                "Delete Image"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function ImageGroup({
    title,
    images,
    emptyHint,
    canManage,
    onDelete,
}: {
    title: string;
    images: ProductImage[];
    emptyHint: string;
    canManage: boolean;
    onDelete: (image: ProductImage) => void;
}) {
    // Only rows owned by this scope are deletable here (fallback images belong to shared).
    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
            {images.length === 0 ? (
                <p className="text-xs text-muted-foreground">{emptyHint}</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {images.map((image) => (
                        <ImageThumb key={image.id} image={image} canManage={canManage} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ImageThumb({
    image,
    canManage,
    onDelete,
}: {
    image: ProductImage;
    canManage: boolean;
    onDelete: (image: ProductImage) => void;
}) {
    return (
        <div className="relative group w-28 rounded-lg border bg-muted">
            <img
                src={resolvePublicUrl(image.url)}
                alt=""
                className="aspect-square w-full rounded-lg object-contain p-1"
                loading="lazy"
            />
            {image.position === 0 && (
                <Badge variant="default" className="absolute left-1.5 top-1.5 gap-1">
                    <StarIcon className="size-3" />
                    Main
                </Badge>
            )}
            {canManage && (
                <Button
                    size="sm"
                    variant="destructive"
                    className="absolute right-1.5 top-1.5 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => onDelete(image)}
                    aria-label="Delete image"
                >
                    <Trash2Icon className="size-3" />
                </Button>
            )}
        </div>
    );
}
