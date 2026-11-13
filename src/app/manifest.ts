import type { MetadataRoute } from "next";

/* Lets phones show the S icon when the game is added to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stroop",
    short_name: "Stroop",
    description: "Name the ink, not the word. A Stroop-effect reaction game.",
    start_url: "/",
    display: "standalone",
    background_color: "#080807",
    theme_color: "#080807",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
