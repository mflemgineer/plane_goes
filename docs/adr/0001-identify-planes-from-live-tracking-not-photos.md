# Identify planes from live flight tracking, not photos

The app works out which plane the parent means from live flight tracking data (ADS-B), using the phone's location, compass direction, tilt and the current time. It does not analyse photos, and no photo is taken. A single photo can't tell a small nearby plane from a large distant one, and can't show which way the plane is flying. Live tracking gives the real flight, altitude, heading and usually its route. It also keeps the parent's camera roll clean.

## Considered options

- **Photo analysis**: rejected. Distance and heading can't be recovered reliably from one frame.
- **Brooklyn-geography rules only** (e.g. low and heading east means JFK): kept only as a sanity check, since live data is available for free.

## Consequences

- The app depends on free community data sources (adsb.lol for positions, adsbdb/hexdb for routes). These have rate limits and no guarantees, and community route data can be stale.
- Plane positions must go through a small server-side proxy, because adsb.lol doesn't allow direct browser requests.
