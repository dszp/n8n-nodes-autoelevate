# Changelog

## [Unreleased]

## [0.2.0] — 2026-09-10

### Added

- Elevation Request → Approve and Deny, gated by a new credential toggle **Allow Write Operations**
  (default off) and the key's `requestEdit` scope. The toggle is checked at the dispatch site and
  again in the transport, which refuses any non-GET without it. Payloads are validated before the
  request is sent (Rule Level required with Create Rule, Duration a positive whole number, Denial
  Reason at most 1000 characters, Elevation Type admin or user).
- Error descriptions keep the API's own message and append a hint; a 409 explains that the request
  must be PENDING.

### Changed

- The transport serialises a POST body once so the HMAC body hash covers exactly the bytes on the
  wire, tolerates responses n8n has already parsed, and reports a non-JSON success body as its own
  failure. HTTP status is read from the modern helper's error shape, so 401/403/429 hints now fire.
- Package and node descriptions no longer say read-only. No change to output shapes.

### Verified

- Approve, deny, rule creation from a request, and elevation type set against a live tenant on
  2026-09-10; a repeat action on a decided request returned 409.

## [0.1.1] — 2026-09-08

### Changed

- First release published through GitHub Actions with npm provenance (OIDC trusted publishing).
  No code changes from 0.1.0.

### Added

- Initial node: Usage (Get, Get Agent Counts by Company), Company, Computer, Location,
  Elevation Request, Elevation Event, Elevated Session, Elevation Rule, Audit Log. Read-only.
- Credential with HMAC (AE-HMAC-SHA256, default) and Bearer (AE-BEARER) schemes; the
  credential test signs a real `GET /usage`.
- Every epoch-millisecond `…At` field gets an `…AtIso` twin in ISO-8601 UTC.
- Get Many pages at 200 rows and verifies the row count against `totalCount`.
