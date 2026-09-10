import type z from "zod";
import { ApiResponse } from "../../utils/apiResponse";
import { getSessionIdAndSessionData } from "../../utils/generalUtils";
import type { createRoleSchema, updateRoleSchema } from "./roles.schema";
import type { RolesServices } from "./roles.services";
import type { Request, Response } from "express";

export class RolesController {
    private services: RolesServices;
    constructor(services: RolesServices) {
        this.services = services;
    }

    getPermissions = (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const result = this.services.getPermissions();
        return ApiResponse.success(res, 200, result);
    };

    createRole = async (req: Request, res: Response) => {
        const { sessionId, sessionData } = { ...getSessionIdAndSessionData(req, res) };
        if (!sessionId || !sessionData)
            return ApiResponse.error(res, 401, null, null, {
                type: "error",
                message: "Problem occurred authenticating your session.",
            });
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof createRoleSchema> = req.body;
        const result = await this.services.createRole({ data, shopId });
        return ApiResponse.success(res, 201, result);
    };

    getRoles = async (req: Request, res: Response) => {
        const { sessionId, sessionData } = { ...getSessionIdAndSessionData(req, res) };
        if (!sessionId || !sessionData) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getRoles({ shopId });
        return ApiResponse.success(res, 200, result);
    };

    updateRole = async (req: Request, res: Response) => {
        const { sessionId, sessionData } = { ...getSessionIdAndSessionData(req, res) };
        if (!sessionId || !sessionData) return;
        const { shopId, roleId } = req.params;
        if (!shopId || Array.isArray(shopId) || !roleId || Array.isArray(roleId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof updateRoleSchema> = req.body;
        const result = await this.services.updateRole({ data, shopId, roleId });
        if (!result) return ApiResponse.error(res, 404, null, null, { type: "error", message: "Role not found" });
        return ApiResponse.success(res, 200, result);
    };

    deleteRole = async (req: Request, res: Response) => {
        const { sessionId, sessionData } = { ...getSessionIdAndSessionData(req, res) };
        if (!sessionId || !sessionData) return;
        const { shopId, roleId } = req.params;
        if (!shopId || Array.isArray(shopId) || !roleId || Array.isArray(roleId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.deleteRole({ shopId, roleId });
        if (!result) return ApiResponse.error(res, 404, null, null, { type: "error", message: "Role not found" });
        return ApiResponse.success(res, 200, result);
    };
}
