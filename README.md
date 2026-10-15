# Getech QC Web

Installable web app (PWA) for QC buyoff photo evidence on iPhone and Android.

1. On a PC, open the app, go to **Settings** and **publish** the team master Excel with the team passcode. Each sheet is one machine, named after the sheet. Every phone picks up the new list when the app opens.
2. Start photo evidence for a machine and type its FT number.
3. Tap each photo name and take the photo; the app names it. Items can be marked not applicable, get extra photos (`_2`, `_3`) or be added on site.
4. Export one zip laid out like the sheet. It splits automatically above a size limit (90 MB by default) so each part fits WhatsApp.

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

### Team master list (one-time)

Publishing the master Excel uses a Pages Function (`functions/api/master.ts`) and Cloudflare KV storage:

1. **Storage & databases → KV → Create** a namespace, for example `getech-qc-master`.
2. In the Pages project: **Settings → Bindings → Add → KV namespace**. Variable name `MASTER`, namespace `getech-qc-master`.
3. **Settings → Variables and Secrets → Add**: type **Secret**, name `PUBLISH_PASSCODE`, value the team passcode (long, at least 10 characters).
4. **Deployments → latest → Retry deployment**, so the binding and secret take effect.

Anyone can read the list; only someone with the passcode can publish. The Excel is read on the publisher's device; only machine, folder and photo names are sent. The previous list is kept in KV under `master:previous`.

`public/_headers` stops the service worker from being cached, so phones pick up new versions. Phones show an **Update** prompt when a new version is ready.

## Install on a phone

- **iPhone:** open the link in Safari → Share → Add to Home Screen. Install before you start work: on iPhone, data saved in a Safari tab is kept apart from the installed app.
- **Android:** open the link in Chrome → menu → Install app.

## Where things are

```text
src/
├── app/          App shell, routes, first-run and install gates
├── core/         Types, master list reading, naming and zip paths (pure, unit-tested)
├── data/         IndexedDB access (db.ts), the app store (store.ts), team list fetch/publish (remote.ts)
├── camera/       Photo resize, time stamp, EXIF removal
├── export/       Evidence zip builder, split planning, share and download
├── components/   Shared UI (app bar, sheets, toasts, thumbnails, camera, machine lists)
└── screens/      One file per screen
functions/
└── api/master.ts Team master list on Cloudflare (Pages Function + KV)
```

## Master Excel

| Function Verification | Machine Verification | ESD Measurement |
|---|---|---|
| Arm reached limit_Loader | CCTV | ESD > Drive Drop Pad |
| Vision Master > ET_Inspection_{fixture}_ResultOK | EPSON > Loader Robot Specification | Ground > EPSON_Loader |

- The sheet name is the machine name (for example `SSDLV`).
- Row 1 holds the main folders. Every cell below a heading is one photo for that folder.
- `A > B` puts photo `B` in subfolder `A`. Without `>`, the cell is the photo name.
- `{fixture}` is filled with the FT number typed when the machine is started.

The zip for the table above, for FT number `FT1234`, is `SSDLV_FT1234.zip`:

```text
Function Verification/Arm reached limit_Loader.jpg
Function Verification/Vision Master/ET_Inspection_FT1234_ResultOK.jpg
Machine Verification/CCTV.jpg
Machine Verification/EPSON/Loader Robot Specification.jpg
ESD Measurement/ESD/Drive Drop Pad.jpg
ESD Measurement/Ground/EPSON_Loader.jpg
```

Publishing again replaces the team list; a machine missing from the file is removed for everyone. Photo evidence already started keeps its names until someone taps **Apply new names** on that machine: new names are added, removed names without photos disappear, and photos are never deleted.
