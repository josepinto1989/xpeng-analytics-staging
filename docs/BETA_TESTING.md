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

### Beta 6 — Analytical Workspace

Journeys is now the reference implementation for the selected version 3
visual system.

1. Open Journeys in Advanced mode and confirm the record list stays visible
   beside the selected journey on a desktop display.
2. Confirm distance, duration, average consumption, and maximum speed update
   when another journey is selected.
3. Open Overview, Energy, Driving, Battery, and Technical. Confirm every tab
   changes content without losing the selected journey.
4. On Overview, hover the speed and power charts and confirm the route marker
   follows the corresponding position on the map.
5. Open Journey details, edit classification or notes, close the drawer, and
   confirm the workspace remains compact.
6. Switch to Simple mode. Confirm the same workspace remains but only the
   essential Overview content is shown.
7. Repeat in light and dark themes and at desktop, tablet, and phone widths.

### Beta 7 — Simple mode refinements

1. Open the Beta in a clean browser profile and confirm the initial theme is
   light. Switch to dark, reload, and confirm the preference is remembered.
2. On Simple Home, confirm distance and energy share one daily chart and the
   introductory marketing copy is no longer shown.
3. In Simple Journeys, test one journey with GPS and one without GPS. The route
   should appear only when it exists, with no empty GPS placeholder.
4. Confirm the selected journey shows its initial and final SOC. This should
   also work when SOC must be recovered from the journey segments.
5. In Simple Charging, switch between All, AC, and DC. Confirm the selected
   list and session update, the redundant SOC bar is gone, and charging curve
   plus battery-temperature panels are present.
6. Open Simple Battery and confirm it starts directly with the vehicle and
   battery assessment rather than an additional introductory block.
7. Open Highlights and Replay from Simple navigation and confirm both retain
   their complete interactions.
8. At a desktop viewport around 760 px high, confirm Search, Data, and Settings
   remain visible at the bottom of the sidebar.

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
