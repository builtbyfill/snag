"use client";

import { Select } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

export type MenuOption = { value: string; label: string; glyph?: ReactNode };

/**
 * Status and Priority in the ticket header: a small menu in the dashboard's own tokens instead
 * of the operating system's list. Keyboard: arrows, Enter, Esc, type-ahead (Base UI).
 */
export function MenuSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: MenuOption[];
  onChange: (value: string) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Select.Root
      value={value}
      items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
      onValueChange={(next) => {
        if (typeof next === "string" && next !== value) onChange(next);
      }}
    >
      <Select.Trigger
        aria-label={label}
        className="flex h-8 min-w-[8.5rem] items-center gap-1.5 rounded-lg border border-line-strong bg-canvas pr-2 pl-2.5 text-meta font-medium text-ink transition-colors hover:bg-hover data-[popup-open]:bg-sunken pointer-coarse:h-11"
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center text-ink-secondary">{current.glyph}</span>
        <Select.Value className="flex-1 text-left">{current.label}</Select.Value>
        <Select.Icon className="text-ink-muted">
          <ChevronDownIcon className="size-3.5" aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} align="start" alignItemWithTrigger={false} className="z-50 outline-none">
          <Select.Popup
            data-surface="admin"
            className="min-w-[var(--anchor-width)] origin-[var(--transform-origin)] rounded-xl border border-line-medium bg-surface p-1 text-ink transition-[opacity,scale] duration-(--motion-fast) data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0"
          >
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex h-8 cursor-default items-center gap-2 rounded-lg pr-2 pl-2 text-meta text-ink outline-none select-none data-[highlighted]:bg-sunken pointer-coarse:h-11"
                >
                  <span className="flex size-3.5 shrink-0 items-center justify-center text-ink-secondary">{option.glyph}</span>
                  <Select.ItemText className="flex-1">{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="text-ink">
                    <CheckIcon className="size-3.5" aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
