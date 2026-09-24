import { createFileRoute, redirect } from "@tanstack/react-router";
import { managersQueryOptions, shopDetailQueryOptions, userQueryOptions } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Spinner } from "@/components/ui/spinner";
import { ShieldAlertIcon } from "lucide-react";
import { ManagersList } from "@/components/managers-list";

/**
 * Shop managers page for `/shops/$shopId/managers`.
 * Gated on manager permissions (owner sees everything).
 * (Shop data is pre-loaded by the parent `$shopId` layout route.)
 */
export const Route = createFileRoute("/shops/$shopId/managers")({
    loader: async ({ context: { queryClient }, params: { shopId } }) => {
        try {
            await queryClient.query(shopDetailQueryOptions(shopId));
            return await queryClient.query(managersQueryOptions(shopId));
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: ManagersPageComponent,
});

function ManagersPageComponent() {
    const { shopId } = Route.useParams();
    const { data: shop } = useQuery(shopDetailQueryOptions(shopId));
    const { data: user } = useQuery(userQueryOptions);
    const { data: managers, isLoading, error } = useQuery(managersQueryOptions(shopId));

    const canUpdate = shop?.isOwner || shop?.managerPermissions?.includes("manager:update") || false;
    const canRemove = shop?.isOwner || shop?.managerPermissions?.includes("manager:delete") || false;

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !managers) {
        const status = axios.isAxiosError(error) ? error.status : undefined;
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">
                    {status === 403 || status === 404
                        ? "You don't have permission to view managers for this shop."
                        : "Failed to load managers."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div>
                <h2 className="text-xl font-semibold">Managers</h2>
                <p className="text-sm text-muted-foreground">
                    Everyone with access to {shop?.name ?? "this shop"} and their roles.
                </p>
            </div>

            <ManagersList
                shopId={shopId}
                managers={managers}
                viewerId={user?.id}
                canUpdate={canUpdate}
                canRemove={canRemove}
            />
        </div>
    );
}
