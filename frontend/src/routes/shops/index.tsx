import { createFileRoute, redirect } from "@tanstack/react-router";
import { shopsQueryOptions } from "@/lib/queries";

/**
 * Shops index route ("1/shops/") checks available shops and redirects to the first shop dashboard or shows empty state.
 */
export const Route = createFileRoute("/shops/")({
    loader: async ({ context: { queryClient } }) => {
        try {
            const shops = await queryClient.ensureQueryData(shopsQueryOptions);
            if (shops && shops.length > 0) {
                throw redirect({ to: "/shops/$shopId", params: { shopId: shops[0].id } });
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes("Redirect")) {
                throw error;
            }
        }
        return null;
    },
    component: ShopsIndexComponent,
});

function ShopsIndexComponent() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center min-h-100">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-4">
                <i className="fa-solid fa-shop text-xl text-muted-foreground"></i>
            </div>
            <h2 className="text-xl font-semibold mb-2">No Shops Found</h2>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
                You don't have any shops associated with your account yet. Create a shop to start managing your POS
                system.
            </p>
        </div>
    );
}
