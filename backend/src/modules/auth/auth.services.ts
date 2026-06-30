import { AuthRepository } from "./auth.repository";
import { FormError } from "../../utils/AppError";
import { HashHandler } from "../../utils/hashHandler";
import { v7 as uuidv7 } from "uuid";
import crypto from "node:crypto";
import type { SessionData } from "../../utils/redisHandler";

export class AuthServices {
    private repository: AuthRepository;
    private hashHandler: HashHandler;
    constructor(repository: AuthRepository, hashHandler: HashHandler) {
        this.repository = repository;
        this.hashHandler = hashHandler;
    }
    signup = async (name: string, email: string, password: string, ip: string | undefined) => {
        console.log("Services ran");
        // User area
        const userExists: boolean = await this.repository.doesUserExist(email);
        if (userExists) {
            throw new FormError("Account with this email already exists", 409, {
                formErrors: [],
                fieldErrors: { email: ["Account with this email already exists"] },
            });
        }
        const hashedPassword = await this.hashHandler.hashPassword(password);
        // Token area
        // Generate user id client side so you can generate tokens before creating user in repository
        const userId = uuidv7();
        const sessionId = crypto.randomBytes(32).toString("hex");
        const familyId = uuidv7();

        const user = await this.repository.createUser(userId, name, email, hashedPassword);
        if (!user) {
            return null;
        }
        // Create Redis part (expires in 30d = 2592000s)
        const sessionData: SessionData = {
            userId,
            familyId,
            ipAddress: ip || "null",
            revoked: "false",
            cat: new Date().toISOString(),
        };
        const result = await this.repository.createSession(sessionId, sessionData);
        if (!result) {
            console.log(`Created user but failed to save session to Redis, userId=${userId}`);
            // Return to user that he signed up but needs to log in.
            return { user };
        }

        return { user, sessionId };
    };
}
