"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { PencilIcon, UserMinusIcon, LogOutIcon } from "lucide-react";
import { api } from "@/lib/api";
import { rolesQueryOptions, type Manager } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

interface ManagersListProps {
    shopId: string;
    managers: Manager[];
    /** Viewer's own user id — drives the self-leave branch. */
    viewerId: string | undefined;
    canUpdate: boolean;
    canRemove: boolean;
}

/**
 * Shop managers list with role reassignment and remove/leave actions.
 * - Role changes and admin removals are permission-gated in the UI
 *   (backend enforces for real, including the subset anti-escalation gate).
 * - Removing yourself needs no permission (self-leave) and redirects home.
 */
export function ManagersList({ shopId, managers, viewerId, canUpdate, canRemove }: ManagersListProps) {
    const queryClient = useQueryClient();
    const { data: roles } = useQuery(rolesQueryOptions(shopId));

    const [roleTarget, setRoleTarget] = React.useState<Manager | null>(null);
    const [newRoleId, setNewRoleId] = React.useState("");
    const [isSavingRole, setIsSavingRole] = React.useState(false);

    const [removeTarget, setRemoveTarget] = React.useState<Manager | null>(null);
    const [isRemoving, setIsRemoving] = React.useState(false);

    const refreshManagers = () => queryClient.invalidateQueries({ queryKey: ["managers", shopId] });

    const openRoleChange = (manager: Manager) => {
        setRoleTarget(manager);
        setNewRoleId(manager.role.id);
    };

    const handleRoleChange = async () => {
        if (!roleTarget || !newRoleId) return;
        setIsSavingRole(true);
        try {
            await api.patch(`/shops/${shopId}/managers/${roleTarget.managerId}`, { roleId: newRoleId });
            toast.success(`Updated ${roleTarget.user.name || roleTarget.user.email}'s role.`);
            await refreshManagers();
            setRoleTarget(null);
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to update role"
                    : "An unexpected error occurred.",
            );
        } finally {
            setIsSavingRole(false);
        }
    };

    const handleRemove = async () => {
        if (!removeTarget) return;
        const isSelf = removeTarget.managerId === viewerId;
        setIsRemoving(true);
        try {
            await api.delete(`/shops/${shopId}/managers/${removeTarget.managerId}`);
            toast.success(isSelf ? "You left the shop." : "Manager removed.");
            // Membership changed: refresh staff, my shops, and my own perms.
            await queryClient.invalidateQueries({ queryKey: ["managers", shopId] });
            await queryClient.invalidateQueries({ queryKey: ["shops", "me"] });
            await queryClient.invalidateQueries({ queryKey: ["shop", shopId] });
            setRemoveTarget(null);
            if (isSelf) {
                // Stale shop page would 404 — go back to the shop picker.
                window.location.assign("/shops");
            }
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to remove manager"
                    : "An unexpected error occurred.",
            );
        } finally {
            setIsRemoving(false);
        }
    };

    if (managers.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                <h3 className="text-lg font-semibold mb-1">No managers yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Accepted invites will show up here with their assigned roles.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-3">
                {managers.map((manager) => {
                    const isSelf = manager.managerId === viewerId;
                    const displayName = manager.user.name || manager.user.email;
                    const initials = displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                    return (
                        <Card key={manager.managerId}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 rounded-lg">
                                            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                {displayName}
                                                {isSelf && (
                                                    <Badge variant="outline">you</Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription>
                                                invited by {manager.invitedBy.name || manager.invitedBy.email}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* No Role button on your own row: the backend rejects
                                            self role-changes unconditionally, so don't offer it. */}
                                        {canUpdate && !isSelf && (
                                            <Button variant="outline" size="sm" onClick={() => openRoleChange(manager)}>
                                                <PencilIcon className="size-4" />
                                                <span className="hidden sm:inline">Role</span>
                                            </Button>
                                        )}
                                        {(canRemove || isSelf) && (
                                            <Button
                                                variant={isSelf ? "outline" : "destructive"}
                                                size="sm"
                                                onClick={() => setRemoveTarget(manager)}
                                            >
                                                {isSelf ? <LogOutIcon className="size-4" /> : <UserMinusIcon className="size-4" />}
                                                <span className="hidden sm:inline">{isSelf ? "Leave" : "Remove"}</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Badge variant="secondary">{manager.role.name}</Badge>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Change-role dialog */}
            <Dialog open={roleTarget !== null} onOpenChange={(open) => !open && setRoleTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Change {roleTarget?.user.name || roleTarget?.user.email}'s role
                        </DialogTitle>
                        <DialogDescription>
                            You can only assign permissions you hold yourself.
                        </DialogDescription>
                    </DialogHeader>
                    <Select value={newRoleId} onValueChange={(value) => setNewRoleId(value ?? "")}>
                        <SelectTrigger className="w-full py-2.5">
                            <SelectValue placeholder="Choose a role">
                                {(value: string | null) =>
                                    roles?.find((role) => role.id === value)?.name ?? "Choose a role"
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="p-1.5">
                            {(roles ?? []).map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                    {role.name} · {role.permissions.length} permission
                                    {role.permissions.length === 1 ? "" : "s"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRoleTarget(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRoleChange} disabled={isSavingRole || !newRoleId}>
                            {isSavingRole ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Saving...
                                </>
                            ) : (
                                "Save Role"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove / leave confirmation */}
            <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {removeTarget && removeTarget.managerId === viewerId
                                ? "Leave this shop?"
                                : `Remove ${removeTarget?.user.name || removeTarget?.user.email}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {removeTarget && removeTarget.managerId === viewerId
                                ? "You will lose access immediately. The owner can re-invite you later."
                                : "They will lose access immediately. They can always be re-invited later."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleRemove();
                            }}
                            disabled={isRemoving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRemoving ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Removing...
                                </>
                            ) : removeTarget && removeTarget.managerId === viewerId ? (
                                "Leave Shop"
                            ) : (
                                "Remove Manager"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
