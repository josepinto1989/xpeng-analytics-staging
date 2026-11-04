# XPENG Analytics public Beta

The Beta website is a public development channel for testing features before
they reach the stable XPENG Analytics website.

## XPENG Analytics 3.0 Beta — Driver Cockpit

This Beta tests a new Driver Cockpit visual system. It uses the same local
processing engine and compatible `.xpeng` histories as the official site. The
official site is not changed by this test.

1. Open an existing `.xpeng` history and confirm Home shows distance,
   consumption, charging cost (when a tariff exists), performance, vehicle
   pulse, and recent events.
2. Open each of the five navigation areas and confirm every existing page is
   still available through its group.
3. Open Data and confirm import, export, local history, Google Drive, original
   ZIP/GPX retention, and backup settings are unchanged.
4. Switch between 7, 15, 30 days, all data, and a custom period. Confirm Home
   and its comparison labels update.
5. Use the Vehicle pulse and recent-event shortcuts and confirm they open the
   expected Battery, Tyres, Insights, Journey, or Charging detail.
6. Check English and Portuguese, metric and imperial units, bar and PSI, light
   and dark themes, desktop and mobile layouts.

## Open the Beta

<https://josepinto1989.github.io/xpeng-analytics-staging/>

The stable website remains available at:

<https://josepinto1989.github.io/xpeng-analytics/>

## Important

- Beta features may change, contain errors, or require data to be imported
  again.
- Keep the original ZIP files supplied by XPENG.
- Export a current `.xpeng` backup before testing a new data-storage or history
  feature.
- The Beta and stable websites use separate browser storage because their URLs
  are different. Importing a history into one does not automatically make it
  available in the other.
- Do not rely on a Beta calculation for safety, maintenance, warranty, tax, or
  accounting decisions without checking the source data.

## Phase 18 test areas

1. **Data protection centre** — confirm that freshness, recoverable days,
   Drive state, RAW coverage, and known gaps match the imported history.
2. **Charging Lab** — compare AC with AC or DC with DC, inspect the observed
   charge windows, and verify that SOC-normalised curves remain aligned.
3. **Parked energy** — check long stops and overnight observations against the
   underlying battery history. These are observations, not diagnoses.
4. **Compare** — choose two date periods and verify totals, percentage changes,
   and aligned daily charts.

## Phase 22 test area — v2.8.0-beta.2

1. Import or restore a representative `.xpeng` history.
2. Open **Data → Advanced data export** and choose **Export consolidated
   CSVs**.
3. Confirm that the downloaded ZIP contains `driving_operation.csv`,
   `driving_power_energy.csv`, `driving_status.csv`, and `manifest.json`.
4. Open the CSVs in Excel or LibreOffice and confirm that timestamps, negative
   telemetry, and decimal values remain usable as data.
5. Compare the manifest coverage and row counts with the imported history and
   confirm that all three SHA-256 records are present.
6. On a long history, confirm that the browser remains responsive and the
   progress message changes while months are processed.
7. In **Journeys**, combine period, search, and classification filters, export
   the visible CSV, and confirm that only those processed journeys are present.
8. In **Charging**, combine AC/DC and location filters, export the visible CSV,
   and confirm the session metrics and any configured costs or tariffs.

This Beta does not yet add password protection to `.xpeng` histories. That is
the next Phase 22 step and will be tested separately.

Please report the browser, device, XPENG model, imported period, and the exact
steps that produced an unexpected result. Do not attach private vehicle data to
a public issue unless it has been deliberately anonymised.

Report Beta problems at:

<https://github.com/josepinto1989/xpeng-analytics-staging/issues>
