# n8n-nodes-autoelevate

An [n8n](https://n8n.io/) community node for the [AutoElevate](https://www.autoelevate.com/)
Partner API (beta). It reads companies, computers, locations, elevation requests, events,
sessions and rules, and the audit log, and it can count active agents per company for billing
reconciliation.

The node is **read-only by design**. The API's two write operations (approve and deny an
elevation request) are not implemented. Create the API key without the `requestEdit` scope and
the API enforces the same boundary.

> The Partner API is in beta and can change without notice. The node sends the required
> `X-Acknowledgment: i-understand-this-is-beta-and-may-change` header on every request and
> pins `/api/v1/` paths.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) ·
[Agent counts for billing](#agent-counts-for-billing) · [Rate limits](#rate-limits) ·
[Development](#development)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install `n8n-nodes-autoelevate`.

## Credentials

1. In the AutoElevate admin portal, open **Users** and create a **service user** for n8n. Don't
   attach keys to a person's account.
2. In that user's **API Keys** section, add a key. Prefer **HMAC (AE-HMAC-SHA256)**: it shows a
   token (`aeh_…`) and a separate signing key, and every request is signed so a captured
   request can't be replayed elsewhere or after five minutes. **API Token (AE-BEARER)** gives
   one `aeb_…` secret.
3. Grant only the scopes you need (table below) and set the shortest practical expiry.
4. Copy both values immediately. They are shown once.

In n8n, create an **AutoElevate API** credential:

| Field | Value |
|---|---|
| Authentication | HMAC (default) or Bearer, matching the key type |
| API Token | The `aeh_…` or `aeb_…` token |
| HMAC Signing Key | The signing key, exactly as displayed (HMAC only) |
| Base URL | Leave at `https://partner-api.autoelevate.com` |

Saving the credential runs a signed `GET /usage` and reports the partner name and active-agent
count. A `401` means the token, signing key, or scheme is wrong; a `403` means the key lacks
`computerView`.

| Resource / operation | Scope |
|---|---|
| Usage → Get | `computerView` |
| Usage → Get Agent Counts by Company | `computerView`, `companyView` |
| Company | `companyView` |
| Computer | `computerView` |
| Location | `locationView` |
| Elevation Request | `requestView` |
| Elevation Event | `eventView` |
| Elevated Session | `elevatedSessionView` |
| Elevation Rule | `ruleView` |
| Audit Log | `auditLogView` (may also need Early Access enrolment) |

## Operations

| Resource | Operations | Filters |
|---|---|---|
| Usage | Get, Get Agent Counts by Company | |
| Company | Get, Get Many | |
| Computer | Get, Get Many | Company, Location |
| Location | Get, Get Many | Company |
| Elevation Request | Get, Get Many | Approval State, Company, Start, End |
| Elevation Event | Get Many | Company, Start, End |
| Elevated Session | Get, Get Many | Company, Computer ID, Status |
| Elevation Rule | Get Many | Company |
| Audit Log | Get Many | Action, Entity Type, Start, End |

Notes:

- **Get Many** pages at the API maximum (200 rows) and checks the rows returned against the
  server's `totalCount`. A mismatch stops the node with a message instead of returning a
  silently short list.
- **Computer → Get Many** returns only computers that checked in within the **last 30 days**.
  That is the API's active-fleet window, so it is the billable count, not the inventory.
- **Start** and **End** accept any date n8n can parse and are sent as epoch milliseconds.
- Every timestamp in the output is epoch milliseconds. `endedAt` on an elevated session is the
  scheduled end, not updated if the session ended early.
- The company and location dropdowns list what the key can see. A restricted key sees only
  its permitted companies.

## Agent counts for billing

**Usage → Get Agent Counts by Company** emits one item per company:

```json
{
  "companyId": "…",
  "companyName": "Acme Industries",
  "managementSystemCompanyId": "PSA-1234",
  "activeAgents": 37,
  "byElevationMode": { "audit": 2, "live": 35, "policy": 0, "technicianBypass": 0, "unknown": 0 }
}
```

and, when **Include MSP Summary Item** is on, a final item:

```json
{ "summary": true, "partnerName": "…", "fromUsage": 590, "fromComputers": 593, "agree": false, "companies": 36 }
```

`fromUsage` is the API's periodically refreshed snapshot; `fromComputers` is the live walk. A
difference of a few units is snapshot lag. `managementSystemCompanyId` is the key a PSA
integration set when it created the company, which is how you join these rows to Autotask,
ConnectWise, or Halo. Companies with zero agents are present with `0`; a computer whose company
the key can't see appears in a row with `companyName: null`.

The operation walks `/companies` and `/computers` once each and reads `/usage` once. For N
computers and C companies that is `ceil(N/200) + ceil(C/200) + 1` requests.

## Rate limits

The API allows **100 requests per hour per HTTP method and route**. A `429` stops the node with
the `Retry-After` value in the message. The node does not retry on its own. Schedule billing
runs accordingly and avoid Return All on large event or request histories inside a loop.

## Development

```bash
npm install
npm run lint
npm run build
npm run dev          # local n8n with the node loaded
```

The OpenAPI document this node was written against is in `openapi/` with its provenance. The
signing algorithm and the pagination rules mirror
[`@dszp/autoelevate-lib`](https://github.com/dszp/autoelevate-lib), which is the reference
implementation with offline test vectors; keep the two transports in step.

## License

MIT
