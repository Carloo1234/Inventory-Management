import { and, eq } from "drizzle-orm";
import { db, type QueryOptions } from "../../db";
import { shops } from "../../db/schema";
import { AppError } from "../../utils/AppError";
import type { PatchShopBody } from "./shops.schemas";

export class ShopsRepository {
    getUserShopsCount = async (userId: string, options?: QueryOptions) => {
        const tx = options?.tx || db;
        const count = await tx.$count(shops, eq(shops.ownerId, userId));
        return count;
    };
    createShop = async (name: string, ownerId: string, options?: QueryOptions) => {
        const tx = options?.tx || db;
        try {
            const shop = await tx.insert(shops).values({ name, ownerId }).returning();
            return shop[0];
        } catch (error) {
            console.log(error);
            throw new AppError("Database error occured creating shop.", 500);
        }
    };
    getUserShops = async (userId: string, options?: QueryOptions) => {
        const tx = options?.tx || db;
        try {
            const userShops = await tx.select().from(shops).where(eq(shops.ownerId, userId));
            return userShops;
        } catch (error) {
            console.log(`Error in shops.repository>getUserShops, error: ${error}`);
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };

    getShop = async (shopId: string, options?: QueryOptions) => {
        const tx = options?.tx || db;
        try {
            const shop = await tx.select().from(shops).where(eq(shops.id, shopId)).limit(1);
            if (shop.length <= 0) {
                return null;
            }
            return shop[0];
        } catch (error) {
            console.log(`Error in shops.repository>getShop, error: ${error}`);
            throw new AppError("Error occured accessing databsae, please try again.", 500);
        }
    };

    softDeleteShop = async (shopId: string, userId: string, options?: QueryOptions) => {
        const tx = options?.tx || db;
        try {
            const updatedShops = await tx
                .update(shops)
                .set({ softDelete: true })
                .where(and(eq(shops.id, shopId), eq(shops.ownerId, userId)))
                .returning();
            if (updatedShops.length <= 0) {
                return null;
            }
            return updatedShops[0];
        } catch (error) {
            console.log(`Error in shops.repository>getShop, error: ${error}`);
            throw new AppError("Error occured accessing databsae, please try again.", 500);
        }
    };

    updateShop = async (shopId: string, userId: string, data: PatchShopBody, options?: QueryOptions) => {
        const tx = options?.tx || db;
        try {
            const updatedShop = (
                await db
                    .update(shops)
                    .set(data)
                    .where(and(eq(shops.id, shopId), eq(shops.ownerId, userId)))
                    .returning()
            )[0];
            if (!updatedShop) {
                return null;
            }
            return updatedShop;
        } catch (error) {
            console.log(`Error in shops.repository>updateShop, error: ${error}`);
            throw new AppError("Error occured accessing databsae, please try again.", 500);
        }
    };
}
