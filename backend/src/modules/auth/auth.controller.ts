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
        if (req.cookies.session_id) {
            return ApiResponse.error(res, 400, null, null, {
                type: "error",
                message: "You are already logged in, please log out first.",
            });
        }

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

    signin = async (req: Request, res: Response) => {
        const { email, password } = req.body;

        if (req.cookies.session_id) {
            return ApiResponse.error(res, 400, null, null, {
                type: "error",
                message: "You are already logged in, please log out first.",
            });
        }

        const sessionId = await this.services.signin(email, password, req.ip);
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
            { type: "success", message: "Successfully signed in." },
            { name: "ROOT", params: null },
        );
    };

    signout = async (req: Request, res: Response) => {
        const sessionId: string | null = req.cookies.session_id;

        if (!sessionId) return ApiResponse.success(res, 200, null, null, { name: "ROOT", params: null });

        await this.services.signout(sessionId);
        res.clearCookie("session_id");
        ApiResponse.success(
            res,
            200,
            null,
            { type: "success", message: "Successfully logged out" },
            { name: "ROOT", params: null },
        );
    };

    me = async (req: Request, res: Response) => {
        if (!req.sessionData) {
            return ApiResponse.error(res, 401, null, null, { type: "error", message: "Invalid session" });
        }
        const user = await this.services.me(req.sessionData);
        const { passwordHash, ...cleanUser } = user;
        ApiResponse.success(res, 200, { user: cleanUser });
    };
}
