import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import passportDiscord from "passport-discord";

const { Strategy: DiscordStrategy } = passportDiscord;

export const SESSION_COOKIE_NAME = "hs.sid";

function buildAvatarUrl(profile) {
  if (profile.avatar) {
    const extension = String(profile.avatar).startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${extension}?size=128`;
  }

  const discriminator = Number(profile.discriminator ?? 0);
  const index = Number.isFinite(discriminator) ? discriminator % 5 : 0;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function buildDisplayName(profile) {
  return profile.global_name || profile.globalName || profile.displayName || profile.username || "Discord User";
}

function buildTag(profile) {
  const username = profile.username || "discord-user";
  const discriminator = String(profile.discriminator ?? "");

  if (discriminator && discriminator !== "0") {
    return `${username}#${discriminator}`;
  }

  return username;
}

function mapDiscordProfile(profile, accessToken = "", refreshToken = "") {
  return {
    id: profile.id,
    username: profile.username || "discord-user",
    discriminator: String(profile.discriminator ?? "0"),
    tag: buildTag(profile),
    displayName: buildDisplayName(profile),
    avatar: profile.avatar || null,
    avatarUrl: buildAvatarUrl(profile),
    accessToken,
    refreshToken
  };
}

export function configureWebAuth(app, context) {
  const store = MongoStore.create({
    mongoUrl: context.config.mongoUri,
    dbName: context.config.mongoDbName,
    collectionName: "web_sessions"
  });

  if (context.config.sessionCookieSecure) {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: context.config.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: context.config.sessionCookieSecure,
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 30
      }
    })
  );

  passport.use(
    new DiscordStrategy(
      {
        clientID: context.config.discordClientId,
        clientSecret: context.config.discordClientSecret,
        callbackURL: context.config.discordCallbackUrl,
        scope: ["identify", "guilds"],
        state: true
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          done(null, mapDiscordProfile(profile, accessToken, refreshToken));
        } catch (error) {
          done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  app.use(passport.initialize());
  app.use(passport.session());

  return {
    passport,
    sessionStore: store
  };
}

export async function signOut(req) {
  await new Promise((resolve, reject) => {
    if (typeof req.logout !== "function") {
      resolve();
      return;
    }

    req.logout((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
