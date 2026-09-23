"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { prepareMapLibre } from "@/lib/maplibre";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import type { NeighborhoodId } from "@/lib/types";

/**
 * The real map for "Where?": streets and water from OpenFreeMap, with the
 * neighborhoods ROUND covers drawn on top as tappable shapes. The map itself
 * doesn't pan or zoom (so the page still scrolls); the only gesture is a tap
 * on a neighborhood. If the tiles can't load, the shapes still draw on paper.
 */

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";

const FALLBACK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "paper", type: "background", paint: { "background-color": "#e6dfcd" } }],
};

type LngLat = [number, number];

/** Hand-traced along the streets people actually use as the borders. Roughly ±100 m. */
const SHAPES: Record<NeighborhoodId, LngLat[]> = {
  "west-village": [
    [-74.0046, 40.7407], // 14th & 9th Ave
    [-73.9967, 40.7378], // 14th & 6th Ave
    [-73.991, 40.7356], // Union Sq West
    [-73.996, 40.7254], // Broadway & Houston
    [-74.003, 40.7279], // 6th Ave & Houston
    [-74.0116, 40.7291], // Houston & the river
    [-74.0108, 40.7345],
    [-74.0098, 40.7395], // Gansevoort & the river
    [-74.0058, 40.7385], // Gansevoort & 9th Ave
  ],
  "east-village": [
    [-73.99, 40.7345], // 14th & 4th Ave
    [-73.9735, 40.7284], // 14th & the river
    [-73.9765, 40.7195], // Houston & the river
    [-73.9926, 40.7245], // Houston & Bowery
    [-73.9917, 40.73], // Astor Place
  ],
  "lower-east-side": [
    [-73.9926, 40.7245], // Houston & Bowery
    [-73.9765, 40.7195], // Houston & the river
    [-73.9845, 40.7125],
    [-73.9895, 40.7085], // under the Manhattan Bridge
    [-73.9965, 40.7152], // Canal & Bowery
  ],
  "soho-nolita": [
    [-74.003, 40.7279], // 6th Ave & Houston
    [-73.996, 40.7254], // Broadway & Houston
    [-73.9926, 40.7245], // Bowery & Houston
    [-73.9965, 40.7152], // Canal & Bowery
    [-74.0004, 40.719], // Canal & Broadway
    [-74.0052, 40.7226], // Canal & 6th Ave
  ],
  tribeca: [
    [-74.0112, 40.7248], // Canal & the river
    [-74.0052, 40.7226], // Canal & 6th Ave
    [-74.0004, 40.719], // Canal & Broadway
    [-74.0067, 40.7143], // Chambers & Broadway
    [-74.013, 40.7167], // Chambers & the river
  ],
  chelsea: [
    [-74.0098, 40.7395], // Gansevoort & the river
    [-74.0058, 40.7385], // Gansevoort & 9th Ave
    [-74.0046, 40.7407], // 14th & 9th Ave
    [-73.9967, 40.7378], // 14th & 6th Ave
    [-73.9895, 40.7477], // 30th & 6th Ave
    [-74.0058, 40.7545], // 30th & the river
    [-74.0085, 40.747],
  ],
  williamsburg: [
    [-73.9615, 40.7255], // Bushwick Inlet
    [-73.9545, 40.7212], // McCarren Park, Bedford & N 12th
    [-73.947, 40.719], // Meeker & the BQE
    [-73.9425, 40.712], // BQE & Metropolitan
    [-73.9475, 40.703], // Broadway & Flushing
    [-73.9625, 40.7095], // Williamsburg Bridge
    [-73.9675, 40.7145], // Domino Park
    [-73.9645, 40.72],
  ],
  greenpoint: [
    [-73.9615, 40.7255], // Bushwick Inlet
    [-73.9545, 40.7212], // McCarren Park corner
    [-73.9495, 40.7245], // Nassau & Manhattan Ave
    [-73.9425, 40.7265], // Nassau & the BQE
    [-73.939, 40.733], // Newtown Creek, Kingsland
    [-73.9485, 40.7378], // Newtown Creek
    [-73.9605, 40.7372], // the north tip
    [-73.9615, 40.7305], // Transmitter Park
  ],
};

