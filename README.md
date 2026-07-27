# VesselCheck

**Hong Kong Vessel Arrival, Departure, and Future Movement Lookup**

VesselCheck is a lightweight, single-page web application for querying vessel movements from Hong Kong Marine Department open-data XML feeds. It is designed for static deployment on GitHub Pages and provides recent, future, and historical vessel searches in a Traditional Chinese interface.

**Live website:** [https://tonyk-codes.github.io/vesselcheck](https://tonyk-codes.github.io/vesselcheck)

> The application interface is in Traditional Chinese (`zh-Hant`). This README is in English.

---

## Features

### Query modes

- **Last 36 hours**
  - Retrieves recent vessel arrival and departure movements.
  - Uses the current Marine Department movement feeds.
- **Future arrivals and departures**
  - Retrieves expected arrival and departure movements.
  - Date-range inputs are disabled in this mode.
- **Historical date range**
  - Supports an inclusive range of up to 20 days.
  - Uses the DATA.GOV.HK Historical Archive API.

The **Last 36 hours** and **Future arrivals/departures** options are mutually exclusive. When neither is selected, the historical date-range controls become available.

### Search filters

- Optional vessel-name partial match
- Arrival only
- Departure only
- Both arrival and departure

### Results

- Total, arrival, and departure counts
- Results sorted by vessel event time
- Case-insensitive vessel-name highlighting
- Arrival and departure type badges
- Duplicate-record merging
- Responsive table layout
- Clear loading, success, partial-result, cached-data, error, and no-results states

The visible columns are:

1. Type
2. Vessel name
3. Time
4. Location
5. Previous port / Next port
6. Vessel type
7. Agent

`CALL_SIGN` is retained internally for record matching but is not displayed in the table.

---

## Adjacent-port matching

VesselCheck enriches movement records with the vessel's adjacent port where the supporting report is available:

- Arrival records use `LAST_PORT`.
- Departure records use `NEXT_PORT`.
- Movement and supporting-report records are matched using a normalized `CALL_SIGN`.

The application does not guess a match by vessel name when `CALL_SIGN` is missing. If a supporting report cannot be retrieved or no reliable match exists, the movement record remains visible and the port value is shown as unavailable.

---

## Data sources

### Last 36 hours

- Arrivals: <https://www.mardep.gov.hk/e_files/en/opendata/RP05005i.XML>
- Departures: <https://www.mardep.gov.hk/e_files/en/opendata/RP05505i.XML>

### Supporting movement reports

These reports provide `LAST_PORT` and `NEXT_PORT` values used for adjacent-port matching:

- Arrival report: <https://www.mardep.gov.hk/e_files/en/pub_services/RP05005.XML>
- Departure report: <https://www.mardep.gov.hk/e_files/en/pub_services/RP05505.XML>

### Future movements

- Future arrivals: <https://www.mardep.gov.hk/e_files/en/pub_services/RP04005.XML>
- Future departures: <https://www.mardep.gov.hk/e_files/en/pub_services/RP04505.XML>

### Historical archive

- Historical file API: <https://app.data.gov.hk/v1/historical-archive/get-file>
- DATA.GOV.HK API documentation: <https://data.gov.hk/en/help/api-spec>

---

## How data retrieval works

VesselCheck is a browser-only application. GitHub Pages serves static files and does not provide a server-side API relay. Marine Department XML endpoints may not permit direct cross-origin browser requests, so the application preserves a proxy-based retrieval method for compatibility.

### Live and future data

1. Determine whether arrival, departure, or both are requested.
2. Retrieve the relevant XML feed through the configured browser-compatible request route.
3. Validate that the response is expected vessel-report XML.
4. Parse the XML into normalized vessel records.
5. Retrieve the required supporting report when adjacent-port enrichment is applicable.
6. Match `LAST_PORT` or `NEXT_PORT` by normalized `CALL_SIGN`.
7. Apply the optional vessel-name filter.
8. Merge duplicates, sort records, and render the results.

### Historical data

1. Validate the selected date range, with a maximum of 20 inclusive days.
2. Process dates sequentially to reduce the likelihood of proxy rate limiting.
3. For each date, retrieve arrival and departure snapshots in parallel when both are requested.
4. Build the historical archive `time` parameter in `YYYYMMDD-HHMM` format using the project's established sampling strategy.
5. Parse the returned snapshot and filter records by the actual arrival or departure event date.
6. Retrieve and match supporting port information when available.
7. Preserve successful records even when another source or date fails.
8. Merge, deduplicate, sort, and render all successfully retrieved records.

Historical snapshots may contain partial records from adjacent dates. VesselCheck therefore filters the final records using `ATA_TIME`, `ATD_TIME`, and supported fallback time fields.

---

## Reliability behavior

The application is designed to return as much valid data as possible without replacing the established browser-fetching method.

Depending on the implemented project version, reliability controls may include:

- per-request timeouts;
- incremental retry delays with jitter;
- rotation between configured CORS proxies;
- temporary cooldown for a recently failing proxy;
- reuse of the most recently successful proxy;
- cancellation of an earlier search when a new search starts;
- sharing of identical in-progress requests;
- validation and rejection of HTML proxy error pages;
- recognition of valid XML reports containing zero records;
- independent handling of arrival, departure, and supporting reports;
- per-day partial success for historical searches;
- browser cache used only after normal retrieval attempts fail;
- clear identification of cached or partially retrieved results.

A failure to retrieve supporting port information does not invalidate the main movement records.

> Because VesselCheck runs entirely in the browser, public CORS proxies remain external dependencies and cannot provide the same reliability as a dedicated same-origin backend. The application mitigates this limitation but cannot eliminate it on GitHub Pages alone.

---

## Project structure

```text
vesselcheck/
├── index.html
├── styles.css
├── app.js
├── README.md
└── CODING_AGENT_IMPLEMENTATION_PLAN.md
```

The project does not require a framework, package manager, or build command.

---

## Local development

Opening `index.html` directly through a `file://` URL may behave differently from a hosted website. Use a small local static server instead.

### Python

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Node.js

If a static server is already available locally:

```bash
npx serve .
```

Do not place API keys or secrets in the repository. All frontend code delivered to GitHub Pages is publicly accessible.

---

## GitHub Pages deployment

1. Create or open the GitHub repository used for VesselCheck.
2. Place `index.html`, `styles.css`, and `app.js` in the publishing directory.
3. Commit and push the files.
4. Open **Settings → Pages** in the repository.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the required branch and folder, commonly `main` and `/root`.
7. Save the configuration.
8. Wait for the deployment to complete.
9. Open the published site and test all query modes.

For this project, the published site is:

<https://tonyk-codes.github.io/vesselcheck>

---

## Post-deployment checks

After every data-fetching change, test the deployed GitHub Pages URL rather than relying only on local tests.

Minimum checks:

- Last 36 hours, both arrival and departure
- Arrival only
- Departure only
- Future arrivals and departures
- Two-day historical range
- Vessel-name filtering
- Adjacent-port matching
- Reset during an active search
- A source failure with partial results available
- A proxy failure followed by fallback
- Cached-data disclosure, if cache fallback is implemented
- Mobile table and form behavior
- Browser console for syntax errors or unhandled Promise rejections

---

## Browser and timezone behavior

All current-date calculations should use the `Asia/Hong_Kong` timezone. Avoid deriving the Hong Kong calendar date from UTC with `toISOString()`.

The interface is intended for current evergreen versions of:

- Microsoft Edge
- Google Chrome
- Mozilla Firefox
- Safari

---

## Privacy and security

VesselCheck does not require a user account and should not collect personal information.

The application retrieves public government data through browser requests and configured third-party CORS relays. Do not send sensitive information through the search form or add private credentials to frontend code.

External XML values should be rendered with safe DOM APIs such as `textContent`, not inserted as untrusted HTML.

---

## Known limitations

- GitHub Pages cannot run server-side code.
- Browser access depends on upstream CORS behavior and public proxy availability.
- Public proxies may be rate-limited, temporarily unavailable, or return an error page.
- Historical archive results depend on the snapshot available for the requested sampling time.
- A historical snapshot may include incomplete adjacent dates.
- Supporting reports may be temporarily unavailable even when movement records are available.
- Browser fallback cache, when enabled, is local to each visitor's browser and is not shared across users.

For materially stronger reliability, a future release could retain the GitHub Pages frontend while adding a controlled serverless API relay. That is intentionally outside the current browser-only architecture.

---

## Development guidance

Detailed compatibility constraints, implementation phases, acceptance tests, and prohibited changes are documented in:

[`CODING_AGENT_IMPLEMENTATION_PLAN.md`](./CODING_AGENT_IMPLEMENTATION_PLAN.md)

Any coding agent or contributor working on data retrieval should read that document before modifying `app.js`.

---

## Attribution

Vessel movement information is sourced from public datasets published by the Hong Kong Marine Department and DATA.GOV.HK.

VesselCheck is an independent interface and is not an official Hong Kong Government service. Users should refer to the original data providers for authoritative information.