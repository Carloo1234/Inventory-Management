import { env } from "../../config/env";
import { ApiResponse } from "../../utils/apiResponse";
import { AuthServices } from "./auth.services";
import { parseTime } from "../../utils/generalUtils";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/AppError";

export class AuthController {
    private services: AuthServices;
    constructor(services: AuthServices) {
        this.services = services;
    }
    signup = async (req: Request, res: Response) => {
        console.log("Controller ran");
        const { name, email, password } = req.body;
        const result = await this.services.signup(name, email, password, req.ip);
        // If user and sessionId both successfuly created
        if (result?.sessionId && result.user) {
            const { user, sessionId } = result;

            // Send sessionCookie
            res.cookie("session_id", sessionId, {
                httpOnly: true,
                secure: env.NODE_ENV === "production",
                sameSite: env.COOKIE_SAMESITE,
                maxAge: parseTime(env.SESSION_EXPIRY, "ms")!,
            });

            ApiResponse.success(
                res,
                201,
                null,
                { type: "success", message: "Created account!" },
                { name: "ROOT", params: null },
            );
        }
        // Only user, no sessionId created
        else if (result?.user) {
            ApiResponse.success(
                res,
                201,
                null,
                { type: "success", message: "Created account! Please login." },
                { name: "LOGIN", params: null },
            );
        }
        // No sessionid and no user created
        else {
            // Handled by main error handler
            throw new AppError("Database error creating user", 500);
        }
    };
}
