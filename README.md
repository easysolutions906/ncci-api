# MCP NCCI Claims Validation

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for validating CPT/HCPCS code pairs against CMS NCCI (National Correct Coding Initiative) edits. Checks Procedure-to-Procedure (PTP) bundling edits and Medically Unlikely Edits (MUE) to prevent claim denials.

## Why this exists

Every medical billing company needs NCCI edit validation. Billing wrong code pairs together results in automatic claim denials, lost revenue, and compliance risk. CMS publishes NCCI edits quarterly, but the raw data is difficult to work with. This server provides instant, programmatic validation with clear guidance on modifier usage.

## Tools (5 total)

| Tool | Description |
|------|-------------|
| `ncci_validate_pair` | Check if two CPT/HCPCS codes can be billed together. Returns edit status, modifier requirements, and rationale. |
| `ncci_validate_claim` | Validate a full claim — checks all code pair combinations for PTP edits and MUE violations. |
| `ncci_edits` | Get all NCCI PTP edits for a specific code — every code it bundles with and modifier indicators. |
| `ncci_mue` | Get the MUE limit for a code — maximum units per line/day/encounter. |
| `ncci_search` | Search edits by code, procedure name, or category. |

## Data

- PTP edits covering common CPT/HCPCS code pairs across 20+ specialties
- MUE entries with practitioner and facility limits
- Categories: allergy, cardiology, dermatology, E&M, GI, GYN, imaging, infusion, lab, OB, ophthalmology, ortho, pain management, PT, pulmonary, psychiatry, sleep, surgery, urology, wound repair
- Data updates available via `npm run build-data`

## Install

```bash
npx @easysolutions906/ncci-api
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ncci": {
      "command": "npx",
      "args": ["-y", "@easysolutions906/ncci-api"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ncci": {
      "command": "npx",
      "args": ["-y", "@easysolutions906/ncci-api"]
    }
  }
}
```

## REST API

Set `PORT` env var to run as an HTTP server:

```bash
PORT=3000 ADMIN_SECRET=your_secret node src/index.js
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/validate` | Validate a code pair |
| POST | `/validate/claim` | Validate a full claim |
| POST | `/validate/batch` | Batch validate multiple claims |
| GET | `/edits?code=99213` | Get all edits for a code |
| GET | `/mue?code=99213` | Get MUE limit for a code |
| GET | `/search?q=arthroscopy` | Search edits by keyword |
| GET | `/stats` | Edit counts by category |
| GET | `/data-info` | Data freshness and record counts |
| POST | `/checkout` | Create Stripe checkout session |

### Examples

**Validate a code pair:**

```bash
curl -X POST https://your-server.com/validate \
  -H 'Content-Type: application/json' \
  -d '{"code1": "99213", "code2": "36415"}'
```

```json
{
  "code1": "99213",
  "code2": "36415",
  "canBillTogether": false,
  "hasEdit": true,
  "comprehensiveCode": "36415",
  "componentCode": "99213",
  "modifierIndicator": 1,
  "modifierIndicatorDescription": "Modifier allowed — use modifier 25, 59, XE, XS, XP, or XU to unbundle",
  "message": "NCCI edit: 36415 bundles 99213. Apply modifier 25/59/XE/XS/XP/XU to 99213 if services are distinct."
}
```

**Validate a full claim:**

```bash
curl -X POST https://your-server.com/validate/claim \
  -H 'Content-Type: application/json' \
  -d '{"codes": ["99213", "36415", "80053"], "modifiers": {"99213": "25"}}'
```

**Get MUE limit:**

```bash
curl https://your-server.com/mue?code=97110
```

```json
{
  "code": "97110",
  "found": true,
  "description": "Therapeutic exercises, 15 min",
  "practitionerMue": 4,
  "rationale": "Up to 4 units (60 min) therapeutic exercise per day",
  "adjudicationIndicator": 2,
  "adjudicationDescription": "Per Day Edit — applies per beneficiary per day"
}
```

## Pricing

| Plan | Validations/day | Batch | Rate | Price |
|------|-----------------|-------|------|-------|
| Free | 20 | 5 | 5/min | $0 |
| Starter | 500 | 25 | 30/min | $29.99/mo |
| Pro | 5,000 | 50 | 100/min | $99.99/mo |
| Business | 50,000 | 100 | 500/min | $299.99/mo |

## NCCI Edit Types

### PTP (Procedure-to-Procedure) Edits

Code pairs that cannot be billed together unless a modifier is applied. Each edit has a modifier indicator:
- **0** = Not allowed — no modifier will unbundle
- **1** = Modifier allowed — use 25, 59, XE, XS, XP, or XU
- **9** = Not applicable

### MUE (Medically Unlikely Edits)

Maximum units for a code per line/day/encounter. Adjudication indicators:
- **1** = Claim Line Edit
- **2** = Per Day Edit
- **3** = Per Encounter Edit

## Audit Trail

Every response includes `dataVersion` (CMS quarter), `buildDate`, and `validatedAt` (ISO timestamp) for compliance documentation.

## Transport

- **stdio** (default) — for local use with Claude Desktop and Cursor
- **HTTP** — set `PORT` env var for Streamable HTTP mode on `/mcp`

## Disclaimer

This tool is provided for informational and screening purposes only. It does not constitute medical or billing advice. Always verify against the current CMS NCCI edit files. Compliance decisions remain the responsibility of the user.
