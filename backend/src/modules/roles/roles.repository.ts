import type z from "zod";
import type { createRoleSchema, updateRoleSchema } from "./roles.schema";
import { db } from "../../db";
import { roles } from "../../db/schema";
import { AppError } from "../../utils/AppError";
import { getPgErrorCode } from "../../utils/db-errors";
import { and, eq } from "drizzle-orm";

export class RolesRepository {
    createRole = async ({ role, shopId }: { role: z.infer<typeof createRoleSchema>; shopId: string }) => {
        try {
            const data = await db
                .insert(roles)
                .values({
                    name: role.name,
                    permissions: role.permissions || [],
                    shopId,
                })
                .returning();
            return data[0];
        } catch (error) {
            console.error("Error creating role:", error);
            throw new AppError("Failed to create role", 500);
        }
    };

    getRoles = async ({ shopId }: { shopId: string }) => {
        try {
            const data = await db.query.roles.findMany({
                where: eq(roles.shopId, shopId),
            });
            return data;
        } catch (error) {
            console.error("Error fetching roles:", error);
            throw new AppError("Failed to fetch roles", 500);
        }
    };

    getRoleById = async (roleId: string) => {
        try {
            const data = await db.query.roles.findFirst({
                where: eq(roles.id, roleId),
            });
            if (!data) throw new AppError("Role not found", 404);
            return data;
        } catch (error) {
            console.error("Error fetching roles:", error);
            if (error instanceof AppError) throw error;
            throw new AppError("Failed to fetch roles", 500);
        }
    };

    updateRole = async ({
        role,
        shopId,
        roleId,
    }: {
        role: z.infer<typeof updateRoleSchema>;
        shopId: string;
        roleId: string;
    }) => {
        try {
            if (!role.permissions) {
                const data = await db
                    .update(roles)
                    .set({
                        name: role.name,
                    })
                    .where(and(eq(roles.id, roleId), eq(roles.shopId, shopId)))
                    .returning();
                if (!data[0]) throw new AppError("Role not found", 404);
                return data[0];
            }

            const data = await db
                .update(roles)
                .set({
                    name: role.name,
                    permissions: role.permissions,
                    shopId,
                })
                .where(and(eq(roles.id, roleId), eq(roles.shopId, shopId)))
                .returning();
            if (!data[0]) throw new AppError("Role not found", 404);
            return data[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            console.error("Error updating role:", error);
            throw new AppError("Failed to update role", 500);
        }
    };

    deleteRole = async ({ shopId, roleId }: { shopId: string; roleId: string }) => {
        try {
            const data = await db
                .delete(roles)
                .where(and(eq(roles.id, roleId), eq(roles.shopId, shopId)))
                .returning();
            if (!data[0]) throw new AppError("Role not found", 404);
            return data[0];
        } catch (error) {
            if (error instanceof AppError) throw error;
            if (getPgErrorCode(error) === "23503") {
                console.error("Error deleting role:", error);
                throw new AppError("There are managers or invites using this role.", 409);
            }
            console.error("Error deleting role:", error);
            throw new AppError("Failed to delete role", 500);
        }
    };
}
