import { LogOutIcon } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { SnagMark } from "@/components/snag-mark";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { adminCopy } from "@/lib/copy/admin";

/** The dashboard shell: the wordmark and Sign out. The chats arrive in slice 7. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="flex h-dvh flex-col">
      <header data-surface="dark" className="shrink-0 border-b border-chrome-line bg-chrome text-chrome-fg">
        <div className="flex h-[51px] items-center gap-2.5 px-4">
          <SnagMark className="size-7 shrink-0 text-chrome-fg [--snag-mark-cut:var(--chrome)]" />
          <p className="flex-1 text-body font-semibold">Snag</p>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="h-9 gap-1.5 rounded-md px-2.5 text-meta font-medium text-chrome-fg hover:bg-chrome-hover hover:text-chrome-fg pointer-coarse:h-11"
            >
              <LogOutIcon className="size-4" aria-hidden />
              {adminCopy.shell.signOut}
            </Button>
          </form>
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
