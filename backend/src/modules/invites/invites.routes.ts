import { Router } from "express";
import { InvitesRepository } from "./invites.repository";
import { InvitesServices } from "./invites.services";
import { InvitesController } from "./invites.controller";
import { authenticate } from "../../middleware/authentication";
import { validatePermission } from "../../middleware/validatePermission";
import { validateRequest } from "../../middleware/validateRequest";
import { PERMISSIONS } from "../../utils/permissions";
import { createInviteSchema } from "./invites.schema";
import { AuthRepository } from "../auth/auth.repository";
import { RolesRepository } from "../roles/roles.repository";
import { RolesServices } from "../roles/roles.services";
import { ShopsRepository } from "../shops/shops.repository";
import { ManagersRepository } from "../managers/managers.repository";

// "/shops/:shopId/invites" is the base path for this router, so all routes here are relative to that
const router = Router({ mergeParams: true });

const invitesRepository = new InvitesRepository();
const userRepository = new AuthRepository();
const rolesRepository = new RolesRepository();
const managerRepository = new ManagersRepository();
const shopRepository = new ShopsRepository();
const rolesServices = new RolesServices(rolesRepository, managerRepository, shopRepository);
const invitesServices = new InvitesServices(
    invitesRepository,
    userRepository,
    rolesServices,
    shopRepository,
    managerRepository,
);
const invitesController = new InvitesController(invitesServices);

// Create invite
router.post(
    "/",
    authenticate,
    validateRequest(createInviteSchema),
    validatePermission([PERMISSIONS.INVITE_CREATE.value]),
    invitesController.createInvite,
);
// Get all invites
router.get("/", authenticate, validatePermission([PERMISSIONS.INVITE_READ.value]), invitesController.getInvites);

// Get invite by ID
router.get(
    "/:inviteId",
    authenticate,
    validatePermission([PERMISSIONS.INVITE_READ.value]),
    invitesController.getInviteById,
);

// Revoke / delete invite
router.delete(
    "/:inviteId",
    authenticate,
    validatePermission([PERMISSIONS.INVITE_DELETE.value]),
    invitesController.deleteInvite,
);

// Accept invite by ID
router.post("/:inviteId/accept", authenticate, invitesController.acceptInvite);

export default router;
