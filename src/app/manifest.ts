import type { MetadataRoute } from "next";

/** PWA manifest (TASK-604) — standalone mode is the "feels like an app" lever. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "senda — send a dollar home in a second",
    short_name: "senda",
    description:
      "Cross-border money transfers that feel like texting. Passkey-only, instant settlement, fees you can verify on-chain.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF9",
    theme_color: "#10B981",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
  };
}
