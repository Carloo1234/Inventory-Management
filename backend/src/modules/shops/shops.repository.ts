import { and, eq, or } from "drizzle-orm";
import { db, type QueryOptions } from "../../db";
import { shops, users } from "../../db/schema";
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
            const ownedAndManagedShops = await tx.query.users.findFirst({
                where: eq(users.id, userId),
                columns: {},
                with: {
                    shopsOwned: true,
                    managedShops: { columns: {}, with: { shop: true, role: { columns: { permissions: true } } } },
                },
            });
            if (!ownedAndManagedShops)
                throw new AppError("Error occured accessing database, make sure your user exists.", 500);
            return ownedAndManagedShops;
            // const userShops = await tx.select().from(shops).where(eq(shops.ownerId, userId));
            // return userShops;
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.log(`Error in shops.repository>getUserShops, error: ${error}`);
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };

    getShop = async (shopId: string, options?: QueryOptions) => {
        const tx = options?.tx || db;
        try {
            const shop = await tx.query.shops.findFirst({
                where: eq(shops.id, shopId),
                with: {
                    managers: {
                        columns: {
                            managerId: true,
                        },
                        with: {
                            role: {
                                columns: { permissions: true },
                            },
                        },
                    },
                },
            });
            if (!shop) throw new AppError("Shop not found", 404);
            return shop;
        } catch (error) {
            console.log(`Error in shops.repository>getShop, error: ${error}`);
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError("Error occured accessing database, please try again.", 500);
        }
    };

    getUserShop = async (shopId: string, userId: string, options?: QueryOptions) => {
        const shop = await this.getShop(shopId, options);
        // User is owner
        if (shop.ownerId === userId) {
            const cleanShop = {
                id: shop.id,
                name: shop.name,
                createdAt: shop.createdAt,
                updatedAt: shop.updatedAt,
                ownerId: shop.ownerId,
                softDelete: shop.softDelete,
                isOwner: true,
                managerPermissions: null,
            };
            return cleanShop;
        }
        // Loop through managers and return if he is one of them
        for (let manager of shop.managers) {
            if (manager.managerId === userId) {
                const cleanShop = {
                    id: shop.id,
                    name: shop.name,
                    createdAt: shop.createdAt,
                    updatedAt: shop.updatedAt,
                    ownerId: shop.ownerId,
                    softDelete: shop.softDelete,
                    isOwner: false,
                    managerPermissions: manager.role.permissions,
                };
                return cleanShop;
            }
        }
        // He is not owner or manager so reject
        return null;
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