const LABELS: Record<NeighborhoodId, LngLat> = {
  chelsea: [-73.9995, 40.7455],
  "west-village": [-74.0025, 40.7335],
  "east-village": [-73.983, 40.727],
  "lower-east-side": [-73.9855, 40.7175],
  "soho-nolita": [-73.9968, 40.7238],
  tribeca: [-74.0088, 40.7182],
  williamsburg: [-73.955, 40.7135],
  greenpoint: [-73.951, 40.731],
};

function shapesGeoJson(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: NEIGHBORHOODS.map((n) => ({
      type: "Feature",
      properties: { id: n.id, name: n.short },
      geometry: { type: "Polygon", coordinates: [[...SHAPES[n.id], SHAPES[n.id][0]]] },
    })),
  };
}

function bounds(): [LngLat, LngLat] {
  let w = 180, s = 90, e = -180, no = -90;
  for (const pts of Object.values(SHAPES)) for (const [lng, lat] of pts) {
    w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); no = Math.max(no, lat);
  }
  return [[w, s], [e, no]];
}

const INK = "#16213a";
const TOMATO = "#d9482b";

export function RealMap({ value, onSelect, height = 360 }: { value?: NeighborhoodId; onSelect: (id: NeighborhoodId) => void; height?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const labelsRef = useRef<Map<NeighborhoodId, HTMLDivElement>>(new Map());
  const selectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    prepareMapLibre();
    const map = new MapLibreMap({
      container: ref.current,
      style: STYLE,
      bounds: bounds(),
      fitBoundsOptions: { padding: { top: 26, bottom: 26, left: 18, right: 18 } },
      attributionControl: { compact: true },
      fadeDuration: 0,
      dragPan: false,
      dragRotate: false,
      scrollZoom: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      touchPitch: false,
      keyboard: false,
      boxZoom: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    let fellBack = false;
    let layered = false;

    const addLayers = () => {
      if (layered || !map.isStyleLoaded()) return;
      layered = true;
      map.addSource("hoods", { type: "geojson", data: shapesGeoJson() });
      map.addLayer({
        id: "hoods-fill",
        type: "fill",
        source: "hoods",
        paint: { "fill-color": INK, "fill-opacity": 0.14 },
      });
      map.addLayer({
        id: "hoods-line",
        type: "line",
        source: "hoods",
        paint: { "line-color": INK, "line-opacity": 0.55, "line-width": 1.4 },
      });
      map.addLayer({
        id: "hoods-selected",
        type: "fill",
        source: "hoods",
        filter: ["==", ["get", "id"], "__none__"],
        paint: { "fill-color": TOMATO, "fill-opacity": 0.62 },
      });
      map.on("click", "hoods-fill", (e) => {
        const id = e.features?.[0]?.properties?.id as NeighborhoodId | undefined;
        if (id) selectRef.current(id);
      });
      for (const n of NEIGHBORHOODS) {
        const el = document.createElement("div");
        el.className = "hood-label";
        el.textContent = n.short;
        el.style.pointerEvents = "none";
        labelsRef.current.set(n.id, el);
        new Marker({ element: el, anchor: "center" }).setLngLat(LABELS[n.id]).addTo(map);
      }
      setReady(true);
    };

    map.on("load", addLayers);
    map.on("error", (e) => {
      // Tiles unreachable (offline, a blocked network): draw the shapes on paper.
      const msg = String((e as { error?: { message?: string } }).error?.message ?? "");
      if (fellBack || map.isStyleLoaded()) return;
      if (!/style|fetch|load|network|Failed/i.test(msg)) return;
      fellBack = true;
      map.setStyle(FALLBACK);
      map.once("style.load", addLayers);
    });
    // A style that never answers at all (no error event): fall back after a beat.
    const timer = window.setTimeout(() => {
      if (!map.isStyleLoaded() && !fellBack) {
        fellBack = true;
        map.setStyle(FALLBACK);
        map.once("style.load", addLayers);
      }
    }, 6000);

    const labels = labelsRef.current;
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      labels.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("hoods-selected", ["==", ["get", "id"], value ?? "__none__"]);
    labelsRef.current.forEach((el, id) => {
      el.setAttribute("data-selected", id === value ? "1" : "0");
    });
  }, [value, ready]);

  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: "#e6dfcd" }} role="group" aria-label="Neighborhood map">
      <div ref={ref} style={{ width: "100%", height }} />
      {/* Paper vignette so the tiles feel like ROUND, not a maps app. */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 48px rgba(22,33,58,0.14)" }} />
    </div>
  );
}
