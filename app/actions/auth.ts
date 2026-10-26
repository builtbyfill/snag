"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { attemptLogin, type LoginError } from "@/lib/auth/login";
import { clientIp, createDbLoginLimiter } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { readAuthEnv } from "@/lib/env";

/** `attempt` counts answers, so the form can return focus to the field after each one. */
export type LoginState = { error: LoginError | null; attempt: number };

/**
 * Checks the access code (constant time, per-IP limit) and sets the signed session cookie.
 * CSRF: SameSite=Strict plus the Origin check Next runs on every server action.
 */
export async function loginAction(previous: LoginState, formData: FormData): Promise<LoginState> {
  const env = readAuthEnv();
  const ip = clientIp(await headers());
  const limiter = createDbLoginLimiter(getDb(), env.IP_HASH_SECRET);
  const result = await attemptLogin(formData.get("code"), { env, ip, limiter });
  if (!result.ok) return { error: result.error, attempt: previous.attempt + 1 };

  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions(env.APP_URL));
  redirect("/dashboard"); // outside any try: redirect() works by throwing
}

export async function signOutAction(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...sessionCookieOptions(readAuthEnv().APP_URL), maxAge: 0 });
  redirect("/login");
}
