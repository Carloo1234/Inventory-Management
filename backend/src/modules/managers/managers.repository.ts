import { db, type QueryOptions } from "../../db";
import { shopManagers } from "../../db/schema";
import { AppError } from "../../utils/AppError";
import { getPgErrorCode } from "../../utils/db-errors";

export class ManagersRepository {
    // Implement methods for managing managers in the database
    async addManager({
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
    }) {
        // Logic to add a manager to the shop
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
            console.log(error?.constructor.name);
            if (getPgErrorCode(error) === "23505") {
                throw new AppError("You are already a manager in this shop", 400);
            }
            if (error instanceof AppError) throw error;
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    }
}
