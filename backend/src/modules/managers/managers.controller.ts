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
        // Self-leave needs authenticate only. Removing anyone else requires
        // manager:delete, so run the same middleware manually for that case.
        // (Route-level validatePermission can't express "self OR permitted".)
        // A no-op next is passed: on success the middleware just returns, and
        // calling the real next() here would wrongly continue Express routing
        // past this handler and risk a double response.
        if (callerId !== managerId) {
            await validatePermission([PERMISSIONS.MANAGER_DELETE.value])(req, res, () => {});
            // validatePermission responds directly on bad params (400); thrown
            // 404/403s go to the error handler. If it responded, stop here.
            if (res.headersSent) return;
        }

        const result = await this.services.removeManager({ shopId, managerId });
        return ApiResponse.success(res, 200, result);
    };
}
