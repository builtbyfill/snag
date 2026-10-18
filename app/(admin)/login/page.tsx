import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp, loginLimiter } from "@/lib/auth/rate-limit";
import { isSignedIn } from "@/lib/auth/session";
import { adminCopy } from "@/lib/copy/admin";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `${adminCopy.login.pageTitle} · Snag` };

export default async function LoginPage() {
  if (await isSignedIn()) redirect("/dashboard");
  // A reload doesn't unlock the button: the page asks the same limiter the action uses.
  const locked = loginLimiter.isLocked(clientIp(await headers()));
  return <LoginForm locked={locked} />;
}
