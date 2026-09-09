import { createFileRoute, redirect } from "@tanstack/react-router";
import { shopDetailQueryOptions } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DeleteShopDialog } from "@/components/delete-shop-dialog";

/**
 * Dynamic shop detail route for `/shops/$shopId` featuring shop metrics and secure management actions.
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
    component: ShopDetailComponent,
});

function ShopDetailComponent() {
    const { shopId } = Route.useParams();
    const { data: shop, isLoading, error } = useQuery(shopDetailQueryOptions(shopId));

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !shop) {
        return (
            <div className="flex flex-1 items-center justify-center p-12 text-destructive">
                Failed to load shop details or shop not found
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Top statistics cards */}
            <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Shop Name</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{shop.name}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {shop.isOwner ? "Owner (Full Access)" : "Manager"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Permissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-semibold">
                            {shop.isOwner
                                ? "All Permissions"
                                : shop.managerPermissions?.length
                                  ? shop.managerPermissions.join(", ")
                                  : "No specific permissions"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Role configuration</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Created Date</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-semibold">
                            {new Date(shop.createdAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">ID: {shop.id.slice(0, 8)}...</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main shop workspace content area */}
            <div className="min-h-80 flex-1 rounded-xl bg-muted/50 p-8 flex flex-col items-center justify-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-background shadow-sm mb-4">
                    <i className="fa-solid fa-cash-register text-2xl text-primary"></i>
                </div>
                <h3 className="text-xl font-semibold mb-2">{shop.name} Dashboard</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                    Welcome to the management portal for {shop.name}. Use the sidebar to navigate between inventory,
                    sales reports, and staff settings.
                </p>
            </div>

            {/* Danger Zone: Secure Shop Deletion */}
            <Card className="border-destructive/30">
                <CardHeader>
                    <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                    <CardDescription>
                        Deleting this shop will permanently remove all associated point of sale data and cannot be undone.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <div>
                        <div className="font-medium text-sm">Delete this shop</div>
                        <div className="text-xs text-muted-foreground">
                            Once deleted, it cannot be recovered. Please be certain.
                        </div>
                    </div>
                    <DeleteShopDialog shopId={shop.id} shopName={shop.name} />
                </CardContent>
            </Card>
        </div>
    );
}
