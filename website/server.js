import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureWebAuth } from "./lib/auth.js";
import { createAuthRouter } from "./routes/auth.js";
import { createIndexRouter } from "./routes/index.js";
import { createApiRouter } from "./routes/api.js";
import { createLicenseRouter } from "./routes/license.js";
import { applySecurityHeaders, requestRateLimit } from "./lib/security.js";

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
  app.locals.assetVersion = process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || Date.now().toString(36);
  app.use(express.static(path.join(__dirname, "public"), {
    setHeaders: (res, filePath) => {
      if (/\.(?:css|js)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    }
  }));
  app.get("/HS.gif", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "HS.gif"));
  });
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "hs-service" });
  });

  configureWebAuth(app, context);
  app.use(requestRateLimit);

  app.use((req, res, next) => {
    if (req.accepts("html")) res.setHeader("Cache-Control", "no-store");
    res.locals.currentUser = req.user || null;
    res.locals.isAuthenticated = typeof req.isAuthenticated === "function" ? req.isAuthenticated() : false;
    next();
  });

  app.locals.botName = context.config.botName;

  app.use("/auth", createAuthRouter(context));
  app.use("/", createIndexRouter(context));
  app.use("/guild", createApiRouter(context));
  app.use("/license", createLicenseRouter(context));

  app.use((error, req, res, _next) => {
    console.error("[web] error:", error);
    if (res.headersSent) {
      return;
    }

    const status = Number(error.statusCode || error.status || 500);
    const isFetchRequest = req.get("X-Requested-With") === "fetch" || req.accepts(["json", "html"]) === "json";
    const isDevelopment = process.env.NODE_ENV === "development";
    const message = isDevelopment
      ? (error.message || "알 수 없는 오류가 발생했습니다.")
      : (status >= 500 ? "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요." : (error.message || "요청을 처리하지 못했습니다."));

    if (isFetchRequest) {
      return res.status(status).json({ ok: false, message });
    }

    return res.status(status).render("error", {
      title: "서버 오류",
      message
    });
  });

  const server = app.listen(context.config.webPort, context.config.webHost, () => {
    console.log(`[web] listening on http://${context.config.webHost}:${context.config.webPort}`);
  });

  context.web = { app, server };
  return server;
}
