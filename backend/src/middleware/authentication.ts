import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../utils/apiResponse";
import { SessionHandler, type SessionData } from "../utils/redisHandler";
import { parseTime } from "../utils/generalUtils";
import { env } from "../config/env";
import crypto from "node:crypto";

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip;
    const sessionId: string | null = req.cookies.session_id;

    if (!sessionId) {
        return ApiResponse.error(
            res,
            401,
            null,
            null,
            { type: "info", message: "Please login or register first." },
            { name: "LOGIN", params: null },
        );
    }

    // If sessionId available. Look it up in redis
    try {
        const sessionData = await SessionHandler.getSessionData(sessionId);
        if (!sessionData) {
            // Not found in redis. (User put a invalid token (Unlikely) or token expired (Likely))
            // Clear cookie
            res.clearCookie("session_id");
            return ApiResponse.error(
                res,
                401,
                null,
                null,
                { type: "info", message: "Session has expired. Please log in." },
                { name: "LOGIN", params: null },
            );
        }

        /* If session was revoked (Suspisious activity detected)
        so delete ALL sessionTokens of the same family_id
        However, accept a grace period (10 seconds)
        to prevent false logging user out when sending rapid requests
        in rotation period which can lead to race conditions
        */
        if (sessionData.revoked === "true") {
            const isRecentlyRevoked = await SessionHandler.isInRecentlyRevoked(sessionId);
            // If revoked recently(10s). allow request as its in grace period
            if (isRecentlyRevoked) {
                req.sessionData = sessionData;
                return next();
            }
            // If not recently revoked, detect suspisous activity and log out device

            await SessionHandler.deleteAllDeviceSessionKeys(sessionData);
            res.clearCookie("session_id");
            return ApiResponse.error(
                res,
                401,
                null,
                null,
                { type: "error", message: "Unusual activity detected by our systems. Please log in again." },
                { name: "LOGIN", params: null },
            );
        }

        // If session found and not revoked, check session rotation date
        if (new Date().getTime() - new Date(sessionData.cat).getTime() >= parseTime(env.SESSION_ROTATION, "ms")!) {
            // Rotate the token
            const newSessionData: SessionData = {
                ...sessionData,
                // Then override data
                ipAddress: ip || "null",
                revoked: "false",
                cat: new Date().toISOString(),
            };
            const newSessionId: string = crypto.randomBytes(32).toString("hex");
            const result = await SessionHandler.rotateSessionToken(
                sessionId,
                sessionData,
                newSessionId,
                newSessionData,
            );

            // If result is null, consider this request in grace period
            // The previous conccurrent successful request already revoked token and passed new cookie
            if (!result) {
                req.sessionData = sessionData;
                return next();
            }
            // If request succeeded (If 2 concurrent requests, this was first), continue normally.

            // Set session data for next functions
            req.sessionData = newSessionData;

            // Override the cookie
            res.cookie("session_id", newSessionId, {
                httpOnly: true,
                secure: env.NODE_ENV === "production",
                sameSite: env.COOKIE_SAMESITE,
                maxAge: parseTime(env.SESSION_EXPIRY, "ms")!,
            });
            return next();
        }
        // If session found, not revoked, and not yet to be rotated.
        req.sessionData = sessionData;
        return next();
    } catch (error) {
        console.log(error);
        // redis connection error
        return ApiResponse.error(res, 500, null, null, {
            type: "error",
            message: "There has been an error on our end authenticaing you.",
        });
    }
};
