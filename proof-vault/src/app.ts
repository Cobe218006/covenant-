import express, { NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db/pool";
import { env } from "./config/env";
import { authRoutes } from "./auth/authRoutes";
import { tenantRoutes } from "./tenants/tenantRoutes";

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.use(
    session({
      store: new PgSession({ pool, tableName: "session" }),
      name: "connect.sid",
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: "lax",
        maxAge: env.sessionCookieMaxAgeMs,
      },
    })
  );

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/tenant", tenantRoutes);

  // 404
  app.use((_req, res) => res.status(404).json({ error: "not_found" }));

  // Centralized error handler. Never leaks stack traces in production;
  // never silently swallows an error either.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const status = err?.httpStatus ?? 500;
    res.status(status).json({
      error: status === 500 ? "internal_error" : err?.error ?? "error",
      ...(env.nodeEnv !== "production" && status === 500 ? { message: err?.message } : {}),
    });
  });

  return app;
}
