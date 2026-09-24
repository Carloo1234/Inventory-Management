import { createFileRoute, redirect } from "@tanstack/react-router";
import { invitesQueryOptions, shopDetailQueryOptions } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PlusIcon, ShieldAlertIcon } from "lucide-react";
import { InvitesList } from "@/components/invites-list";
import { InviteDialog } from "@/components/invite-dialog";

/**
 * Outgoing invites page for `/shops/$shopId/invites`.
 * Gated on invite permissions (owner sees everything).
 * (Shop data is pre-loaded by the parent `$shopId` layout route.)
 */
export const Route = createFileRoute("/shops/$shopId/invites")({
    loader: async ({ context: { queryClient }, params: { shopId } }) => {
        try {
            await queryClient.query(shopDetailQueryOptions(shopId));
            return await queryClient.query(invitesQueryOptions(shopId));
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: InvitesPageComponent,
});

function InvitesPageComponent() {
    const { shopId } = Route.useParams();
    const { data: shop } = useQuery(shopDetailQueryOptions(shopId));
    const { data: invites, isLoading, error } = useQuery(invitesQueryOptions(shopId));
    const [dialogOpen, setDialogOpen] = React.useState(false);

    // Creating needs invite:create; picking a role needs roles:read too —
    // without it the dialog couldn't offer roles, so gate both together.
    const canInvite =
        shop?.isOwner ||
        (shop?.managerPermissions?.includes("invite:create") && shop?.managerPermissions?.includes("roles:read")) ||
        false;
    const canRevoke = shop?.isOwner || shop?.managerPermissions?.includes("invite:delete") || false;

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !invites) {
        const status = axios.isAxiosError(error) ? error.status : undefined;
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">
                    {status === 403 || status === 404
                        ? "You don't have permission to view invites for this shop."
                        : "Failed to load invites."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-xl font-semibold">Pending Invites</h2>
                    <p className="text-sm text-muted-foreground">
                        Invite teammates to {shop?.name ?? "this shop"} by email.
                    </p>
                </div>
                {canInvite && (
                    <Button onClick={() => setDialogOpen(true)} className="gap-2 shrink-0">
                        <PlusIcon className="size-4" />
                        <span>Invite</span>
                    </Button>
                )}
            </div>

            <InvitesList shopId={shopId} invites={invites} canRevoke={canRevoke} />

            <InviteDialog shopId={shopId} open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    );
}
