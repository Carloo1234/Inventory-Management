import { Router } from "express";
import { RolesRepository } from "./roles.repository";
import { RolesServices } from "./roles.services";
import { RolesController } from "./roles.controller";
import { authenticate } from "../../middleware/authentication";
import { validatePermission } from "../../middleware/validatePermission";
import { validateRequest } from "../../middleware/validateRequest";
import { createRoleSchema, updateRoleSchema } from "./roles.schema";

// "/shops/:shopId/roles" is the base path for this router, so all routes here are relative to that
// mergeParams lets this child router see :shopId from the parent shops router
const router = Router({ mergeParams: true });

const rolesRepository = new RolesRepository();
const rolesServices = new RolesServices(rolesRepository);
const rolesController = new RolesController(rolesServices);

router.get("/permissions", authenticate, rolesController.getPermissions);
// Create role
router.post(
    "/",
    authenticate,
    validateRequest(createRoleSchema),
    validatePermission(["roles:create"]),
    rolesController.createRole,
);
// Get all roles
router.get("/", authenticate, validatePermission(["roles:read"]), rolesController.getRoles);
// Update role
router.patch(
    "/:roleId",
    authenticate,
    validateRequest(updateRoleSchema),
    validatePermission(["roles:update"]),
    rolesController.updateRole,
);
// Delete role
router.delete("/:roleId", authenticate, validatePermission(["roles:delete"]), rolesController.deleteRole);

export default router;
