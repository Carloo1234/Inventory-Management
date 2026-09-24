import type z from "zod";
import type { createInviteSchema } from "./invites.schema";
import { AppError } from "../../utils/AppError";
import { getPgErrorCode } from "../../utils/db-errors";
import { db, type QueryOptions } from "../../db";
import { shopInvitations } from "../../db/schema";
import { and, eq } from "drizzle-orm";

export class InvitesRepository {
    createInvite = async ({
        invitedUserId,
        invitedByUserId,
        roleId,
        shopId,
    }: {
        invitedUserId: string;
        invitedByUserId: string;
        roleId: string;
        shopId: string;
    }) => {
        try {
            const invite = (
                await db
                    .insert(shopInvitations)
                    .values({
                        invitedByUserId,
                        invitedUserId,
                        roleId,
                        shopId,
                    })
                    .returning()
            )[0];
            if (!invite) throw new AppError("Failed to create invite", 500);
            return invite;
        } catch (error) {
            console.error("Error creating invite:", error);
            if (error instanceof AppError) throw error;
            if (getPgErrorCode(error) === "23505") {
                throw new AppError("Invite already exists", 409);
            }
            throw new AppError("Failed to create invite", 500);
        }
    };

    getInvites = async ({ shopId, queryOptions }: { shopId: string; queryOptions?: QueryOptions }) => {
        const tx = queryOptions?.tx || db;
        try {
            const invites = await tx.query.shopInvitations.findMany({
                where: eq(shopInvitations.shopId, shopId),
                with: {
                    invitedBy: {
                        columns: {
                            id: true,
                            email: true,
                            name: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                    },
                    invitedUser: {
                        columns: {
                            id: true,
                            email: true,
                            name: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                    },
                    role: {
                        columns: {
                            id: true,
                            name: true,
                            permissions: true,
                            createdAt: true,
                        },
                    },
                },
            });
            return invites;
        } catch (error) {
            console.error("Error fetching invites:", error);
            throw new AppError("Failed to fetch invites", 500);
        }
    };

    findByUserId = async ({ userId }: { userId: string }) => {
        try {
            // Personal inbox: invites addressed to this user across all shops.
            // No shop scoping here — ownership is the userId itself.
            const invites = await db.query.shopInvitations.findMany({
                where: eq(shopInvitations.invitedUserId, userId),
                with: {
                    shop: { columns: { id: true, name: true } },
                    invitedBy: {
                        columns: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
                    },
                    invitedUser: {
                        columns: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
                    },
                    role: { columns: { id: true, name: true, permissions: true, createdAt: true } },
                },
            });
            return invites;
        } catch (error) {
            console.error("Error fetching my invites:", error);
            throw new AppError("Failed to fetch invites", 500);
        }
    };

    deleteInvite = async ({
        shopId,
        inviteId,
        queryOptions,
    }: {
        shopId: string;
        inviteId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const deletedRows = await tx
                .delete(shopInvitations)
                .where(and(eq(shopInvitations.id, inviteId), eq(shopInvitations.shopId, shopId)))
                .returning();
            if (deletedRows.length === 0 || !deletedRows[0]) {
                throw new AppError("Invite not found", 404);
            }
            return deletedRows[0];
        } catch (error) {
            console.error("Error deleting invite:", error);
            if (error instanceof AppError) throw error;
            throw new AppError("Failed to delete invite", 500);
        }
    };
}
