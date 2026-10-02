import { v7 as uuidv7 } from "uuid";
import type z from "zod";
import type { ProductsRepository } from "./products.repository";
import type {
    attachProductImageSchema,
    createProductSchema,
    productsQuerySchema,
    productVariantsQuerySchema,
    updateProductSchema,
    updateProductVariantSchema,
} from "./products.schema";
import { AppError } from "../../utils/AppError";
import { extensionForMimetype, storage } from "../../utils/storage";

export class ProductsServices {
    private repository: ProductsRepository;
    constructor(repository: ProductsRepository) {
        this.repository = repository;
    }

    createProduct = async ({ data, shopId }: { data: z.infer<typeof createProductSchema>; shopId: string }) => {
        const product = await this.repository.createProduct({ data, shopId });
        return product;
    };

    getProducts = async ({
        shopId,
        page,
        limit,
        search,
        sortBy,
        sortOrder,
    }: { shopId: string } & z.infer<typeof productsQuerySchema>) => {
        const products = await this.repository.getProducts({ shopId, page, limit, search, sortBy, sortOrder });
        return products;
    };

    getVariants = async ({
        shopId,
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        barcode,
    }: { shopId: string } & z.infer<typeof productVariantsQuerySchema>) => {
        const variants = await this.repository.getVariants({
            shopId,
            page,
            limit,
            search,
            sortBy,
            sortOrder,
            barcode,
        });
        return variants;
    };

    getProductById = async ({ productId, shopId }: { productId: string; shopId: string }) => {
        return this.repository.getProductById({ productId, shopId });
    };

    updateProductById = async ({
        data,
        productId,
        shopId,
    }: {
        data: z.infer<typeof updateProductSchema>;
        productId: string;
        shopId: string;
    }) => {
        // Empty PATCH body would be a silent no-op — reject it loudly instead.
        if (
            data.name === undefined &&
            data.description === undefined &&
            (data.variants === undefined || data.variants.length === 0)
        ) {
            throw new AppError("Nothing to update", 400);
        }
        return this.repository.updateProductById({ productId, shopId, data });
    };

    deleteProductById = async ({ productId, shopId }: { productId: string; shopId: string }) => {
        // Collect image URLs BEFORE the cascading delete, then clean files
        // best effort afterwards (a file failure must never fail the request).
        const images = await this.repository.getProductImages({ productId, shopId });
        const deleted = await this.repository.deleteProductById({ productId, shopId });
        for (const image of images) {
            await storage.remove(image.url);
        }
        return deleted;
    };

    getVariantById = async ({ variantId, shopId }: { variantId: string; shopId: string }) => {
        return this.repository.getVariantById({ variantId, shopId });
    };

    updateVariantById = async ({
        data,
        variantId,
        shopId,
    }: {
        data: z.infer<typeof updateProductVariantSchema>;
        variantId: string;
        shopId: string;
    }) => {
        if (
            data.sku === undefined &&
            data.barcode === undefined &&
            data.price === undefined &&
            data.quantity === undefined &&
            data.attributeValueIds === undefined
        ) {
            throw new AppError("Nothing to update", 400);
        }
        return this.repository.updateVariantById({ variantId, shopId, data });
    };

    deleteVariantById = async ({ variantId, shopId }: { variantId: string; shopId: string }) => {
        const current = await this.repository.getVariantById({ variantId, shopId });
        const deleted = await this.repository.deleteVariantById({ variantId, shopId });
        for (const image of current.images) {
            await storage.remove(image.url);
        }
        return deleted;
    };

    getProductImages = async ({ productId, shopId }: { productId: string; shopId: string }) => {
        return this.repository.getProductImages({ productId, shopId });
    };

    attachProductImage = async ({
        data,
        productId,
        shopId,
    }: {
        data: z.infer<typeof attachProductImageSchema>;
        productId: string;
        shopId: string;
    }) => {
        return data.variantId === undefined
            ? this.repository.addProductImage({ shopId, productId, url: data.url })
            : this.repository.addProductImage({ shopId, productId, variantId: data.variantId, url: data.url });
    };

    deleteProductImageById = async ({ imageId, shopId }: { imageId: string; shopId: string }) => {
        const deleted = await this.repository.deleteProductImageById({ imageId, shopId });
        // Best-effort file cleanup: a file failure must never fail the request
        await storage.remove(deleted.url);
        return deleted;
    };

    uploadProductImage = async ({
        shopId,
        productId,
        variantId,
        file,
    }: {
        shopId: string;
        productId: string;
        variantId?: string;
        file: { buffer: Buffer; mimetype: string };
    }) => {
        const ext = extensionForMimetype(file.mimetype);

        if (!ext) throw new AppError("Only JPEG, PNG, WebP or GIF images are allowed", 400);
        const filename = `${uuidv7()}.${ext}`;

        const created =
            variantId === undefined
                ? await this.repository.addProductImage({
                      shopId,
                      productId,
                      url: `/uploads/${shopId}/${filename}`,
                  })
                : await this.repository.addProductImage({
                      shopId,
                      productId,
                      variantId,
                      url: `/uploads/${shopId}/${filename}`,
                  });
        try {
            await storage.save({ shopId, filename, buffer: file.buffer, mimetype: file.mimetype });
        } catch (error) {
            await this.repository.deleteProductImageById({ imageId: created.id, shopId });
            console.log("Rolled back image row after failed file write:", error);
            throw new AppError("Failed to save image, please try again", 500);
        }
        return created;
    };
}
