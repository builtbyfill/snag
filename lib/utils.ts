import { createCn } from "cn/config"

// The design system's three type levels are font sizes. Without this, the class merger reads
// `text-body` as a color: it drops the component's text color and keeps its `text-sm`.
// shadcn-generated components import `cn` from "cn"; point them here after `shadcn add`.
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["display", "title", "label", "body", "meta"] }] } },
})

/** Avatar letters: the first letter of the first two words ("Clinic booking" → "CB"), or the first two of one word. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?"
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]]
  return letters.join("").toLocaleUpperCase("bs")
}
