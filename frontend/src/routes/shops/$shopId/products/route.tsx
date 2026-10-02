import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { shopDetailQueryOptions } from "@/lib/queries";
import axios from "axios";

/**
 * Products section layout for `/shops/$shopId/products/*`.
 * Pre-loads the active shop once; list, detail and create pages render below.
 */
export const Route = createFileRoute("/shops/$shopId/products")({
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
    component: ProductsLayoutComponent,
});

function ProductsLayoutComponent() {
    return <Outlet />;
}
