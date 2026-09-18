import type z from "zod";
import { ApiResponse } from "../../utils/apiResponse";
import { getSessionIdAndSessionData } from "../../utils/generalUtils";
import type { createInviteSchema } from "./invites.schema";
import type { InvitesServices } from "./invites.services";
import type { Request, Response } from "express";

export class InvitesController {
    private services: InvitesServices;
    constructor(services: InvitesServices) {
        this.services = services;
    }

    createInvite = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof createInviteSchema> = req.body;
        const result = await this.services.createInvite({
            shopId,
            invitedUserEmail: data.email,
            invitedByUserId: session.sessionData.userId,
            roleId: data.roleId,
        });
        return ApiResponse.success(res, 201, result);
    };

    getInvites = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });
        const invites = await this.services.getInvites({ shopId });
        return ApiResponse.success(res, 200, invites);
    };

    getInviteById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, inviteId } = req.params;
        if (!shopId || Array.isArray(shopId) || !inviteId || Array.isArray(inviteId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        // Inefficient approach for speed, but ensures invite belongs to shop. Could be optimized in the future.
        const invites = await this.services.getInvites({ shopId });
        const invite = invites.find((inv) => inv.id === inviteId);
        if (!invite) return ApiResponse.error(res, 404, null, null, { type: "error", message: "Invite not found" });
        return ApiResponse.success(res, 200, invite);
    };

    // Revoke an invite
    deleteInvite = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, inviteId } = req.params;
        if (!shopId || Array.isArray(shopId) || !inviteId || Array.isArray(inviteId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const deletedInvite = await this.services.deleteInvite({ shopId, inviteId });
        if (!deletedInvite)
            return ApiResponse.error(res, 404, null, null, { type: "error", message: "Invite not found" });
        return ApiResponse.success(res, 200, deletedInvite);
    };

    acceptInvite = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, inviteId } = req.params;
        if (!shopId || Array.isArray(shopId) || !inviteId || Array.isArray(inviteId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const { manager, invite } = await this.services.acceptInvite({
            shopId,
            inviteId,
            userId: session.sessionData.userId,
        });

        return ApiResponse.success(res, 201, manager, {
            type: "success",
            message: `Invite accepted, you are now a manager of this shop.`,
        });
    };
}
