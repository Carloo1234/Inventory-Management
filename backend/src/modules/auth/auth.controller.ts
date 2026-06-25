import { AuthServices } from "./auth.services";
import type { Request, Response, NextFunction } from "express";

export class AuthController {
    private services: AuthServices;
    constructor(services: AuthServices) {
        this.services = services;
    }
    signup = async (req: Request, res: Response) => {
        const { name, email, password } = req.body;
        // Add ZOD validation here later or probably in services not here in contorller.
        const user = await this.services.signup(name, email, password);
        res.send({ message: "Successfuly signed up" }); // Integrate JWT here later
    };
}
