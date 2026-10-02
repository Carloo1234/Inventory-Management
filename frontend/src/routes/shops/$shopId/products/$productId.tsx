import { createFileRoute, redirect } from "@tanstack/react-router";
import { productDetailQueryOptions, shopDetailQueryOptions } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ShieldAlertIcon } from "lucide-react";
import { VariantManager } from "@/components/variant-manager";
import { ProductImages } from "@/components/product-images";
import { DeleteProductDialog } from "@/components/delete-product-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Product detail page for `/shops/$shopId/products/$productId`.
 * Info editing, variant management, image management, danger zone.
 */
export const Route = createFileRoute("/shops/$shopId/products/$productId")({
    loader: async ({ context: { queryClient }, params: { shopId, productId } }) => {
        try {
            await queryClient.query(shopDetailQueryOptions(shopId));
            return await queryClient.query(productDetailQueryOptions(shopId, productId));
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: ProductDetailPageComponent,
});

function ProductDetailPageComponent() {
    const { shopId, productId } = Route.useParams();
    const { data: shop } = useQuery(shopDetailQueryOptions(shopId));
    const { data: product, isLoading, error } = useQuery(productDetailQueryOptions(shopId, productId));

    const canUpdate = shop?.isOwner || shop?.managerPermissions?.includes("product:update") || false;
    const canDelete = shop?.isOwner || shop?.managerPermissions?.includes("product:delete") || false;

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !product) {
        const status = axios.isAxiosError(error) ? error.status : undefined;
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">
                    {status === 403 || status === 404 ? "Product not found." : "Failed to load product."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 max-w-4xl mx-auto w-full">
            <div>
                <h2 className="text-xl font-semibold">{product.name}</h2>
                <p className="text-sm text-muted-foreground">
                    {product.productVariants.length} variant
                    {product.productVariants.length === 1 ? "" : "s"}
                </p>
            </div>

            <ProductInfoCard shopId={shopId} productId={productId} canUpdate={canUpdate} />

            <VariantManager
                shopId={shopId}
                productId={productId}
                variants={product.productVariants}
                canUpdate={canUpdate}
                canDelete={canDelete}
            />

            <ProductImages shopId={shopId} product={product} canManage={canUpdate} />

            {canDelete && (
                <Card className="border-destructive/30">
                    <CardHeader>
                        <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                        <CardDescription>
                            Deleting removes the product with all variants, links and images.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DeleteProductDialog shopId={shopId} productId={productId} productName={product.name} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function ProductInfoCard({ shopId, productId, canUpdate }: { shopId: string; productId: string; canUpdate: boolean }) {
    const queryClient = useQueryClient();
    const { data: product } = useQuery(productDetailQueryOptions(shopId, productId));
    const [name, setName] = React.useState(product?.name ?? "");
    const [description, setDescription] = React.useState(product?.description ?? "");
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        setName(product?.name ?? "");
        setDescription(product?.description ?? "");
    }, [product?.name, product?.description]);

    if (!product) return null;

    const dirty = name.trim() !== product.name || (description.trim() || "") !== (product.description ?? "");

    const handleSave = async () => {
        if (!dirty || !name.trim()) return;
        setIsSaving(true);
        try {
            await api.patch(`/shops/${shopId}/products/${productId}`, {
                name: name.trim(),
                description: description.trim() || null,
            });
            toast.success("Saved product info.");
            await queryClient.invalidateQueries({ queryKey: ["product", shopId, productId] });
            await queryClient.invalidateQueries({ queryKey: ["products", shopId] });
            await queryClient.invalidateQueries({ queryKey: ["variants", shopId] });
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to save"
                    : "An unexpected error occurred.",
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Product Info</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <Field>
                    <FieldLabel htmlFor="detail-name">Name</FieldLabel>
                    <Input
                        id="detail-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!canUpdate}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="detail-description">Description</FieldLabel>
                    <Input
                        id="detail-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={!canUpdate}
                        placeholder="No description"
                    />
                </Field>
                {canUpdate && (
                    <div className="flex justify-end">
                        <Button size="sm" onClick={handleSave} disabled={!dirty || isSaving || !name.trim()}>
                            {isSaving ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Saving...
                                </>
                            ) : (
                                "Save Info"
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
