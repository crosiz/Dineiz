import 'dotenv/config';

export async function getEtaSeconds(args: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}) {
  // Uses Google Routes API computeRoutes endpoint.
  // If GOOGLE_MAPS_API_KEY is not set, returns null (safe no-op).
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.duration',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: args.origin.lat, longitude: args.origin.lng } } },
      destination: { location: { latLng: { latitude: args.destination.lat, longitude: args.destination.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    }),
  });

  if (!res.ok) return null;
  const data: any = await res.json();
  const dur = data?.routes?.[0]?.duration as string | undefined; // e.g. "123s"
  if (!dur || !dur.endsWith('s')) return null;
  const seconds = Number(dur.slice(0, -1));
  return Number.isFinite(seconds) ? seconds : null;
}

export function pointInPolygon(point: { lat: number; lng: number }, polygon: Array<[number, number]>) {
  // Ray casting algorithm. Polygon is [lng,lat] pairs.
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

