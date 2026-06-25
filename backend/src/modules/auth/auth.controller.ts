import { AuthServices } from "./auth.services";
import type { Request, Response, NextFunction } from "express";

export class AuthController {
    private services: AuthServices;
    constructor(services: AuthServices) {
        this.services = services;
    }
    signup = async (req: Request, res: Response) => {
        const { name, email, password } = req.body;
        const user = await this.services.signup(name, email, password);
        res.status(201).json({ message: "Successfuly signed up" }); // Integrate JWT here later
    };
}
