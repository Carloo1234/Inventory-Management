import { AuthRepository } from "./auth.repository";
import { AppError, FormError } from "../../utils/AppError";
import { HashHandler } from "../../utils/hashHandler";
import { v7 as uuidv7 } from "uuid";
import crypto from "node:crypto";
import type { SessionData } from "../../utils/redisHandler";
import { ApiResponse } from "../../utils/apiResponse";

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

    signin = async (email: string, password: string, ip: string | undefined) => {
        const user = await this.repository.getUserWithEmail(email);
        if (!user) {
            throw new FormError("The password or email you have entered is incorrect", 401, {
                formErrors: ["Incorrect email or password"],
                fieldErrors: {},
            });
        }

        const correctPassword = await this.hashHandler.verifyPassword(password, user.passwordHash);

        if (!correctPassword) {
            throw new FormError("The password or email you have entered is incorrect", 401, {
                formErrors: ["Incorrect email or password"],
                fieldErrors: {},
            });
        }
        // Password is correct -- Check if device count hasnt exceeded 10
        const deviceCount = await this.repository.getDeviceCount(user.id);

        if (deviceCount >= 10) {
            throw new AppError("You cannot login on more than 10 devices. Please logout of other devices", 401);
        }

        // Devices logged in are less than 10 -- Generate token
        const sessionId = crypto.randomBytes(32).toString("hex");
        const familyId = uuidv7();

        const sessionData: SessionData = {
            userId: user.id,
            familyId: familyId,
            ipAddress: ip || "null",
            revoked: "false",
            cat: new Date().toISOString(),
        };

        const sessionResult = await this.repository.createSession(sessionId, sessionData);
        if (!sessionResult) {
            throw new AppError("We have encoured an error with creating your session. Please try again.", 500);
        }
        // Session created
        return sessionId;
    };

    signout = async (sessionId: string) => {
        await this.repository.deleteDeviceSessions(sessionId);
    };

    me = async (sessionData: SessionData) => {
        const user = await this.repository.getUserWithUserId(sessionData.userId);
        if (!user) {
            throw new AppError("User not found", 404);
        }
        return user;
    };
}
