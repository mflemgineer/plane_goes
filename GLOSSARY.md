# plane_goes

A phone app for a parent and toddler walking in Brooklyn: point at a plane in the sky and learn whether it is landing at or taking off from one of the three home airports, or flying somewhere far away.

## Language

### Places

**Home Airport**:
One of the three New York airports the app cares about: LaGuardia (LGA), Newark (EWR), or JFK.
_Avoid_: Local airport, regional airport, NYC airport

**Other Nearby Airport**:
A smaller airport near New York, such as Westchester (HPN), Teterboro (TEB) or MacArthur/Islip (ISP). The app names it just like a Home Airport when the flight data says so.
_Avoid_: Small airport, minor airport

### Flights

**Flight**:
One aircraft on one journey, as seen in live tracking data, with an origin and a destination when they are known.
_Avoid_: Plane (when meaning the journey), trip

**Arrival**:
A Flight whose destination is a Home Airport or an Other Nearby Airport.
_Avoid_: Landing plane, inbound

**Departure**:
A Flight whose origin is a Home Airport or an Other Nearby Airport.
_Avoid_: Takeoff plane, outbound

**Overflight**:
A Flight passing over Brooklyn whose origin and destination are both outside the New York area. Its origin and destination are shown when known.
_Avoid_: Far away, passing plane, through-flight

**Verdict**:
The app's answer for a Flight: Arrival, Departure, Overflight, or a catch-all (helicopter, small plane, unknown), so no Flight is forced into a wrong answer.
_Avoid_: Result, classification, guess

### Using the app

**Spotter**:
The child credited with a Sighting. In this family, the Spotter is Davey.
_Avoid_: Kid, user, player, child

**Sighting**:
One moment when the parent asks the app "what is that plane?" by pointing the phone at the sky. What's kept is the Flight, its Verdict and the time, never a photo and never where the family was standing.
_Avoid_: Spot, snapshot, photo, query

**Walk**:
A group of Sightings made on the same outing, such as "this afternoon's walk: 4 planes."
_Avoid_: Session, trip, outing

**Sighting Log**:
The history of past Walks and their Sightings, kept on the parent's phone. It records the planes, not the family's whereabouts.
_Avoid_: History, journal, album

**Kid Line**:
The one big, picture-heavy line at the top of a Verdict, written for the toddler.
_Avoid_: Headline, summary

**Mystery Plane**:
A Sighting where no Flight could be matched. Its Kid Line reads "Looks like Amelia Earhart is flying that one! We could not find it."
_Avoid_: Unknown, error, no match

**Grown-up Details**:
The smaller facts under the Kid Line for the parent: airline, origin, destination, altitude, time to landing.
_Avoid_: Metadata, extra info
