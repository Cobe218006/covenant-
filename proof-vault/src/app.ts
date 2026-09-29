// Must be imported before any routes are registered: Express 4 does not
// forward a rejected promise from an async route handler to the error
// middleware on its own -- an unexpected error (e.g. malformed input that
// slips past zod, like a non-UUID path param hitting Postgres) becomes an
// unhandled rejection instead of a clean 4xx/5xx, which on modern Node
// crashes the whole process. This patches Express so every async handler's
// rejection reaches the centralized error handler below like any other.
import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db/pool";
import { env } from "./config/env";
import { authRoutes } from "./auth/authRoutes";
import { tenantRoutes } from "./tenants/tenantRoutes";
import { evidenceRoutes } from "./evidence/evidenceRoutes";

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
  app.use("/api/evidence", evidenceRoutes);

  // 404
  app.use((_req, res) => res.status(404).json({ error: "not_found" }));

  // Centralized error handler. Never leaks stack traces in production;
  // never silently swallows an error either.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    // Postgres invalid_text_representation -- most commonly a malformed
    // UUID in a :id path param reaching a query directly (no route
    // currently validates path params with zod the way request bodies
    // are). A client input error, not a server one, so it isn't a 500.
    if (err?.code === "22P02") {
      return res.status(400).json({ error: "invalid_input" });
    }
    const status = err?.httpStatus ?? 500;
    res.status(status).json({
      error: status === 500 ? "internal_error" : err?.error ?? "error",
      ...(env.nodeEnv !== "production" && status === 500 ? { message: err?.message } : {}),
    });
  });

  return app;
}
