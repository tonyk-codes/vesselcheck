# VesselCheck — Hong Kong Vessel Arrival/Departure Lookup (Web)

A lightweight, single‑page web app for querying vessel **arrival** and **departure** movements using Hong Kong Marine Department open data feeds. It supports both:

- **Last 36 hours** (live XML feeds), and
- **Historical date ranges** (via the data.gov.hk Historical Archive API, up to **20 days** per query)

> UI language in the current build is Traditional Chinese (zh-Hant). This README is in English.

---

## Features

- **Two query modes**
  - ✅ **Last 36 hours** (fast, live XML feeds)
  - ✅ **Historical range** (select start/end dates; max 20 days)
- **Filters**
  - Vessel name (partial match)
  - Data type: **Arrival**, **Departure**, or **Both**
- **Results UX**
  - Summary statistics (total / arrivals / departures)
  - Table view with type badges (Arrival/Departure)
  - Highlighted matches for the searched vessel name
  - “No results” state + clear messages
- **Reliability built-in**
  - Automatic retry with incremental backoff
  - Record de-duplication across multiple fetches
  - Sorting by event time (ascending)
- **CORS handling**
  - Direct Marine Department XML endpoints may block browser CORS requests  
    → the app falls back to public CORS proxies for client-side access.

---

## Data Sources

This app reads public datasets provided by the Hong Kong Marine Department and the data.gov.hk historical archive:

- Last 36 hours (Arrivals): `https://www.mardep.gov.hk/e_files/en/opendata/RP05005i.XML`
- Last 36 hours (Departures): `https://www.mardep.gov.hk/e_files/en/opendata/RP05505i.XML`
- Historical archive API: `https://api.data.gov.hk/v1/historical-archive/get-file`

Links are also included in the page footer for quick reference.

---

## How It Works (High-level)

### Last 36 Hours
1. Fetch arrivals and/or departures XML feeds.
2. Parse records into a normalized structure:
   - `vesselName`, `type`, `time`, `location`, `shipType`, `callSign`, `agentName`, `remark`
3. Filter by vessel name (optional), dedupe, sort, and render.

### Historical Range (Up to 20 days)
1. For each day in the selected range:
   - Build a `time` parameter in the format: `YYYYMMDD-HHMM`
   - Use a half-hour “sampling point” (e.g., `2330` for past dates; current half-hour for today)
2. Call the historical archive API with the original dataset URL and the computed `time`.
3. Parse, merge, dedupe, filter, sort, and render.

> Note: Historical archive access is snapshot-based; results depend on dataset snapshots available at the requested time.

---

## Vessel Check Website: https://tonyk-codes.github.io/vesselcheck
