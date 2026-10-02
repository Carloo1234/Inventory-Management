import { createFileRoute, redirect } from "@tanstack/react-router";
import { shopDetailQueryOptions } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ProductForm } from "@/components/product-form";
import { ShieldAlertIcon } from "lucide-react";

/**
 * New product page for `/shops/$shopId/products/new`.
 * Creation form only — images attach after creation on the detail page.
 */
export const Route = createFileRoute("/shops/$shopId/products/new")({
    loader: async ({ context: { queryClient }, params: { shopId } }) => {
        try {
            return await queryClient.query(shopDetailQueryOptions(shopId));
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: NewProductPageComponent,
});

function NewProductPageComponent() {
    const { shopId } = Route.useParams();
    const { data: shop } = useQuery(shopDetailQueryOptions(shopId));
    const canCreate = shop?.isOwner || shop?.managerPermissions?.includes("product:create") || false;

    if (!canCreate && shop) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">You don't have permission to create products.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 max-w-4xl mx-auto w-full">
            <div>
                <h2 className="text-xl font-semibold">New Product</h2>
                <p className="text-sm text-muted-foreground">
                    Define the product and its variants. Images attach after creation.
                </p>
            </div>
            <ProductForm shopId={shopId} />
        </div>
    );
}
