"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { MailXIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { Invite } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

interface InvitesListProps {
    shopId: string;
    invites: Invite[];
    canRevoke: boolean;
}

/** Days before expiry under which an invite is flagged as urgent. */
const EXPIRY_WARNING_DAYS = 3;

/**
 * Outgoing invites list with revoke actions. Revoking is non-destructive
 * (the user simply never joins), so a plain confirm suffices.
 */
export function InvitesList({ shopId, invites, canRevoke }: InvitesListProps) {
    const queryClient = useQueryClient();
    const [revokingId, setRevokingId] = React.useState<string | null>(null);
    const [isRevoking, setIsRevoking] = React.useState(false);

    const handleRevoke = async () => {
        if (!revokingId) return;
        setIsRevoking(true);
        try {
            await api.delete(`/shops/${shopId}/invites/${revokingId}`);
            toast.success("Invite revoked.");
            await queryClient.invalidateQueries({ queryKey: ["invites", shopId] });
            setRevokingId(null);
        } catch (error) {
            toast.error(
                axios.isAxiosError(error)
                    ? error.response?.data?.toast?.message || "Failed to revoke invite"
                    : "An unexpected error occurred.",
            );
        } finally {
            setIsRevoking(false);
        }
    };

    if (invites.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                <h3 className="text-lg font-semibold mb-1">No pending invites</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Invite teammates by email and they will appear here until they accept.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-3">
                {invites.map((invite) => {
                    const daysLeft = Math.ceil(
                        (new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                    );
                    const urgent = daysLeft <= EXPIRY_WARNING_DAYS;
                    return (
                        <Card key={invite.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-base">
                                            {invite.invitedUser.name || invite.invitedUser.email}
                                        </CardTitle>
                                        <CardDescription>
                                            invited by {invite.invitedBy.name || invite.invitedBy.email} ·{" "}
                                            {new Date(invite.createdAt).toLocaleDateString(undefined, {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </CardDescription>
                                    </div>
                                    {canRevoke && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setRevokingId(invite.id)}
                                            className="gap-2 shrink-0"
                                        >
                                            <MailXIcon className="size-4" />
                                            <span>Revoke</span>
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary">{invite.role.name}</Badge>
                                <Badge variant={urgent ? "destructive" : "outline"}>
                                    {daysLeft <= 0 ? "expired" : `expires in ${daysLeft}d`}
                                </Badge>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <AlertDialog open={revokingId !== null} onOpenChange={(open) => !open && setRevokingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The invited user will no longer be able to accept it. They can always be re-invited later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleRevoke();
                            }}
                            disabled={isRevoking}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRevoking ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Revoking...
                                </>
                            ) : (
                                "Revoke Invite"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
