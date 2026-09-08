# Changelog

## [Unreleased]

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
