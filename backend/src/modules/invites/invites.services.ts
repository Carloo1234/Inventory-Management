import type z from "zod";
import type { InvitesRepository } from "./invites.repository";
import type { createInviteSchema } from "./invites.schema";
import type { AuthRepository } from "../auth/auth.repository";
import { AppError, FormError } from "../../utils/AppError";
import { create } from "node:domain";
import type { RolesServices } from "../roles/roles.services";
import e from "express";
import type { ShopsRepository } from "../shops/shops.repository";
import type { ManagersRepository } from "../managers/managers.repository";
import { db } from "../../db";

export class InvitesServices {
    private repository: InvitesRepository;
    private userRepository: AuthRepository;
    private rolesServices: RolesServices;
    private shopRepository: ShopsRepository;
    private managerRepository: ManagersRepository;
    constructor(
        repository: InvitesRepository,
        userRepository: AuthRepository,
        rolesServices: RolesServices,
        shopRepository: ShopsRepository,
        managerRepository: ManagersRepository,
    ) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.rolesServices = rolesServices;
        this.shopRepository = shopRepository;
        this.managerRepository = managerRepository;
    }

    createInvite = async ({
        shopId,
        invitedUserEmail,
        invitedByUserId,
        roleId,
    }: {
        shopId: string;
        invitedUserEmail: string;
        invitedByUserId: string;
        roleId: string;
    }) => {
        // Make sure user exists
        const user = await this.userRepository.getUserWithEmail(invitedUserEmail);
        if (!user)
            throw new FormError("User with this email does not exist", 404, {
                formErrors: [],
                fieldErrors: { email: ["User with this email does not exist"] },
            });

        // Make sure role belongs to shop
        const roleBelongsToShop = await this.rolesServices.doesRoleBelongToShop({ roleId, shopId });
        if (!roleBelongsToShop) {
            throw new AppError("Role does not belong to this shop", 400);
        }

        // Make sure user is not already an owner or member of the shop
        const data = await this.shopRepository.getUserShop(shopId, user.id);
        if (data) {
            throw new FormError("User is already a member of this shop", 400, {
                formErrors: [],
                fieldErrors: {
                    email: [
                        data.isOwner
                            ? "User is already an owner of this shop"
                            : "User is already a member of this shop",
                    ],
                },
            });
        }
        const invite = await this.repository.createInvite({ invitedUserId: user.id, invitedByUserId, roleId, shopId });
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
            invite,
        };
    };

    getInvites = async ({ shopId }: { shopId: string }) => {
        const invites = await this.repository.getInvites({ shopId });
        const clean = invites.map((invite) => ({
            id: invite.id,
            invitedBy: {
                id: invite.invitedBy.id,
                email: invite.invitedBy.email,
                name: invite.invitedBy.name,
                createdAt: invite.invitedBy.createdAt,
                updatedAt: invite.invitedBy.updatedAt,
            },
            invitedUser: {
                id: invite.invitedUser.id,
                email: invite.invitedUser.email,
                name: invite.invitedUser.name,
                createdAt: invite.invitedUser.createdAt,
                updatedAt: invite.invitedUser.updatedAt,
            },
            role: {
                id: invite.role.id,
                name: invite.role.name,
                permissions: invite.role.permissions,
                createdAt: invite.role.createdAt,
            },
            shopId: invite.shopId,
            createdAt: invite.createdAt,
            updatedAt: invite.updatedAt,
            expiresAt: invite.expiresAt,
        }));
        return clean;
    };

    deleteInvite = async ({ shopId, inviteId }: { shopId: string; inviteId: string }) => {
        const result = await this.repository.deleteInvite({ shopId, inviteId });
        return result;
    };

    acceptInvite = async ({ shopId, inviteId, userId }: { shopId: string; inviteId: string; userId: string }) => {
        /* 
    Steps to accept an invite:
    1. Check if the invite exists and belongs to the shop.
    2. Check if the invite is for the user trying to accept it.
    3. Add the user to the shop with the role specified in the invite.
    4. Delete the invite after successful acceptance.
    5. Return a success response or throw an error if any step fails.
    */

        // 1 & 2. Check if the invite exists and belongs to the shop and is for the user trying to accept it
        const invites = await this.getInvites({ shopId });

        const invite = invites.find((inv) => inv.id === inviteId);
        if (!invite || invite.invitedUser.id !== userId) {
            throw new AppError("Invite not found", 404);
        }

        const manager = await db.transaction(async (tx) => {
            const invites = await this.repository.getInvites({ shopId, queryOptions: { tx, forUpdate: true } });
            if (!invite || invite.invitedUser.id !== userId) {
                throw new AppError("Invite not found", 404);
            }
            if (invite.expiresAt < new Date()) {
                throw new AppError("Invite expired, please ask the shop owner or managers to re-invite you.", 400);
            }

            // 3. Add the user to the shop with the role specified in the invite
            const manager = await this.managerRepository.addManager({
                shopId: invite.shopId,
                userId: invite.invitedUser.id,
                invitedByUserId: invite.invitedBy.id,
                roleId: invite.role.id,
                queryOptions: { tx },
            });

            // 4. Delete the invite after successful acceptance.
            const deletedInvite = await this.repository.deleteInvite({
                shopId: invite.shopId,
                inviteId: invite.id,
                queryOptions: { tx },
            });
            return manager;
        });

        return { manager, invite };
    };
}
