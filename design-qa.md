# Design QA — Analytical Workspace

- Source visual truth: `C:\Users\seque\.codex\generated_images\01a12b81-3ce6-7523-b932-ee99ceac04eb\exec-1e3668f0-b30d-4e88-833e-12ef182dcd74.png`
- Implementation capture: `C:\Users\seque\Documents\XPENG\xpeng-local-insights\analytical-workspace-implementation.png`
- Side-by-side evidence: `C:\Users\seque\Documents\XPENG\xpeng-local-insights\design-qa-analytical-workspace.png`
- Viewport: 1600 × 1000 CSS px, device scale factor 1
- Source pixels: 1487 × 1058; normalized to 1600 × 1000 for the comparison board
- Implementation pixels: 1600 × 1000
- State: dark theme, Advanced mode, Journeys, first journey with GPS, Overview tab

## Findings

No actionable P0, P1 or P2 differences remain.

- Fonts and typography: the existing XPENG Analytics type system is retained. Heading scale, dense UI copy, tab hierarchy and four primary figures match the reference hierarchy without introducing a new font dependency.
- Spacing and layout rhythm: the persistent record column, compact journey rows, four-column metric strip, tab row, dominant map and stacked charts follow the selected Analytical Workspace composition. Existing period, classification, search and export controls remain above the workspace as intentional product controls.
- Colors and visual tokens: dark surfaces, quiet separators, mint active states and restrained cyan/amber/violet semantic accents match the selected direction and continue to use the app's established tokens. Light mode uses the same hierarchy through the existing token system.
- Image quality and asset fidelity: the product logo and real OpenStreetMap tiles remain native assets. The reference's stylized dark map was not substituted for the working map because the implementation must preserve the real interactive route, controls and attribution.
- Copy and content: the reference hierarchy is preserved with real application labels, localized copy and imported journey values.
- Interaction states: Overview, Energy, Driving, Battery and Technical each become selected and expose content. Simple mode reuses the same workspace with only the essential Overview content. The metadata drawer opens independently.
- Responsiveness: the layout has explicit 1180, 900 and 560 px adaptations. Record list and analysis stack vertically below 900 px, while metric and context strips reduce from four to two and then one column.

## Comparison history

1. Initial capture was blocked by the first-use tutorial overlay. The QA flow now dismisses the tutorial before capture.
2. The journey classification and notes occupied two large blocks above the workspace. They were consolidated into one collapsed `Journey details` drawer.
3. The journey-list unit rendered as `$km` after the structural refactor. The JSX text boundary was corrected and the production build rerun.
4. Final capture shows the selected record column, primary metric strip, tabs and route workspace without horizontal overflow (`bodyWidth === viewport === 1600`).

## Focused-region evidence

A separate crop was not required: the 1600 × 1000 implementation capture and the normalized side-by-side board keep the navigation, list rows, metric strip, tabs, map controls and typography readable in one view.

## Implementation checklist

- [x] Preserve all existing imported-data calculations.
- [x] Add shared analytical-workspace structure.
- [x] Reuse the structure in Simple and Advanced journey modes.
- [x] Group advanced detail into Overview, Energy, Driving, Battery and Technical.
- [x] Keep GPS chart-to-map synchronization.
- [x] Keep real filters, export and manual journey grouping.
- [x] Verify desktop overflow and responsive breakpoints.
- [x] Run production build and complete automated test suite.

## Follow-up polish

- P3: a future map-style provider could offer a darker basemap closer to the concept, but only if its usage terms and privacy behavior fit the project.

## Beta 7 Simple-mode review

- Viewport: 1440 × 760 CSS px, device scale factor 1.
- Data: representative owner `.xpeng` history covering journeys, GPS and
  charging sessions.
- Theme: light default, with the existing dark preference retained.
- Screens reviewed: Home, Journeys, Charging, Highlights and Replay.

### Verified outcomes

- The five Home metrics remain readable above one combined distance/energy
  chart; the separate introductory block no longer consumes vertical space.
- Simple navigation exposes Home, Journeys, Charging, Battery, Highlights and
  Replay, while the three utility controls remain inside the 760 px viewport.
- Journey SOC rendered as `25% → 22%` in the representative test and the
  no-GPS state no longer creates an empty map card.
- Charging history uses the translated title, exposes All/AC/DC filters and
  presents charging-curve and battery-temperature panels side by side.
- Removed map instruction copy does not leave a spacing gap in the toolbar.
- No horizontal overflow or overlapping controls were observed in the tested
  desktop viewport.

final result: passed

## Beta 8 GPS journey composition

- Viewport: 1600 × 1000 CSS px, device scale factor 1.
- State: light theme, Simple mode, Journeys, representative GPS route.
- Visible journeys: 44; every visible record carried a GPS match.
- Desktop columns: approximately 461 px for the map and 510 px for charts.

The map and chart columns share the same top alignment. Speed and power remain
stacked on the right, while elevation is contained beneath the map on the
left. The layout has no horizontal page overflow and collapses to one column
below 1180 px. Elevation distance labels were shortened to one decimal place
after the first capture exposed raw floating-point values.

final result: passed
