import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { shopDetailQueryOptions } from "@/lib/queries";
import axios from "axios";

/**
 * Shop layout route for `/shops/$shopId`.
 * Pre-loads the active shop once and renders child pages
 * (dashboard, roles, ...) through the Outlet below.
 */
export const Route = createFileRoute("/shops/$shopId")({
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
    component: ShopLayoutComponent,
});

function ShopLayoutComponent() {
    return <Outlet />;
}
