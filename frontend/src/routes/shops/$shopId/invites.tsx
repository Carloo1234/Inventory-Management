import { createFileRoute, redirect } from "@tanstack/react-router";
import { invitesQueryOptions, shopDetailQueryOptions } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InfoIcon, PlusIcon, ShieldAlertIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InvitesList } from "@/components/invites-list";
import { InviteDialog } from "@/components/invite-dialog";
import { hasPerm } from "@/lib/permissions";

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
    // A viewer with invite:create but no roles:read keeps a DISABLED button
    // (visual necessity) whose click does nothing — see below.
    const canInvite = hasPerm(shop, "invite:create", "roles:read");
    const canSeeDisabledInvite =
        !canInvite && hasPerm(shop, "invite:create");
    const canRevoke = hasPerm(shop, "invite:delete");

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
                {canInvite ? (
                    <Button onClick={() => setDialogOpen(true)} className="gap-2 shrink-0">
                        <PlusIcon className="size-4" />
                        <span>Invite</span>
                    </Button>
                ) : (
                    canSeeDisabledInvite && (
                        <span className="flex items-center gap-1.5">
                            <Button disabled onClick={() => {}} className="gap-2 shrink-0">
                                <PlusIcon className="size-4" />
                                <span>Invite</span>
                            </Button>
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                                            <InfoIcon className="size-4" />
                                        </span>
                                    }
                                />
                                <TooltipContent side="bottom">
                                    You need roles:read permission to pick a role for invites
                                </TooltipContent>
                            </Tooltip>
                        </span>
                    )
                )}
            </div>

            <InvitesList shopId={shopId} invites={invites} canRevoke={canRevoke} />

            <InviteDialog shopId={shopId} open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    );
}
