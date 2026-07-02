import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Remote Classroom — a real desktop for every student",
    short_name: "Remote Classroom",
    description:
      "Give every student a real Linux or Windows desktop in the browser, powered by Daytona.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcf9f5",
    theme_color: "#201e1a",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
