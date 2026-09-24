import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { myInvitesQueryOptions } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { InboxIcon } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Personal invites inbox at `/shops/invites`.
 * Shop-independent: any authenticated user can see invites addressed to them.
 */
export const Route = createFileRoute("/shops/invites")({
    loader: async ({ context: { queryClient } }) => {
        try {
            return await queryClient.query(myInvitesQueryOptions);
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: MyInvitesPageComponent,
});

function MyInvitesPageComponent() {
    const { data: invites, isLoading, error } = useQuery(myInvitesQueryOptions);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const handleAccept = async (shopId: string, inviteId: string, shopName: string) => {
        try {
            await api.post(`/shops/${shopId}/invites/${inviteId}/accept`);
            toast.success(`You joined ${shopName}.`);
            // Membership changed everywhere: inbox, shops, and my own perms.
            await queryClient.invalidateQueries({ queryKey: ["invites", "mine"] });
            await queryClient.invalidateQueries({ queryKey: ["invites", shopId] });
            await queryClient.invalidateQueries({ queryKey: ["managers", shopId] });
            await queryClient.invalidateQueries({ queryKey: ["shops", "me"] });
            navigate({ to: "/shops/$shopId", params: { shopId } });
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to accept invite"
                    : "An unexpected error occurred.",
            );
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !invites) {
        return (
            <div className="flex flex-1 items-center justify-center p-12 text-destructive">Failed to load invites.</div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div>
                <h2 className="text-xl font-semibold">My Invites</h2>
                <p className="text-sm text-muted-foreground">Shops waiting for you to join them.</p>
            </div>

            {invites.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-12 text-center">
                    <InboxIcon className="size-8 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">No pending invites</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        When a shop owner invites you, it will show up here.
                    </p>
                    <Button variant="outline" render={<Link to="/shops" />}>
                        Back to shops
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {invites.map((invite) => (
                        <Card key={invite.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-base">{invite.shop.name}</CardTitle>
                                        <CardDescription>
                                            invited by {invite.invitedBy.name || invite.invitedBy.email} as{" "}
                                            {invite.role.name}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => handleAccept(invite.shopId, invite.id, invite.shop.name)}
                                    >
                                        Accept
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-1.5">
                                {invite.role.permissions.slice(0, 6).map((permission) => (
                                    <Badge key={permission} variant="secondary">
                                        {permission}
                                    </Badge>
                                ))}
                                {invite.role.permissions.length > 6 && (
                                    <Badge variant="outline">+{invite.role.permissions.length - 6} more</Badge>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
