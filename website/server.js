import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureWebAuth } from "./lib/auth.js";
import { createAuthRouter } from "./routes/auth.js";
import { createIndexRouter } from "./routes/index.js";
import { createApiRouter } from "./routes/api.js";
import { applySecurityHeaders, csrfProtection, ensureCsrfToken, requestRateLimit } from "./lib/security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startWebsite(context) {
  const app = express();
  app.disable("x-powered-by");
  app.use(applySecurityHeaders);

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  if (context.config.sessionCookieSecure) {
    app.set("trust proxy", 1);
  }
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(path.join(__dirname, "public")));
  app.get("/HS.gif", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "HS.gif"));
  });

  configureWebAuth(app, context);
  app.use(ensureCsrfToken);
  app.use(requestRateLimit);

  app.use((req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.isAuthenticated = typeof req.isAuthenticated === "function" ? req.isAuthenticated() : false;
    next();
  });

  app.locals.botName = context.config.botName;

  app.use("/auth", createAuthRouter(context));
  app.use("/", createIndexRouter(context));
  app.use("/guild", csrfProtection, createApiRouter(context));

  app.use((error, req, res, _next) => {
    console.error("[web] error:", error);
    if (res.headersSent) {
      return;
    }

    const isDevelopment = process.env.NODE_ENV === "development";
    res.status(error.statusCode || 500).render("error", {
      title: "서버 오류",
      message: isDevelopment ? (error.message || "알 수 없는 오류가 발생했습니다.") : "요청을 처리하는 중 오류가 발생했습니다."
    });
  });

  const server = app.listen(context.config.webPort, context.config.webHost, () => {
    console.log(`[web] listening on http://${context.config.webHost}:${context.config.webPort}`);
  });

  context.web = { app, server };
  return server;
}
