import { env } from "../../config/env";
import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthServices } from "./auth.services";
import { AuthRepository } from "./auth.repository";
import { HashHandler } from "../../utils/hashHandler";
import { validateRequest } from "../../middleware/validateRequest";
import { signinSchema, signupSchema } from "./auth.schemas";
import { SessionHandler } from "../../utils/redisHandler";
import { authenticate } from "../../middleware/authentication";

const router = Router();

const hashHandler = new HashHandler();
const authRepository = new AuthRepository();
const authServices = new AuthServices(authRepository, hashHandler);
const authController = new AuthController(authServices);
router.post("/signup", validateRequest(signupSchema), authController.signup);
router.post("/signin", validateRequest(signinSchema), authController.signin);
router.post("/signout", authController.signout);

// /me was made quickly without thought just for testing purposes
router.get("/me", authenticate, authController.me);

export default router;
