# Getech QC Web

Installable web app (PWA) for QC buyoff photo evidence on iPhone and Android.

1. On a PC, open the app, go to **Settings** and **publish** the team master Excel. Each sheet is one machine, named after the sheet. Every phone picks up the new list when the app opens.
2. Start photo evidence for a machine and type its machine number (e.g. `SSDLV133`).
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

## Deploy to Cloudflare (Workers)

The app is a Cloudflare Worker: `worker/index.ts` serves the built app from `dist/` and the team master list at `/api/master`. `wrangler.jsonc` holds the settings.

1. In Cloudflare, go to **Workers & Pages → Create → Import a repository** and pick this repository.
2. Build settings:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
3. The Worker name in Cloudflare must match `name` in `wrangler.jsonc` (`getech-qc-app`).
4. Every push to the main branch deploys a new version.

### Team master list (one-time)

The KV storage bound as `MASTER` is created by Cloudflare on the first deploy; nothing else is needed.

Anyone using the app can read and publish the list. The Excel is read on the publisher's device; only machine, folder and photo names are sent. The previous list is kept in KV under `master:previous`.

To try it locally: `npm run build`, then `npx wrangler dev`.

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
worker/
├── index.ts      Cloudflare Worker: serves the app and /api/master
└── master.ts     Team master list (KV storage)
```

## Master Excel

| Function Verification | Machine Verification | ESD Measurement |
|---|---|---|
| Arm reached limit_Loader | CCTV | ESD > Drive Drop Pad |
| Vision Master > ET_Inspection_{fixture}_ResultOK | EPSON > Loader Robot Specification | Ground > EPSON_Loader |

- The sheet name is the machine name (for example `SSDLV`).
- Row 1 holds the main folders. Every cell below a heading is one photo for that folder.
- `A > B` puts photo `B` in subfolder `A`. Without `>`, the cell is the photo name.
- `{fixture}` is a fixture's FT number. After taking such a photo the app asks for its FT number; one name can have photos for many fixtures (`Gripper_FT01.jpg`, `Gripper_FT02.jpg`).

The zip for the table above, for machine `SSDLV133` and fixture `FT07`, is `SSDLV133.zip`:

```text
Function Verification/Arm reached limit_Loader.jpg
Function Verification/Vision Master/ET_Inspection_FT07_ResultOK.jpg
Machine Verification/CCTV.jpg
Machine Verification/EPSON/Loader Robot Specification.jpg
ESD Measurement/ESD/Drive Drop Pad.jpg
ESD Measurement/Ground/EPSON_Loader.jpg
```

Publishing again replaces the team list; a machine missing from the file is removed for everyone. Photo evidence already started keeps its names until someone taps **Apply new names** on that machine: new names are added, removed names without photos disappear, and photos are never deleted.
