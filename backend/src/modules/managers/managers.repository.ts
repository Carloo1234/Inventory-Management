import { and, eq } from "drizzle-orm";
import { db, type QueryOptions } from "../../db";
import { shopManagers } from "../../db/schema";
import { AppError } from "../../utils/AppError";
import { getPgErrorCode } from "../../utils/db-errors";

export class ManagersRepository {
    addManager = async ({
        shopId,
        userId,
        roleId,
        invitedByUserId,
        queryOptions,
    }: {
        shopId: string;
        userId: string;
        roleId: string;
        invitedByUserId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const managers = await tx
                .insert(shopManagers)
                .values({ shopId, managerId: userId, roleId, invitedByUserId })
                .returning();
            if (!managers || managers.length === 0 || !managers[0]) {
                throw new AppError("Failed to add manager", 500);
            }
            const manager = managers[0];
            return manager;
        } catch (error) {
            console.log(`Error in managers.repository>addManager, error: ${error}`);
            if (getPgErrorCode(error) === "23505") {
                throw new AppError("You are already a manager in this shop", 400);
            }
            if (error instanceof AppError) throw error;
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };

    getManagers = async ({ shopId, queryOptions }: { shopId: string; queryOptions?: QueryOptions }) => {
        const tx = queryOptions?.tx || db;
        try {
            const managers = await tx.query.shopManagers.findMany({
                where: eq(shopManagers.shopId, shopId),
                with: {
                    manager: { columns: { id: true, email: true, name: true, createdAt: true, updatedAt: true } },
                    role: { columns: { id: true, name: true, permissions: true } },
                    invitedBy: { columns: { id: true, email: true, name: true } },
                },
            });
            return managers;
        } catch (error) {
            console.log(`Error in managers.repository>getManagers, error: ${error}`);
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };

    getManagerById = async ({
        shopId,
        managerId,
        queryOptions,
    }: {
        shopId: string;
        managerId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const manager = await tx.query.shopManagers.findFirst({
                // Composite key: a manager row is only addressable within its shop (IDOR guard).
                where: and(eq(shopManagers.shopId, shopId), eq(shopManagers.managerId, managerId)),
                with: {
                    manager: { columns: { id: true, email: true, name: true, createdAt: true, updatedAt: true } },
                    role: { columns: { id: true, name: true, permissions: true } },
                    invitedBy: { columns: { id: true, email: true, name: true } },
                },
            });
            return manager ?? null;
        } catch (error) {
            console.log(`Error in managers.repository>getManagerById, error: ${error}`);
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };

    updateManagerRole = async ({
        shopId,
        managerId,
        roleId,
        queryOptions,
    }: {
        shopId: string;
        managerId: string;
        roleId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const updated = await tx
                .update(shopManagers)
                .set({ roleId })
                .where(and(eq(shopManagers.shopId, shopId), eq(shopManagers.managerId, managerId)))
                .returning();
            if (!updated[0]) throw new AppError("Manager not found", 404);
            return updated[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            // New role deleted (or never existed) between validation and write.
            if (getPgErrorCode(error) === "23503") {
                throw new AppError("Role does not exist", 400);
            }
            console.log(`Error in managers.repository>updateManagerRole, error: ${error}`);
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };

    removeManager = async ({
        shopId,
        managerId,
        queryOptions,
    }: {
        shopId: string;
        managerId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const deleted = await tx
                .delete(shopManagers)
                .where(and(eq(shopManagers.shopId, shopId), eq(shopManagers.managerId, managerId)))
                .returning();
            if (!deleted[0]) throw new AppError("Manager not found", 404);
            return deleted[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(`Error in managers.repository>removeManager, error: ${error}`);
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };

    countByRoleId = async ({
        shopId,
        roleId,
        queryOptions,
    }: {
        shopId: string;
        roleId: string;
        queryOptions?: QueryOptions;
    }) => {
        const tx = queryOptions?.tx || db;
        try {
            const rows = await tx
                .select({ managerId: shopManagers.managerId })
                .from(shopManagers)
                .where(and(eq(shopManagers.shopId, shopId), eq(shopManagers.roleId, roleId)));
            return rows.map((r) => r.managerId);
        } catch (error) {
            console.log(`Error in managers.repository>countByRoleId, error: ${error}`);
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };
}
