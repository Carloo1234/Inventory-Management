import type z from "zod";
import type { ManagersRepository } from "./managers.repository";
import type { RolesServices } from "../roles/roles.services";
import type { ShopsRepository } from "../shops/shops.repository";
import type { updateManagerSchema } from "./managers.schema";
import { AppError } from "../../utils/AppError";
import { assertGrantable } from "../../utils/grantable";

export class ManagersServices {
    private repository: ManagersRepository;
    private rolesServices: RolesServices;
    private shopRepository: ShopsRepository;
    constructor(repository: ManagersRepository, rolesServices: RolesServices, shopRepository: ShopsRepository) {
        this.repository = repository;
        this.rolesServices = rolesServices;
        this.shopRepository = shopRepository;
    }

    getManagers = async ({ shopId }: { shopId: string }) => {
        const managers = await this.repository.getManagers({ shopId });
        // Clean rows into frontend ready shape
        return managers.map((m) => ({
            managerId: m.managerId,
            user: m.manager,
            role: m.role,
            invitedBy: m.invitedBy,
            createdAt: m.createdAt,
        }));
    };

    getManagerById = async ({ shopId, managerId }: { shopId: string; managerId: string }) => {
        const manager = await this.repository.getManagerById({ shopId, managerId });
        if (!manager) throw new AppError("Manager not found", 404);
        return {
            managerId: manager.managerId,
            user: manager.manager,
            role: manager.role,
            invitedBy: manager.invitedBy,
            createdAt: manager.createdAt,
        };
    };

    updateManagerRole = async ({
        data,
        shopId,
        managerId,
        callerId,
    }: {
        data: z.infer<typeof updateManagerSchema>;
        shopId: string;
        managerId: string;
        callerId: string;
    }) => {
        // Guard 1: target must be a manager of this shop, never the owner.
        const target = await this.shopRepository.getUserShop(shopId, managerId);
        if (!target) throw new AppError("Manager not found", 404);
        if (target.isOwner) throw new AppError("Cannot change the role of the shop owner", 400);

        // Guard 2: new role must exist and belong to this shop (404 otherwise, thrown inside).
        const newRole = await this.rolesServices.getRoleById(data.roleId, shopId);

        // Guard 3: Make sure manager isnt updating other manager role to include more permissions than he does
        const caller = await this.shopRepository.getUserShop(shopId, callerId);
        if (!caller) throw new AppError("You are not a member of this shop", 403);
        assertGrantable({
            callerIsOwner: caller.isOwner,
            callerPermissions: caller.managerPermissions,
            targetPermissions: newRole.permissions,
        });

        // Finally update role if no errors or issues occur above
        return this.repository.updateManagerRole({ shopId, managerId, roleId: data.roleId });
    };

    removeManager = async ({ shopId, managerId }: { shopId: string; managerId: string }) => {
        // Controller checks everything related to self manager remove or not and checks permission if not self delete but not owner
        const target = await this.shopRepository.getUserShop(shopId, managerId);
        if (!target) throw new AppError("Manager not found", 404);
        if (target.isOwner) throw new AppError("Cannot remove the shop owner", 400);

        return this.repository.removeManager({ shopId, managerId });
    };
}
