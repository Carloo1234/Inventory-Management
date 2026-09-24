import type z from "zod";
import { ApiResponse } from "../../utils/apiResponse";
import { getSessionIdAndSessionData } from "../../utils/generalUtils";
import { validatePermission } from "../../middleware/validatePermission";
import { PERMISSIONS } from "../../utils/permissions";
import type { updateManagerSchema } from "./managers.schema";
import type { ManagersServices } from "./managers.services";
import type { Request, Response } from "express";

export class ManagersController {
    private services: ManagersServices;
    constructor(services: ManagersServices) {
        this.services = services;
    }

    getManagers = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getManagers({ shopId });
        return ApiResponse.success(res, 200, result);
    };

    getManagerById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, managerId } = req.params;
        if (!shopId || Array.isArray(shopId) || !managerId || Array.isArray(managerId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getManagerById({ shopId, managerId });
        return ApiResponse.success(res, 200, result);
    };

    updateManager = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, managerId } = req.params;
        if (!shopId || Array.isArray(shopId) || !managerId || Array.isArray(managerId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof updateManagerSchema> = req.body;
        const result = await this.services.updateManagerRole({
            data,
            shopId,
            managerId,
            callerId: session.sessionData.userId,
        });
        return ApiResponse.success(res, 200, result);
    };

    removeManager = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, managerId } = req.params;
        if (!shopId || Array.isArray(shopId) || !managerId || Array.isArray(managerId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const callerId = session.sessionData.userId;

        // If another manager deleting another manager (not a manager trying to leave a shop)
        if (callerId !== managerId) {
            // Sends error response if manager has no permission to delete managers
            await validatePermission([PERMISSIONS.MANAGER_DELETE.value])(req, res, () => {});

            // If no permission to delete managers, return.
            if (res.headersSent) return;
        }
        // Here we know that if it is a self delete or if it is a manager deleting another, they are allowed either way.
        const result = await this.services.removeManager({ shopId, managerId, callerId });
        return ApiResponse.success(res, 200, result);
    };
}
