import { env } from "./config/env";
import express from "express";
import { connectRedis, initSearchIndexes } from "./config/redis";
import authRouter from "./modules/auth/auth.routes";
import { ErrorHandler } from "./middleware/errorHandler";
import cookieParser from "cookie-parser";

const app = express();
await connectRedis();

try {
    await initSearchIndexes();
    console.log("Index created");
} catch (e) {
    if (e instanceof Error && e.message === "Index already exists") {
        console.log("Index already exists, moving on...");
    } else {
        console.log("Index errors");
        console.error(e);
        process.exit(1);
    }
}
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", env.TRUST_PROXY);

app.use("/auth/", authRouter);

const errorHandler = new ErrorHandler();
app.use(errorHandler.handleErrors);

app.listen(env.PORT, () => console.log(`Server is running on port ${env.PORT}`));
