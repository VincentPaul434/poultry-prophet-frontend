import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poultry Prophet",
    short_name: "Poultry Prophet",
    description: "Batch monitoring and review for gamefowl farm operations.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f9f6",
    theme_color: "#28633f",
    lang: "en",
    icons: [
      { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
