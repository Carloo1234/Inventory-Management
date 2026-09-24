import { Router } from "express";
import { InvitesRepository } from "./invites.repository";
import { InvitesServices } from "./invites.services";
import { InvitesController } from "./invites.controller";
import { authenticate } from "../../middleware/authentication";
import { AuthRepository } from "../auth/auth.repository";
import { RolesRepository } from "../roles/roles.repository";
import { RolesServices } from "../roles/roles.services";
import { ShopsRepository } from "../shops/shops.repository";
import { ManagersRepository } from "../managers/managers.repository";

// Mounted at "/invites" in server.ts (NOT nested under /shops/:shopId).
// Personal inbox: the caller's own pending invites across all shops, so
// authenticate-only — no shop scope, no permission check.
const router = Router();

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

router.get("/mine", authenticate, invitesController.getMyInvites);

export default router;
