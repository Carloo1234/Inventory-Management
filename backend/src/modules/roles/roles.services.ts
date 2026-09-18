import type z from "zod";
import { PERMISSIONS } from "../../utils/permissions";
import type { RolesRepository } from "./roles.repository";
import type { createRoleSchema, updateRoleSchema } from "./roles.schema";
import { AppError } from "../../utils/AppError";

export class RolesServices {
    private repository: RolesRepository;
    constructor(repository: RolesRepository) {
        this.repository = repository;
    }

    getPermissions = () => {
        return PERMISSIONS;
    };

    createRole = async ({ data, shopId }: { data: z.infer<typeof createRoleSchema>; shopId: string }) => {
        const role = await this.repository.createRole({ role: data, shopId });
        return role;
    };

    getRoles = async ({ shopId }: { shopId: string }) => {
        const roles = await this.repository.getRoles({ shopId });
        return roles;
    };

    getRoleById = async (roleId: string, shopId: string) => {
        const role = await this.repository.getRoleById(roleId);
        if (role.shopId !== shopId) {
            throw new AppError("Role not found", 404);
        }
        return role;
    };

    updateRole = async ({
        data,
        shopId,
        roleId,
    }: {
        data: z.infer<typeof updateRoleSchema>;
        shopId: string;
        roleId: string;
    }) => {
        const role = await this.repository.updateRole({ role: data, shopId, roleId });
        return role;
    };

    deleteRole = async ({ shopId, roleId }: { shopId: string; roleId: string }) => {
        const result = await this.repository.deleteRole({ shopId, roleId });
        return result;
    };

    doesRoleBelongToShop = async ({ roleId, shopId }: { roleId: string; shopId: string }) => {
        const role = await this.repository.getRoleById(roleId);
        return role.shopId === shopId;
    };
}
