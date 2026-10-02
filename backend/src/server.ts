import { env } from "./config/env";
import express from "express";
import { connectRedis, initSearchIndexes } from "./config/redis";
import authRouter from "./modules/auth/auth.routes";
import shopsRouter from "./modules/shops/shops.routes";
import invitesMineRouter from "./modules/invites/invites.mine.routes";
import { ErrorHandler } from "./middleware/errorHandler";
import { LocalDiskStorage, storage, UPLOADS_ROOT } from "./utils/storage";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    }),
);
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

// Product images are public-by-design (storefronts need them without a
// session), so they serve without authenticate. Confidentiality was never
// a property of these URLs — don't add auth here later thinking it adds any.
if (storage instanceof LocalDiskStorage) {
    await storage.ensureRoot();
}
app.use("/uploads", express.static(UPLOADS_ROOT));

app.use("/auth/", authRouter);
app.use("/shops/", shopsRouter);
app.use("/invites", invitesMineRouter);
const errorHandler = new ErrorHandler();
app.use(errorHandler.handleErrors);

app.listen(env.PORT, () => console.log(`Server is running on port ${env.PORT}`));
