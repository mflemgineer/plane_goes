# plane_goes

A phone app for a parent and toddler walking in Brooklyn: point at a plane in the sky and learn whether it is landing at or taking off from one of the three home airports, or flying somewhere far away.

## Language

### Places

**Home Airport**:
One of the three New York airports the app cares about: LaGuardia (LGA), Newark (EWR), or JFK.
_Avoid_: Local airport, regional airport, NYC airport

**Other Nearby Airport**:
An airport near New York that is not a Home Airport, such as Teterboro or Islip.
_Avoid_: Small airport, minor airport

### Flights

**Flight**:
One aircraft on one journey, as seen in live tracking data, with an origin and a destination when they are known.
_Avoid_: Plane (when meaning the journey), trip

**Arrival**:
A Flight whose destination is a Home Airport.
_Avoid_: Landing plane, inbound

**Departure**:
A Flight whose origin is a Home Airport.
_Avoid_: Takeoff plane, outbound

**Overflight**:
A Flight passing over Brooklyn whose origin and destination are both elsewhere, not a Home Airport.
_Avoid_: Far away, passing plane, through-flight

**Verdict**:
The app's answer for a Flight: Arrival, Departure, Overflight, or a catch-all (helicopter, small plane, Other Nearby Airport, unknown), so no Flight is forced into a wrong answer.
_Avoid_: Result, classification, guess

### Using the app

**Sighting**:
One moment when the parent asks the app "what is that plane?" from a place, facing a direction, at a time. No photo is involved.
_Avoid_: Spot, snapshot, photo, query

**Walk**:
A group of Sightings made on the same outing, such as "this afternoon's walk: 4 planes."
_Avoid_: Session, trip, outing

**Sighting Log**:
The history of past Walks and their Sightings, kept only on the parent's phone.
_Avoid_: History, journal, album

**Kid Line**:
The one big, picture-heavy line at the top of a Verdict, written for the toddler.
_Avoid_: Headline, summary

**Grown-up Details**:
The smaller facts under the Kid Line for the parent: airline, origin, destination, altitude, time to landing.
_Avoid_: Metadata, extra info
