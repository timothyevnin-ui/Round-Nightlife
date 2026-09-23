import { getWorkerUrl, setWorkerUrl } from "maplibre-gl";

/**
 * MapLibre 6 runs its tile and GeoJSON work in a web worker that it expects
 * to find next to its own script. Inside a bundled app that file isn't there,
 * so the map draws nothing. The worker (and the shared chunk it imports) are
 * copied into /public/maplibre; point MapLibre at them once, before any map.
 */
export function prepareMapLibre() {
  if (typeof window === "undefined") return;
  if (getWorkerUrl()?.startsWith("/maplibre/")) return;
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}
