import { ApiResponse } from "./apiResponse";
import type { Request, Response } from "express";

type TimeUnit = "ms" | "s" | "m" | "h" | "d" | "w";

/**
 * Parses a time string (e.g., "2h", "30m") into any target time unit.
 * @param timeStr - The input string containing a number and a unit token.
 * @param targetUnit - The unit you want the output in (defaults to "s").
 */
export function parseTime(timeStr: string, targetUnit: TimeUnit = "s"): number | null {
    // 1. Define all units relative to an atomic baseline (1 millisecond)
    const msMultipliers: Record<TimeUnit, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
    };

    // 2. Parse the input string using our regex
    const match = timeStr.match(/^(\d+)([a-zA-Z]+)$/);
    if (!match || !match[1] || !match[2]) return null;

    const value = parseInt(match[1], 10);
    const sourceUnit = match[2].toLowerCase() as TimeUnit;

    // Guard clause to make sure both units actually exist in our dictionary
    if (msMultipliers[sourceUnit] === undefined || msMultipliers[targetUnit] === undefined) {
        return null;
    }

    // Step 1: Convert the source value completely into milliseconds
    const totalMs = value * msMultipliers[sourceUnit];

    // Step 2: Convert milliseconds into the requested target unit
    return totalMs / msMultipliers[targetUnit];
}

export function getSessionIdAndSessionData(req: Request, res: Response) {
    if (!req.sessionData || !req.sessionId) {
        ApiResponse.error(res, 401, null, null, {
            type: "error",
            message: "Problem occurred authenticating your session. Please log in again.",
        });
        return null;
    }
    return { sessionId: req.sessionId, sessionData: req.sessionData };
}
