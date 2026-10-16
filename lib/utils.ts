import { createCn } from "cn/config"

// The design system's three type levels are font sizes. Without this, the class merger reads
// `text-body` as a color: it drops the component's text color and keeps its `text-sm`.
// shadcn-generated components import `cn` from "cn"; point them here after `shadcn add`.
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["title", "body", "meta"] }] } },
})
