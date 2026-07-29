import type { Request, Response } from "express";
import { ApiResponse } from "../../utils/apiResponse";
import type { ShopsServices } from "./shops.services";

export class ShopsController {
    private shopServices: ShopsServices;
    constructor(shopServices: ShopsServices) {
        this.shopServices = shopServices;
    }
    createShop = async (req: Request, res: Response) => {
        // Reqeust validated to include name of shop

        // needed for typescript
        if (!req.sessionData)
            return ApiResponse.error(res, 401, null, null, {
                type: "error",
                message: "Problem occurred authenticating your session. Please log in again.",
            });
        const shop = await this.shopServices.createShop(req.body.name, req.sessionData.userId);
        return ApiResponse.success(res, 201, null, {
            type: "success",
            message: `Successfully created shop ${shop.name}`,
        });
    };

    getMyShops = async (req: Request, res: Response) => {
        const { sessionId, sessionData } = { sessionId: req.sessionId!, sessionData: req.sessionData! };

        const shops = await this.shopServices.getUserShops(sessionData.userId);
        return ApiResponse.success(res, 200, { shops: shops });
    };

    getShop = async (req: Request, res: Response) => {
        const { sessionId, sessionData } = { sessionId: req.sessionId!, sessionData: req.sessionData! };
        const shopId = req.params.shopId;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const shopData = await this.shopServices.getShop(shopId, sessionData.userId);
        return ApiResponse.success(res, 200, { shopData });
    };

    deleteShop = async (req: Request, res: Response) => {
        const { sessionId, sessionData } = { sessionId: req.sessionId!, sessionData: req.sessionData! };
        const shopId = req.params.shopId;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });
        const updatedShop = await this.shopServices.deleteShop(shopId, sessionData.userId);
        return ApiResponse.success(res, 204, null, null, null);
    };
}
