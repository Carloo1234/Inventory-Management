import type z from "zod";
import { PERMISSIONS } from "../../utils/permissions";
import { ROLE_PRESETS } from "../../utils/role-presets";
import type { RolesRepository } from "./roles.repository";
import type { ManagersRepository } from "../managers/managers.repository";
import type { ShopsRepository } from "../shops/shops.repository";
import type { createRoleSchema, updateRoleSchema } from "./roles.schema";
import { AppError } from "../../utils/AppError";
import { assertGrantable, assertStrictlyJunior } from "../../utils/grantable";

export class RolesServices {
    private repository: RolesRepository;
    private managersRepository: ManagersRepository;
    private shopRepository: ShopsRepository;
    constructor(repository: RolesRepository, managersRepository: ManagersRepository, shopRepository: ShopsRepository) {
        this.repository = repository;
        this.managersRepository = managersRepository;
        this.shopRepository = shopRepository;
    }

    getPermissions = () => {
        return PERMISSIONS;
    };

    getPermissionPresets = () => {
        return ROLE_PRESETS;
    };

    createRole = async ({
        data,
        shopId,
        callerId,
    }: {
        data: z.infer<typeof createRoleSchema>;
        shopId: string;
        callerId: string;
    }) => {
        // Anti-escalation gate: caller may only create roles with permissions they hold.
        await this.assertCallerMayGrant({ shopId, callerId, targetPermissions: data.permissions ?? [] });
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
        callerId,
    }: {
        data: z.infer<typeof updateRoleSchema>;
        shopId: string;
        roleId: string;
        callerId: string;
    }) => {
        // Ensure the role exists in this shop first (404 otherwise, thrown inside).
        const current = await this.getRoleById(roleId, shopId);
        // Rank gate on the CURRENT set: peers, seniors, and your own role are
        // untouchable — renames included. Self-lockout is structurally impossible.
        await this.assertCallerManagesRank({ shopId, callerId, targetPermissions: current.permissions });
        // Anti-escalation gate on the new permission set (no-op when omitted).
        if (data.permissions !== undefined) {
            await this.assertCallerMayGrant({ shopId, callerId, targetPermissions: data.permissions });
        }
        const role = await this.repository.updateRole({ role: data, shopId, roleId });
        // Who is affected: managers currently holding this role, for frontend warning.
        const managerIds = await this.managersRepository.countByRoleId({ shopId, roleId });
        return { role, affectedManagers: { count: managerIds.length, managerIds } };
    };

    deleteRole = async ({ shopId, roleId, callerId }: { shopId: string; roleId: string; callerId: string }) => {
        // Rank gate: deleting a senior's role is the same sabotage as editing it.
        const current = await this.getRoleById(roleId, shopId);
        await this.assertCallerManagesRank({ shopId, callerId, targetPermissions: current.permissions });
        const result = await this.repository.deleteRole({ shopId, roleId });
        return result;
    };

    doesRoleBelongToShop = async ({ roleId, shopId }: { roleId: string; shopId: string }) => {
        const role = await this.repository.getRoleById(roleId);
        return role.shopId === shopId;
    };

    private assertCallerManagesRank = async ({
        shopId,
        callerId,
        targetPermissions,
    }: {
        shopId: string;
        callerId: string;
        targetPermissions: string[];
    }) => {
        // Same membership lookup as the grant gate; rank rule differs.
        const caller = await this.shopRepository.getUserShop(shopId, callerId);
        if (!caller) throw new AppError("You are not a member of this shop", 403);
        assertStrictlyJunior({
            callerIsOwner: caller.isOwner,
            callerPermissions: caller.managerPermissions,
            targetPermissions,
        });
    };

    private assertCallerMayGrant = async ({
        shopId,
        callerId,
        targetPermissions,
    }: {
        shopId: string;
        callerId: string;
        targetPermissions: string[];
    }) => {
        // getUserShop verified: owner row has isOwner + null perms, managers
        // carry live permissions, null = non-member (unreachable here since
        // route middleware already enforced membership, but stay defensive).
        const caller = await this.shopRepository.getUserShop(shopId, callerId);
        if (!caller) throw new AppError("You are not a member of this shop", 403);
        assertGrantable({
            callerIsOwner: caller.isOwner,
            callerPermissions: caller.managerPermissions,
            targetPermissions,
        });
    };
}
