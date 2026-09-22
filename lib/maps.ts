import type { Venue } from "./types";

/**
 * GO → directions. Apple's unified Maps URLs (iOS 18.4+) open the Maps app
 * straight into directions; the legacy `?daddr=` form still works on older iOS.
 * Android and desktop get Google Maps.
 */
export function appleMapsUrl(v: Pick<Venue, "name" | "address">) {
  const destination = encodeURIComponent(`${v.name}, ${v.address}`);
  return `https://maps.apple.com/directions?destination=${destination}&mode=walking`;
}

export function googleMapsUrl(v: Pick<Venue, "name" | "address">) {
  const destination = encodeURIComponent(`${v.name}, ${v.address}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
}

export function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const applePlatform = /iPhone|iPad|iPod|Macintosh/i.test(ua);
  // iPadOS reports as Macintosh; touch points distinguish it — either way Apple Maps.
  return applePlatform;
}

export function directionsUrl(v: Pick<Venue, "name" | "address">) {
  return isApplePlatform() ? appleMapsUrl(v) : googleMapsUrl(v);
}
