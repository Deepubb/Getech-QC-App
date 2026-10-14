# Getech QC Web

Installable web app (PWA) for QC buyoff work on iPhone and Android. It has two separate parts:

- **QC checklists**: OK / NOK / N/A results and remarks per item, exported as an Excel report in the GeTech buyoff layout.
- **Photo evidence**: take as many photos as you need, name them, and export them as a zip (split automatically above a size limit, 90 MB by default, so each part fits WhatsApp).

There is no login and no server. Everything is stored in the browser (IndexedDB) on the phone until it is exported.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build on http://localhost:4173
```

The camera, install to home screen, offline mode and file sharing only work over HTTPS (or on `localhost`).

## Deploy to Cloudflare Pages

1. This repository is ready to connect as is.
2. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repository.
3. Build settings:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `20` or later
4. Deploy. Cloudflare gives you an address like `https://<project>.pages.dev`. Every push to the main branch publishes a new version; other branches get preview addresses.

`public/_headers` stops the service worker from being cached, so phones pick up new versions. Phones show an **Update** prompt when a new version is ready.

## Install on a phone

- **iPhone:** open the link in Safari → Share → Add to Home Screen. Install before you start work: on iPhone, data saved in a Safari tab is kept apart from the installed app.
- **Android:** open the link in Chrome → menu → Install app.

## Where things are

```text
src/
├── app/          App shell, routes, first-run and install gates
├── core/         Types, naming rules, checklist rules, Excel import (pure, unit-tested)
├── data/         IndexedDB access (db.ts) and the app store (store.ts)
├── camera/       Photo resize, time stamp, EXIF removal
├── reports/      Excel report in the GeTech buyoff layout (ExcelJS, loaded on demand)
├── export/       Evidence zip builder, split planning, share and download
├── components/   Shared UI (app bar, sheets, toasts, thumbnails, capture buttons)
└── screens/      One file per screen
```

The Excel import reads the same two-sheet workbook as the native app (sheets **Checklist** and **MachineInfo**). Photo file names in that workbook can be saved as a shot list for photo evidence; they do not change the checklist.
