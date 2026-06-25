import { Router } from "express";
import { AuthController } from "./auth.controller";
import { AuthServices } from "./auth.services";
import { AuthRepository } from "./auth.repository";
import { HashHandler } from "../../utils/hashHandler";

const router = Router();

const hashHandler = new HashHandler();
const authRepository = new AuthRepository();
const authServices = new AuthServices(authRepository, hashHandler);
const authController = new AuthController(authServices);
router.post("/signup", authController.signup);

export default router;
