import { Router } from "express";
import { RolesRepository } from "./roles.repository";
import { RolesServices } from "./roles.services";
import { RolesController } from "./roles.controller";
import { authenticate } from "../../middleware/authentication";

const router = Router();

const rolesRepository = new RolesRepository();
const rolesServices = new RolesServices(rolesRepository);
const rolesController = new RolesController(rolesServices);

router.get("/permissions", authenticate, rolesController.getPermissions);

export default router;
