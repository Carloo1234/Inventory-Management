import { Router } from "express";
import { AttributesRepository } from "./attributes.repository";
import { AttributesServices } from "./attributes.services";
import { AttributesController } from "./attributes.controller";
import { authenticate } from "../../middleware/authentication";
import { validatePermission } from "../../middleware/validatePermission";
import { validateRequest } from "../../middleware/validateRequest";
import { PERMISSIONS } from "../../utils/permissions";
import {
    createAttributeNameSchema,
    createAttributeValueSchema,
    updateAttributeNameSchema,
    updateAttributeValueSchema,
} from "./attributes.schema";

// "/shops/:shopId/attributes" is the base path for this router, so all routes here are relative to that
// Merge params allows this child attributes router, to see shopId param in the routed shops module.
const router = Router({ mergeParams: true });

const attributesRepository = new AttributesRepository();
const attributesServices = new AttributesServices(attributesRepository);
const attributesController = new AttributesController(attributesServices);

// Attribute names
router.post(
    "/",
    authenticate,
    validateRequest(createAttributeNameSchema),
    validatePermission([PERMISSIONS.PRODUCT_CREATE.value]),
    attributesController.createAttributeName,
);
router.get("/", authenticate, validatePermission([PERMISSIONS.PRODUCT_READ.value]), attributesController.getAttributeNames);
router.get(
    "/:attributeNameId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_READ.value]),
    attributesController.getAttributeNameById,
);
router.patch(
    "/:attributeNameId",
    authenticate,
    validateRequest(updateAttributeNameSchema),
    validatePermission([PERMISSIONS.PRODUCT_UPDATE.value]),
    attributesController.updateAttributeNameById,
);
router.delete(
    "/:attributeNameId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_DELETE.value]),
    attributesController.deleteAttributeNameById,
);

// Attribute values (nested under their parent name)
router.post(
    "/:attributeNameId/values",
    authenticate,
    validateRequest(createAttributeValueSchema),
    validatePermission([PERMISSIONS.PRODUCT_CREATE.value]),
    attributesController.createAttributeValue,
);
router.get(
    "/:attributeNameId/values",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_READ.value]),
    attributesController.getAttributeValues,
);
router.get(
    "/:attributeNameId/values/:attributeValueId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_READ.value]),
    attributesController.getAttributeValueById,
);
router.patch(
    "/:attributeNameId/values/:attributeValueId",
    authenticate,
    validateRequest(updateAttributeValueSchema),
    validatePermission([PERMISSIONS.PRODUCT_UPDATE.value]),
    attributesController.updateAttributeValueById,
);
router.delete(
    "/:attributeNameId/values/:attributeValueId",
    authenticate,
    validatePermission([PERMISSIONS.PRODUCT_DELETE.value]),
    attributesController.deleteAttributeValueById,
);

export default router;
