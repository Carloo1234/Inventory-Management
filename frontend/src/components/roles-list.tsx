"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MailPlusIcon, PencilIcon } from "lucide-react";
import type { Role } from "@/lib/queries";
import { DeleteRoleDialog } from "@/components/delete-role-dialog";

interface RolesListProps {
    shopId: string;
    roles: Role[];
    canUpdate: boolean;
    canDelete: boolean;
    canInvite: boolean;
    onEdit: (role: Role) => void;
    onInvite: (role: Role) => void;
}

/**
 * Card list of shop roles with permission badges and gated edit/delete actions.
 * Permission checks here are UI-only convenience — the backend enforces them.
 */
export function RolesList({ shopId, roles, canUpdate, canDelete, canInvite, onEdit, onInvite }: RolesListProps) {
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    if (roles.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                <h3 className="text-lg font-semibold mb-1">No roles yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Create your first role to start organizing manager permissions for this shop.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {roles.map((role) => {
                const expanded = expandedId === role.id;
                const visiblePermissions = expanded ? role.permissions : role.permissions.slice(0, 6);
                const hiddenCount = role.permissions.length - visiblePermissions.length;
                return (
                    <Card key={role.id}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base">{role.name}</CardTitle>
                                    <CardDescription>
                                        {role.permissions.length} permission
                                        {role.permissions.length === 1 ? "" : "s"} · created{" "}
                                        {new Date(role.createdAt).toLocaleDateString(undefined, {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </CardDescription>
                                </div>
                                {(canUpdate || canDelete || canInvite) && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        {canInvite && (
                                            <Button variant="outline" size="sm" onClick={() => onInvite(role)}>
                                                <MailPlusIcon className="size-4" />
                                                <span>Invite</span>
                                            </Button>
                                        )}
                                        {canUpdate && (
                                            <Button variant="outline" size="sm" onClick={() => onEdit(role)}>
                                                <PencilIcon className="size-4" />
                                                <span>Edit</span>
                                            </Button>
                                        )}
                                        {canDelete && <DeleteRoleDialog shopId={shopId} role={role} />}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-1.5">
                                {visiblePermissions.map((permission) => (
                                    <Badge key={permission} variant="secondary">
                                        {permission}
                                    </Badge>
                                ))}
                                {hiddenCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-2 text-xs"
                                        onClick={() => setExpandedId(expanded ? null : role.id)}
                                    >
                                        +{hiddenCount} more
                                    </Button>
                                )}
                                {expanded && hiddenCount <= 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-2 text-xs"
                                        onClick={() => setExpandedId(null)}
                                    >
                                        Show less
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
