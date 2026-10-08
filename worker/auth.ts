import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export type Provider = "github" | "google";

export function configuredProviders(env: Env): Provider[] {
  const out: Provider[] = [];
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) out.push("github");
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.push("google");
  return out;
}

/** Built per request: bindings and secrets only exist on the request's env. */
export function createAuth(env: Env) {
  const providers = configuredProviders(env);
  return betterAuth({
    appName: "Invoice Builder",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: "sqlite", schema }),
    socialProviders: {
      ...(providers.includes("github") && {
        github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
      }),
      ...(providers.includes("google") && {
        google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" },
      }),
    },
    account: {
      // Same email via GitHub and Google → one account.
      accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh expiry at most daily
      cookieCache: { enabled: true, maxAge: 5 * 60 }, // skip the D1 lookup for 5 min
    },
    advanced: {
      cookiePrefix: "tinytools",
      ...(env.COOKIE_DOMAIN && { crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN } }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth["$Infer"]["Session"]["user"];
