import { Router } from "express";
import { ManagersRepository } from "./managers.repository";
import { ManagersServices } from "./managers.services";
import { ManagersController } from "./managers.controller";
import { authenticate } from "../../middleware/authentication";
import { validatePermission } from "../../middleware/validatePermission";
import { validateRequest } from "../../middleware/validateRequest";
import { PERMISSIONS } from "../../utils/permissions";
import { updateManagerSchema } from "./managers.schema";
import { RolesRepository } from "../roles/roles.repository";
import { RolesServices } from "../roles/roles.services";
import { ShopsRepository } from "../shops/shops.repository";

// "/shops/:shopId/managers" is the base path for this router, so all routes here are relative to that
const router = Router({ mergeParams: true });

const managersRepository = new ManagersRepository();
const rolesRepository = new RolesRepository();
const shopRepository = new ShopsRepository();
const rolesServices = new RolesServices(rolesRepository, managersRepository, shopRepository);
const managersServices = new ManagersServices(managersRepository, rolesServices, shopRepository);
const managersController = new ManagersController(managersServices);

// Get all managers
router.get("/", authenticate, validatePermission([PERMISSIONS.MANAGER_READ.value]), managersController.getManagers);
// Get manager by ID
router.get(
    "/:managerId",
    authenticate,
    validatePermission([PERMISSIONS.MANAGER_READ.value]),
    managersController.getManagerById,
);
// Update manager's role
router.patch(
    "/:managerId",
    authenticate,
    validateRequest(updateManagerSchema),
    validatePermission([PERMISSIONS.MANAGER_UPDATE.value]),
    managersController.updateManager,
);
// Remove manager, or self-leave when caller === target (branched in controller).
// Deliberately NO route-level validatePermission: it can't express "self OR permitted".
router.delete("/:managerId", authenticate, managersController.removeManager);

export default router;
