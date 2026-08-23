import { getSessionIdAndSessionData } from "../../utils/generalUtils";
import type { RolesServices } from "./roles.services";
import type { Request, Response } from "express";

export class RolesController {
    private services: RolesServices;
    constructor(services: RolesServices) {
        this.services = services;
    }

    getPermissions = (req: Request, res: Response) => {
        const { sessionId, sessionData } = { ...getSessionIdAndSessionData(req, res) };
        if (!sessionId || !sessionData) return;
        return this.services.getPermissions();
    };
}
