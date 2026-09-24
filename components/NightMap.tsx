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

/** What a pin needs. Venues and the lighter Spots rows both qualify. */
export type MapVenue = Pick<Venue, "slug" | "name" | "lat" | "lng"> & { kind?: Venue["kind"]; /** When one place has several pins (one per door). */ pinId?: string };

export type NightMapProps<V extends MapVenue> = {
  venues: V[];
  saved: Set<string>;
  been: Set<string>;
  onSelect?: (v: V | null) => void;
  height?: number | string;
  focus?: { lat: number; lng: number; zoom?: number };
  /** False: a picture that scrolls with the page (tap it to open the real thing). True: pan, pinch, zoom buttons. */
  interactive?: boolean;
  rounded?: boolean;
  /** Where the person is, when they allowed it: the blue dot. */
  you?: { lat: number; lng: number } | null;
  /** Change `key` to glide the map somewhere (their location, a pin). */
  flyTo?: { lat: number; lng: number; zoom?: number; key: number };
  /** The pin that's open, drawn larger. */
  selected?: string | null;
  /** Bigger pins, for a map that's the whole screen and a thumb that's had a drink. */
  big?: boolean;
  controls?: "bottom-right" | "top-right";
};

export function NightMap<V extends MapVenue>({
  venues,
  saved,
  been,
  onSelect,
  height = 320,
  focus,
  interactive = true,
  rounded = true,
  you,
  flyTo,
  selected,
  big = false,
  controls = "bottom-right",
}: NightMapProps<V>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const youRef = useRef<Marker | null>(null);
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
      map.addControl(new NavigationControl({ showCompass: false }), controls);
    }
    mapRef.current = map;
    // Pins shrink when the whole city is in frame so dense blocks don't pile up; zoom in and they grow.
    const zoomed = () => ref.current?.parentElement?.setAttribute("data-zoom", map.getZoom() >= 13.4 ? "near" : "far");
    zoomed();
    map.on("zoom", zoomed);
    map.on("load", () => setReady(true));
    map.on("error", () => setReady(true)); // tiles offline → still show markers
    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
      youRef.current?.remove();
      youRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    for (const v of venues) {
      const kind: MarkerKind = saved.has(v.slug) ? "saved" : been.has(v.slug) ? "been" : "all";
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", v.name);
      el.className = "round-marker";
      el.dataset.kind = kind;
      el.dataset.slug = v.slug;
      if (v.kind) el.dataset.what = v.kind;
      if (big) el.dataset.size = "big";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect?.(v);
      });
      markersRef.current.set(v.pinId ?? v.slug, new Marker({ element: el, anchor: "center" }).setLngLat([v.lng, v.lat]).addTo(map));
    }
    // A tap on the map itself closes the card. A tap on a pin is the pin's business, however the
    // browser orders the events (MapLibre builds its own click from mousedown/up, so stopPropagation
    // on the pin isn't enough on its own).
    const clear = (e: { originalEvent?: Event }) => {
      const target = e.originalEvent?.target as HTMLElement | null | undefined;
      if (target?.closest?.(".round-marker")) return;
      onSelect?.(null);
    };
    map.on("click", clear);
    return () => {
      map.off("click", clear);
    };
  }, [venues, saved, been, onSelect, big]);

  // The open pin sits on top and grows a little.
  useEffect(() => {
    markersRef.current.forEach((m) => {
      const el = m.getElement();
      if (selected && el.dataset.slug === selected) el.setAttribute("data-selected", "1");
      else el.removeAttribute("data-selected");
    });
  }, [selected, venues]);

  // The person: the blue dot everyone knows.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!you) {
      youRef.current?.remove();
      youRef.current = null;
      return;
    }
    if (!youRef.current) {
      const el = document.createElement("div");
      el.setAttribute("data-map-you", "1");
      el.style.cssText = "width:16px;height:16px;border-radius:999px;background:#1f6fe0;border:3px solid #ffffff;box-shadow:0 0 0 6px rgba(31,111,224,0.22),0 1px 4px rgba(22,33,58,0.35);pointer-events:none";
      youRef.current = new Marker({ element: el, anchor: "center" }).setLngLat([you.lng, you.lat]).addTo(map);
    } else youRef.current.setLngLat([you.lng, you.lat]);
  }, [you, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.easeTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? Math.max(map.getZoom(), 14.5), duration: 600 });
  }, [flyTo]);

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
