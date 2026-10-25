"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { adminCopy } from "@/lib/copy/admin";

const OpenNav = createContext<() => void>(() => {});

/** For the menu button in the clients column: opens the nav where it doesn't fit as a column. */
export const useOpenNav = () => useContext(OpenNav);

/**
 * The nav column from 1280px; below that the same nav in a sheet from the left. Following a
 * link inside it closes it.
 */
export function DashboardFrame({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <OpenNav.Provider value={() => setOpen(true)}>
      {/* The shell: exactly the window's height, never scrolling itself. Nav 220 from 1280px;
          the page fills the rest with its own clients | thread grid. min-h-0 lets children scroll. */}
      <div
        data-shell="dashboard"
        className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)]"
      >
        <div className="hidden min-h-0 overflow-hidden border-r border-line xl:block">{nav}</div>
        <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          data-surface="admin"
          className="gap-0 border-chrome-line bg-chrome p-0 text-chrome-fg shadow-none data-[side=left]:w-[260px] data-[side=left]:max-w-[85%] data-[side=left]:sm:max-w-[85%]"
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          <SheetTitle className="sr-only">{adminCopy.nav.label}</SheetTitle>
          {nav}
        </SheetContent>
      </Sheet>
    </OpenNav.Provider>
  );
}
