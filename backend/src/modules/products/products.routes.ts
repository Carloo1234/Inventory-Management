import { Router } from "express";
import { ProductsRepository } from "./products.repository";
import { ProductsServices } from "./products.services";
import { ProductsController } from "./products.controller";
import { authenticate } from "../../middleware/authentication";
import { validatePermission } from "../../middleware/validatePermission";
import { validateRequest } from "../../middleware/validateRequest";
import { validateQuery } from "../../middleware/validateQuery";
import { PERMISSIONS } from "../../utils/permissions";
import {
    attachProductImageSchema,
    createProductSchema,
    productsQuerySchema,
    productVariantsQuerySchema,
    updateProductSchema,
    updateProductVariantSchema,
} from "./products.schema";

// "/shops/:shopId/products" is the base path for this router, so all routes here are relative to that
// Merge params allows this child products router, to see shopId param in the routed shops module.
const router = Router({ mergeParams: true });

const productsRepository = new ProductsRepository();
const productsServices = new ProductsServices(productsRepository);
const productsController = new ProductsController(productsServices);

// Create product (with nested variants). Controller: createProduct.
router.post(
    "/",
    authenticate,
    validateRequest(createProductSchema),
    validatePermission([PERMISSIONS.PRODUCT_CREATE.value]),
    productsController.createProduct,
);
// List products, paginated. Filters live on req.validatedQuery (see validateQuery).
// Controller: getProducts.
router.get(
    "/",
    authenticate,
    validateQuery(productsQuerySchema),
    validatePermission([PERMISSIONS.PRODUCT_READ.value]),
    productsController.getProducts,
);
// Flat variants list (individually sortable, barcode lookup for scanners).
// Registered BEFORE /:productId so "variants" is never parsed as an id.
// Controller: getVariants (reads filters from req.validatedQuery).
router.get(
    "/variants",
    authenticate,
    validateQuery(productVariantsQuerySchema),
    validatePermission([PERMISSIONS.PRODUCT_READ.value]),
    productsController.getVariants,
);
// Product detail with variants, attributes and images. Controller: getProductById.
router.get(
    "/:productId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_READ.value]),
    productsController.getProductById,
);
// Patch product + nested variant upserts. Controller: updateProductById.
router.patch(
    "/:productId",
    authenticate,
    validateRequest(updateProductSchema),
    validatePermission([PERMISSIONS.PRODUCT_UPDATE.value]),
    productsController.updateProductById,
);
// Delete product (variants/links/images cascade). Controller: deleteProductById.
router.delete(
    "/:productId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_DELETE.value]),
    productsController.deleteProductById,
);
// Single variant detail. Static "variants" prefix keeps it clear of :productId.
router.get(
    "/variants/:variantId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_READ.value]),
    productsController.getVariantById,
);
// Single variant patch (quick price/stock/role edits without full product body).
router.patch(
    "/variants/:variantId",
    authenticate,
    validateRequest(updateProductVariantSchema),
    validatePermission([PERMISSIONS.PRODUCT_UPDATE.value]),
    productsController.updateVariantById,
);
// Single variant delete (refuses the last variant of a product).
router.delete(
    "/variants/:variantId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_DELETE.value]),
    productsController.deleteVariantById,
);
// Product image list (raw rows; fallback resolved service-side).
router.get(
    "/:productId/images",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_READ.value]),
    productsController.getProductImages,
);
// Attach an existing image URL (multipart file upload arrives later and
// reuses the same service method with a stored path as the URL).
router.post(
    "/:productId/images",
    authenticate,
    validateRequest(attachProductImageSchema),
    validatePermission([PERMISSIONS.PRODUCT_CREATE.value]),
    productsController.attachProductImage,
);
// Delete image row (+ best-effort file cleanup in the service).
router.delete(
    "/:productId/images/:imageId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_DELETE.value]),
    productsController.deleteProductImageById,
);

export default router;
