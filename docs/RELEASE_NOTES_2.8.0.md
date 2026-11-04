# XPENG Analytics 2.8.0

Version 2.8 brings the owner-validated Beta work into the stable application.
It adds deeper practical analysis, more useful ownership records, richer route
exploration, a more compact interface, and new local CSV exports.

## Practical intelligence

- Review data freshness, portable-history protection, Drive backup state, RAW
  source coverage, and known telemetry gaps in one data-protection view.
- Compare AC or DC charging sessions in Charging Lab, including observed power,
  SOC windows, taper, time, and temperature changes when available.
- Investigate parked-energy observations and compare any two periods side by
  side without presenting software estimates as vehicle diagnoses.

## Ownership and costs

- Add origin, destination, purpose, and comments to journeys.
- Use local suggestions for repeated places and previously confirmed labels.
- Configure time-of-use and location-specific tariffs, free charging, and
  manual public-charging costs.
- Track maintenance, tyres, inspections, insurance, and odometer reminders.

## Routes, telemetry, and usability

- Colour matched GPS routes by speed, power, regeneration, or estimated
  consumption and synchronise the map, elevation, and journey charts.
- Show battery-estimate confidence, tyre observations, and front/rear motor
  views only when the required signals are genuinely present.
- Use the refined navigation, compact dashboard sections, bounded technical
  tables, responsive controls, and faster chart-to-map interaction.

## Advanced CSV exports

- Export a local ZIP containing consolidated operation, energy, and status
  CSVs, a documented manifest, and SHA-256 checksums.
- Generate large exports month by month in the worker to limit memory use.
- Export the currently visible journey or charging list as a processed CSV,
  respecting period, search, classification, AC/DC, and location filters.
- Protect text cells against spreadsheet formula execution while retaining
  telemetry and calculated values as numeric cells.

Consolidated telemetry can contain vehicle identifiers and sensitive history.
Handle it with the same care as the original XPENG export.

## Compatibility and privacy

Existing supported `.xpeng` histories continue to open. Analysis and exports
run in the browser. Google Drive remains optional and uses the limited
`drive.file` permission for files created by XPENG Analytics.

Battery capacity, SOH, range, charging losses, parked energy, and costs remain
software estimates based on the telemetry XPENG supplied. They are not
official BMS readings, invoices, receipts, or mechanical diagnoses.
