import { santaOgImage, santaOgSize } from "@/components/santa-og-card";
import { site } from "@/config/site";

/** The overview's preview. Pages beneath it that have none of their own fall back here. */
export const alt = `Secret Santa on ${site.name}: draw names online, free`;
export const size = santaOgSize;
export const contentType = "image/png";

export default function Image() {
  return santaOgImage({
    eyebrow: "Secret Santa",
    title: "Draw names without the hat",
    facts: ["Free", "No app", "No email addresses"],
    footer: "One link in the group chat. Nobody sees who got whom.",
  });
}
