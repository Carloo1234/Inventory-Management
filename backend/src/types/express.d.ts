import * as express from "express";
import { SessionData } from "../utils/redisHandler";

declare global {
    namespace Express {
        interface Request {
            sessionData?: SessionData;
        }
    }
}
