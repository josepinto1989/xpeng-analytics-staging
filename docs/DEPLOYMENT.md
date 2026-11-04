# GitHub Pages deployment

The site is built and deployed by `.github/workflows/pages.yml` whenever the
`main` branch changes. The workflow audits the public tree, runs the Python and
browser tests, builds the static application, and deploys only `web/dist`.

## One-time repository setting

In **Settings → Pages → Build and deployment**, select **GitHub Actions** as
the source. A successful workflow publishes the project at:

`https://josepinto1989.github.io/xpeng-analytics/`

The Vite build uses relative asset paths, so the application and its Web Worker
remain functional below the repository subpath.

No backend or hosted database is part of this deployment. Optional Google
Drive backup communicates directly between the browser and Google's APIs after
user authorisation. Optional aggregate visit and performance analytics can be
enabled separately as described below; vehicle data is never included.

## Google Drive build configuration

Create an Actions repository variable named `GOOGLE_CLIENT_ID`. The Pages
workflow exposes it only as the public `VITE_GOOGLE_CLIENT_ID` build value. The
OAuth client must list `https://josepinto1989.github.io` as an authorised
JavaScript origin and the Drive API and consent screen must be enabled. See
[`GOOGLE_DRIVE_SETUP.md`](GOOGLE_DRIVE_SETUP.md). Never add a client secret.

## Optional aggregate usage analytics

Create an Actions repository variable named
`CLOUDFLARE_WEB_ANALYTICS_TOKEN`. The Pages workflow exposes it only as the
public `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN` build value. Leaving it unset
disables both the consent prompt and the analytics beacon.

Create the site in Cloudflare Web Analytics for the production GitHub Pages
hostname, then copy its public site token to **Settings → Secrets and
variables → Actions → Variables**. The application loads the Cloudflare beacon
only after the visitor explicitly allows aggregate visit and performance
statistics. No imported or calculated vehicle data is attached to the beacon.
