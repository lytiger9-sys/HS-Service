import express from "express";
import passport from "passport";
import { SESSION_COOKIE_NAME, signOut } from "../lib/auth.js";

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

    return passport.authenticate("discord", { scope: ["identify"] })(req, res, next);
  });

  router.get(
    "/discord/callback",
    passport.authenticate("discord", {
      failureRedirect: "/?auth=failed"
    }),
    (_req, res) => {
      res.redirect("/");
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
