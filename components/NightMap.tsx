"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { prepareMapLibre } from "@/lib/maplibre";
import type { Venue } from "@/lib/types";

/**
 * The nightlife map. Free OpenFreeMap tiles (no key, no limits), darkened to
 * chalk black with a CSS filter on the canvas only, so ROUND's markers stay
 * cobalt and chalk on top. Set NEXT_PUBLIC_MAP_STYLE to swap styles.
 */
const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";

export type MarkerKind = "saved" | "been" | "all";

export function NightMap({
  venues,
  saved,
  been,
  onSelect,
  height = 320,
  focus,
  interactive = true,
  rounded = true,
}: {
  venues: Venue[];
  saved: Set<string>;
  been: Set<string>;
  onSelect?: (v: Venue | null) => void;
  height?: number | string;
  focus?: { lat: number; lng: number; zoom?: number };
  /** False: a picture that scrolls with the page (tap it to open the real thing). True: pan, pinch, zoom buttons. */
  interactive?: boolean;
  rounded?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    prepareMapLibre();
    const map = new MapLibreMap({
      container: ref.current,
      style: STYLE,
      center: [focus?.lng ?? -73.981, focus?.lat ?? 40.7235],
      zoom: focus?.zoom ?? 11.85,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    if (!interactive) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
    } else {
      map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    }
    mapRef.current = map;
    map.on("load", () => setReady(true));
    map.on("error", () => setReady(true)); // tiles offline → still show markers
    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = venues.map((v) => {
      const kind: MarkerKind = saved.has(v.slug) ? "saved" : been.has(v.slug) ? "been" : "all";
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", v.name);
      el.className = "round-marker";
      el.dataset.kind = kind;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect?.(v);
      });
      return new Marker({ element: el, anchor: "center" }).setLngLat([v.lng, v.lat]).addTo(map);
    });
    const clear = () => onSelect?.(null);
    map.on("click", clear);
    return () => {
      map.off("click", clear);
    };
  }, [venues, saved, been, onSelect]);

  return (
    <div className={`relative overflow-hidden ${rounded ? "rounded-[24px] border" : ""}`} style={{ height, borderColor: "var(--hairline)", background: "var(--paper-2)" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(22,33,58,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(22,33,58,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: ready ? 1 : 0.999 }} />
    </div>
  );
}
