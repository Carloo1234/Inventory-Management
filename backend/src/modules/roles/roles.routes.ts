import { Router } from "express";
import { RolesRepository } from "./roles.repository";
import { RolesServices } from "./roles.services";
import { RolesController } from "./roles.controller";
import { ManagersRepository } from "../managers/managers.repository";
import { ShopsRepository } from "../shops/shops.repository";
import { authenticate } from "../../middleware/authentication";
import { validatePermission } from "../../middleware/validatePermission";
import { validateRequest } from "../../middleware/validateRequest";
import { createRoleSchema, updateRoleSchema } from "./roles.schema";

// "/shops/:shopId/roles" is the base path for this router, so all routes here are relative to that
// mergeParams lets this child router see :shopId from the parent shops router
const router = Router({ mergeParams: true });

const rolesRepository = new RolesRepository();
const managersRepository = new ManagersRepository();
const shopsRepository = new ShopsRepository();
const rolesServices = new RolesServices(rolesRepository, managersRepository, shopsRepository);
const rolesController = new RolesController(rolesServices);

router.get("/permissions", authenticate, rolesController.getPermissions);
router.get("/permission-presets", authenticate, rolesController.getPermissionPresets);
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

// Get role by ID
router.get("/:roleId", authenticate, validatePermission(["roles:read"]), rolesController.getRoleById);

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
