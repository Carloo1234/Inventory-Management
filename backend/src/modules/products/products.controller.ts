import type { Request, Response } from "express";
import { ApiResponse } from "../../utils/apiResponse";
import { getSessionIdAndSessionData } from "../../utils/generalUtils";
import type { ProductsServices } from "./products.services";
import type {
    attachProductImageSchema,
    createProductSchema,
    uploadProductImageSchema,
    productsQuerySchema,
    productVariantsQuerySchema,
    updateProductSchema,
    updateProductVariantSchema,
} from "./products.schema";
import type z from "zod";

export class ProductsController {
    private services: ProductsServices;
    constructor(services: ProductsServices) {
        this.services = services;
    }

    createProduct = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof createProductSchema> = req.body;
        const result = await this.services.createProduct({ data, shopId });
        return ApiResponse.success(res, 201, result);
    };

    getProducts = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const filters = req.validatedQuery as z.infer<typeof productsQuerySchema>;
        const result = await this.services.getProducts({ shopId, ...filters });
        return ApiResponse.success(res, 200, result);
    };

    getVariants = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId } = req.params;
        if (!shopId || Array.isArray(shopId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const filters = req.validatedQuery as z.infer<typeof productVariantsQuerySchema>;
        const result = await this.services.getVariants({ shopId, ...filters });
        return ApiResponse.success(res, 200, result);
    };

    getProductById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, productId } = req.params;
        if (!shopId || Array.isArray(shopId) || !productId || Array.isArray(productId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getProductById({ productId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    updateProductById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, productId } = req.params;
        if (!shopId || Array.isArray(shopId) || !productId || Array.isArray(productId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof updateProductSchema> = req.body;
        const result = await this.services.updateProductById({ data, productId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    deleteProductById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, productId } = req.params;
        if (!shopId || Array.isArray(shopId) || !productId || Array.isArray(productId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.deleteProductById({ productId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    getVariantById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, variantId } = req.params;
        if (!shopId || Array.isArray(shopId) || !variantId || Array.isArray(variantId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getVariantById({ variantId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    updateVariantById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, variantId } = req.params;
        if (!shopId || Array.isArray(shopId) || !variantId || Array.isArray(variantId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof updateProductVariantSchema> = req.body;
        const result = await this.services.updateVariantById({ data, variantId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    deleteVariantById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, variantId } = req.params;
        if (!shopId || Array.isArray(shopId) || !variantId || Array.isArray(variantId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.deleteVariantById({ variantId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    getProductImages = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, productId } = req.params;
        if (!shopId || Array.isArray(shopId) || !productId || Array.isArray(productId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.getProductImages({ productId, shopId });
        return ApiResponse.success(res, 200, result);
    };

    attachProductImage = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, productId } = req.params;
        if (!shopId || Array.isArray(shopId) || !productId || Array.isArray(productId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const data: z.infer<typeof attachProductImageSchema> = req.body;
        const result = await this.services.attachProductImage({ data, productId, shopId });
        return ApiResponse.success(res, 201, result);
    };

    uploadProductImage = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, productId } = req.params;
        if (!shopId || Array.isArray(shopId) || !productId || Array.isArray(productId))
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        // Multer (memoryStorage) places the single file on req.file; empty
        // multipart bodies are a 400, not a silent no-op.
        console.log("DEBUG upload:", {
            hasFile: !!req.file,
            mimetype: req.file?.mimetype,
            size: req.file?.size,
            fieldname: (req.file as { fieldname?: string } | undefined)?.fieldname,
            body: req.body,
            contentType: req.headers["content-type"]?.slice(0, 60),
        });
        if (!req.file) {
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "No image file provided" });
        }
        const data: z.infer<typeof uploadProductImageSchema> = req.body;
        // Branch explicitly: exactOptionalPropertyTypes forbids forwarding an
        // explicitly-undefined variantId to the optional service prop.
        const file = { buffer: req.file.buffer, mimetype: req.file.mimetype };
        const result =
            data.variantId === undefined
                ? await this.services.uploadProductImage({ shopId, productId, file })
                : await this.services.uploadProductImage({ shopId, productId, variantId: data.variantId, file });
        return ApiResponse.success(res, 201, result);
    };

    deleteProductImageById = async (req: Request, res: Response) => {
        const session = getSessionIdAndSessionData(req, res);
        if (!session) return;
        const { shopId, productId, imageId } = req.params;
        if (
            !shopId ||
            Array.isArray(shopId) ||
            !productId ||
            Array.isArray(productId) ||
            !imageId ||
            Array.isArray(imageId)
        )
            return ApiResponse.error(res, 400, null, null, { type: "error", message: "Invalid request" });

        const result = await this.services.deleteProductImageById({ imageId, shopId });
        return ApiResponse.success(res, 200, result);
    };
}
