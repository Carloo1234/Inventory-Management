import express from "express";
import authRouter from "./modules/auth/auth.routes";
import { ErrorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json());
const port = 3000;

app.use("/auth/", authRouter);

const errorHandler = new ErrorHandler();
app.use(errorHandler.handleErrors);

app.listen(port, () => console.log(`Server is running on port ${port}`));
