import type z from "zod";
import { ApiResponse } from "../../utils/apiResponse";
import { getSessionIdAndSessionData } from "../../utils/generalUtils";
import type {
    createAttributeNameSchema,
    createAttributeValueSchema,
    updateAttributeNameSchema,
    updateAttributeValueSchema,
} from "./attributes.schema";
import type { AttributesServices } from "./attributes.services";
import type { Request, Response } from "express";

export class AttributesController {
    private services: AttributesServices;
    constructor(services: AttributesServices) {
        this.services = services;
    }

    createAttributeName = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof createAttributeNameSchema> = req.body;
        const result = await this.services.createAttributeName({ data, shopId });
        return ApiResponse.success(res, 201, result);
    };

    getAttributeNames = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getAttributeNames({ shopId });
        return ApiResponse.success(res, 200, result);
    };

    getAttributeNameById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, attributeNameId } = req.params;
        if (!shopId || Array.isArray(shopId) || !attributeNameId || Array.isArray(attributeNameId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getAttributeNameById({ attributeNameId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    updateAttributeNameById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, attributeNameId } = req.params;
        if (!shopId || Array.isArray(shopId) || !attributeNameId || Array.isArray(attributeNameId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof updateAttributeNameSchema> = req.body;
        const result = await this.services.updateAttributeNameById({ data, attributeNameId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    deleteAttributeNameById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, attributeNameId } = req.params;
        if (!shopId || Array.isArray(shopId) || !attributeNameId || Array.isArray(attributeNameId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.deleteAttributeNameById({ attributeNameId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    createAttributeValue = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, attributeNameId } = req.params;
        if (!shopId || Array.isArray(shopId) || !attributeNameId || Array.isArray(attributeNameId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof createAttributeValueSchema> = req.body;
        const result = await this.services.createAttributeValue({
            attributeNameId,
            shopId,
            value: data.value,
        });
        return ApiResponse.success(res, 201, result);
    };

    getAttributeValues = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, attributeNameId } = req.params;
        if (!shopId || Array.isArray(shopId) || !attributeNameId || Array.isArray(attributeNameId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getAttributeValues({ attributeNameId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    getAttributeValueById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, attributeNameId, attributeValueId } = req.params;
        if (
            !shopId ||
            Array.isArray(shopId) ||
            !attributeNameId ||
            Array.isArray(attributeNameId) ||
            !attributeValueId ||
            Array.isArray(attributeValueId)
        )
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getAttributeValueById({ attributeNameId, attributeValueId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    updateAttributeValueById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, attributeNameId, attributeValueId } = req.params;
        if (
            !shopId ||
            Array.isArray(shopId) ||
            !attributeNameId ||
            Array.isArray(attributeNameId) ||
            !attributeValueId ||
            Array.isArray(attributeValueId)
        )
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof updateAttributeValueSchema> = req.body;
        const result = await this.services.updateAttributeValueById({
            data,
            attributeNameId,
            attributeValueId,
            shopId,
        });
        return ApiResponse.success(res, 200, result);
    };

    deleteAttributeValueById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, attributeNameId, attributeValueId } = req.params;
        if (
            !shopId ||
            Array.isArray(shopId) ||
            !attributeNameId ||
            Array.isArray(attributeNameId) ||
            !attributeValueId ||
            Array.isArray(attributeValueId)
        )
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.deleteAttributeValueById({ attributeNameId, attributeValueId, shopId });
        return ApiResponse.success(res, 200, result);
    };
}
