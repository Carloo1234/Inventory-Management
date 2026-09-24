import { createFileRoute, redirect } from "@tanstack/react-router";
import { rolesQueryOptions, shopDetailQueryOptions, type Role } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PlusIcon, ShieldAlertIcon } from "lucide-react";
import { RolesList } from "@/components/roles-list";
import { RoleFormDialog } from "@/components/role-form-dialog";
import { InviteDialog } from "@/components/invite-dialog";

/**
 * Roles management page for `/shops/$shopId/roles`.
 * Lists shop roles, gates actions on the viewer's permissions
 * (owner sees everything), and hosts the create/edit dialog.
 * (Shop data is pre-loaded by the parent `$shopId` layout route.)
 */
export const Route = createFileRoute("/shops/$shopId/roles")({
    loader: async ({ context: { queryClient }, params: { shopId } }) => {
        try {
            await queryClient.query(shopDetailQueryOptions(shopId));
            return await queryClient.query(rolesQueryOptions(shopId));
        } catch (error) {
            if (axios.isAxiosError(error) && error.status === 401) {
                throw redirect({ to: "/signin" });
            }
            throw error;
        }
    },
    component: RolesPageComponent,
});

function RolesPageComponent() {
    const { shopId } = Route.useParams();
    const { data: shop } = useQuery(shopDetailQueryOptions(shopId));
    const { data: roles, isLoading, error } = useQuery(rolesQueryOptions(shopId));

    // Dialog state: null = closed, undefined role = create mode.
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingRole, setEditingRole] = React.useState<Role | null>(null);
    const [inviteOpen, setInviteOpen] = React.useState(false);
    const [inviteRoleId, setInviteRoleId] = React.useState<string | undefined>(undefined);

    // UI-only gating (backend enforces for real): owners can do everything,
    // managers only what their permission list allows.
    const canCreate = shop?.isOwner || shop?.managerPermissions?.includes("roles:create") || false;
    const canUpdate = shop?.isOwner || shop?.managerPermissions?.includes("roles:update") || false;
    const canDelete = shop?.isOwner || shop?.managerPermissions?.includes("roles:delete") || false;
    // Inviting needs invite:create; the dialog's role picker needs roles:read.
    const canInvite =
        shop?.isOwner ||
        (shop?.managerPermissions?.includes("invite:create") &&
            shop?.managerPermissions?.includes("roles:read")) ||
        false;

    const openCreate = () => {
        setEditingRole(null);
        setDialogOpen(true);
    };

    const openEdit = (role: Role) => {
        setEditingRole(role);
        setDialogOpen(true);
    };

    const openInvite = (role: Role) => {
        setInviteRoleId(role.id);
        setInviteOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <Spinner className="size-8" />
            </div>
        );
    }

    if (error || !roles) {
        const status = axios.isAxiosError(error) ? error.status : undefined;
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
                <ShieldAlertIcon className="size-8 text-muted-foreground" />
                <p className="font-medium">
                    {status === 403 || status === 404
                        ? "You don't have permission to view roles for this shop."
                        : "Failed to load roles."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Page header with gated create action */}
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-xl font-semibold">Roles & Permissions</h2>
                    <p className="text-sm text-muted-foreground">
                        Define reusable permission sets for {shop?.name ?? "this shop"}'s managers.
                    </p>
                </div>
                {canCreate && (
                    <Button onClick={openCreate} className="gap-2 shrink-0">
                        <PlusIcon className="size-4" />
                        <span>New Role</span>
                    </Button>
                )}
            </div>

            <RolesList
                shopId={shopId}
                roles={roles}
                canUpdate={canUpdate}
                canDelete={canDelete}
                canInvite={canInvite}
                onEdit={openEdit}
                onInvite={openInvite}
            />

            <RoleFormDialog shopId={shopId} role={editingRole} open={dialogOpen} onOpenChange={setDialogOpen} />

            <InviteDialog shopId={shopId} defaultRoleId={inviteRoleId} open={inviteOpen} onOpenChange={setInviteOpen} />
        </div>
    );
}
