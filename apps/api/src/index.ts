import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env";
import { authMiddleware } from "./middleware/auth";
import { errorMiddleware } from "./middleware/error";
import { authRouter } from "./modules/auth/router";
import { orgRouter } from "./modules/org/router";
import { usersRouter } from "./modules/users/router";
import { coursesRouter } from "./modules/courses/router";

const app = express();

app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/api/v1", orgRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/courses", coursesRouter);

app.use(errorMiddleware);

app.listen(env.port, () => {
  console.log(`API ready on http://localhost:${env.port}`);
});
