import { Router } from "express";
import { ShopsController } from "./shops.controller";
import { AuthRepository } from "../auth/auth.repository";
import { ShopsServices } from "./shops.services";
import { ShopsRepository } from "./shops.repository";
import { validateRequest } from "../../middleware/validateRequest";
import { createShopSchema, patchShopSchema } from "./shops.schemas";
import { authenticate } from "../../middleware/authentication";

const router = Router();

const userRepository = new AuthRepository();
const shopRepository = new ShopsRepository();
const shopServices = new ShopsServices(shopRepository, userRepository);
const shopController = new ShopsController(shopServices);
// Create shop 'shops/'
router.post("/", authenticate, validateRequest(createShopSchema), shopController.createShop);
router.get("/my-shops", authenticate, shopController.getMyShops); // Returns soft deleted shops too, frontend can filter as wanted
router.get("/:shopId", authenticate, shopController.getShop);
router.delete("/:shopId", authenticate, shopController.deleteShop);
router.patch("/:shopId", authenticate, validateRequest(patchShopSchema), shopController.patchShop);

export default router;
