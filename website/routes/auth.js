import express from "express";
import passport from "passport";
import { SESSION_COOKIE_NAME, signOut } from "../lib/auth.js";

function saveSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.save !== "function") return resolve();
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.destroy !== "function") {
      resolve();
      return;
    }

    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function createAuthRouter() {
  const router = express.Router();

  router.get("/discord", (req, res, next) => {
    if (typeof req.isAuthenticated === "function" && req.isAuthenticated()) {
      return res.redirect("/");
    }

    return passport.authenticate("discord", { scope: ["identify", "guilds"] })(req, res, next);
  });

  router.get(
    "/discord/callback",
    passport.authenticate("discord", {
      failureRedirect: "/?auth=failed"
    }),
    async (req, res, next) => {
      try {
        await saveSession(req);
        return res.redirect("/");
      } catch (error) {
        return next(error);
      }
    }
  );

  router.get("/logout", async (req, res, next) => {
    try {
      await signOut(req);
      await destroySession(req);
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      return res.redirect("/");
    } catch (error) {
      next(error);
    }
  });

  return router;
}
