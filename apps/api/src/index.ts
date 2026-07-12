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
import { teachCoursesRouter } from "./modules/courses/teachRouter";
import { topicsRouter, materialsRouter } from "./modules/topics/router";
import { generateRouter, contentRouter, presentationsRouter, videosRouter } from "./modules/content/router";

const app = express();

app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
// Specific routers first; the org router is mounted on the generic /api/v1
// prefix (and carries an ADMIN guard), so it must come LAST or it would
// intercept /api/v1/teach/* and 403 teachers before they reach their router.
app.use("/api/v1/teach", teachCoursesRouter);
app.use("/api/v1/topics", topicsRouter);
app.use("/api/v1/topics", generateRouter);
app.use("/api/v1/materials", materialsRouter);
app.use("/api/v1/content", contentRouter);
app.use("/api/v1/presentations", presentationsRouter);
app.use("/api/v1/videos", videosRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/courses", coursesRouter);
app.use("/api/v1", orgRouter);

app.use(errorMiddleware);

app.listen(env.port, () => {
  console.log(`API ready on http://localhost:${env.port}`);
});
