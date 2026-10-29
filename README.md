# Electronic Components Inventory — Demo

[![Live demo](https://img.shields.io/badge/Live_demo-demo--components--inventory-1D6B42?logo=netlify&logoColor=white)](https://demo-components-inventory.netlify.app)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![React Router](https://img.shields.io/badge/React_Router-8-CA4245?logo=reactrouter&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.15-5FA04E?logo=nodedotjs&logoColor=white)
![Tests](https://img.shields.io/badge/tests-node%3Atest-339933?logo=nodedotjs&logoColor=white)
![Netlify](https://img.shields.io/badge/hosted_on-Netlify-00C7B7?logo=netlify&logoColor=white)

A parts inventory for an electronics lab: scan the labels on parts bags and reels, sort parts into folders, keep
reorder lists you can export to Excel, and build boards from a PCB's BOM so stock goes down by exactly what was used.

**This repository is a browser-only demo.** All data is invented sample data. There is no server, database or login:
everything you change is saved in your own browser (`localStorage`), and **Reset demo** in the banner brings the
sample data back.

<!-- TODO: screenshots -->

## Features

- **Inventory**: folder tree, list or gallery view, live search by part number, maker, description or location.
- **Part page**: edit quantity, location, description and folder; delete a part.
- **Scan**: camera scanning of DigiKey, Mouser and LCSC labels (the label is parsed in the browser), or type a part
  number. A part already in stock gets a restock prompt instead of a duplicate. New parts go to a review step first.
- **Reorder lists**: collect parts to order, with distributor search links; download as a real `.xlsx` file.
- **Projects**: import a BOM exported from Altium (`.xlsx` or `.csv`, click or drop), match it to stock, then build
  N boards with a machine-loss %. You get a warning when stock covers fewer boards, a flag for parts not in stock, undo
  for the latest build, and a one-click "shortages → reorder list". A sample BOM is linked from the Projects panel.
- **Export**: download your inventory as JSON.

## Tech stack

- React 19, React Router, Vite, TypeScript.
- No libraries for the file formats: the `.xlsx` writer, the zip/xlsx/CSV BOM reader and the label parser are small
  hand-written modules. The only other library is `@zxing/library` for camera barcode decoding.
- Strict Content Security Policy (no inline scripts or styles); stored links (datasheets, images) are https-only.
- Tests: `node:test`, which runs the TypeScript modules directly.

## Run locally

Requires Node ≥ 20.15. The test suite imports `.ts` files directly, so `npm test` needs Node ≥ 22.18.

```sh
npm install
npm run dev        # http://localhost:5173
npm test
npm run typecheck
```

Camera scanning needs HTTPS or `localhost`.

## Deploy your own copy

It's a static site with no environment variables. On Netlify's free plan, connect the repository: `netlify.toml`
already sets the build command (`npm run build`) and the publish folder (`dist`). The security headers and the
single-page-app fallback live in `web/public/_headers` and `web/public/_redirects`, which are Netlify formats. On
another host, set up the same headers and a fallback that serves `index.html` for every route.

## The production version

The real app adds a server, a Postgres database, login, and distributor lookups that fill in part details and photos
automatically. It is not part of this repository.

## Going further: connect a real backend

This demo has no server on purpose. To get the full version (data shared across devices, login, part details filled
in automatically), add a small backend. The screens never talk to storage directly: everything goes through one
object, `api` in `web/src/api/client.ts`. Keep its method names and return shapes (`web/src/api/types.ts`), and swap
each store call for a `fetch` to your server. `web/src/demo/store.ts` is the reference for every endpoint: the
validation, the error messages, and the merge, match and build rules.

1. **Database.** Any Postgres works; Neon and Supabase have free tiers. The tables mirror `DemoData` in
   `web/src/demo/seed.ts`: folders, parts, reorder lists and their items, projects and their lines, builds and their
   items. Let the database enforce what the store checks in code. That means a unique (part number, manufacturer)
   pair among saved parts and a `qty >= 0` check. A build then runs as one transaction: all parts or none.
2. **Server.** Serverless functions on the same host as the site (for example Netlify Functions, free tier). The
   app stays on one origin, so the strict CSP (`connect-src 'self'`) keeps working. Add login with a hashed password,
   an HttpOnly session cookie, and a custom header on every POST against CSRF.
3. **Distributor lookups.** After a scan, the server looks the part up and fills in the draft (manufacturer,
   description, specs, datasheet, photo) before the review step:
   - **DigiKey:** register an app at [developer.digikey.com](https://developer.digikey.com) and use the Product
     Information API (v4) with the OAuth 2.0 client-credentials flow: client ID and secret → access token →
     keyword search by part number.
   - **Mouser:** request a free Search API key at [mouser.com/api-search](https://www.mouser.com/api-search/) and
     use its part-number search. It works well as a fallback when DigiKey has no match.
   - **LCSC** labels are parsed from the QR code only; there's no lookup.

   Keep what the label says over what the lookup returns for the distributor part number: the label names the
   packaging you actually bought.
4. **Add your keys.** `.env.example` lists every setting the backend needs, with placeholders:

   | Variable | What it is | Where to get it |
   |---|---|---|
   | `DATABASE_URL` | Postgres connection string | Your database provider's dashboard (Neon, Supabase, …) |
   | `LOGIN_PASSWORD_HASH` | Hash of the shared login password | Hash it yourself (scrypt or bcrypt); never store the plain password |
   | `DIGIKEY_CLIENT_ID`, `DIGIKEY_CLIENT_SECRET` | DigiKey API app credentials | [developer.digikey.com](https://developer.digikey.com) → create an app (production) |
   | `MOUSER_API_KEY` | Mouser Search API key | [mouser.com/api-search](https://www.mouser.com/api-search/) |

   For local development, copy `.env.example` to `.env` (git-ignored) and fill it in. For production, set the same
   names in the host's environment settings (Netlify: *Site configuration → Environment variables*). These keys are
   read by the server only: never prefix them with `VITE_`, because Vite bundles `VITE_*` values into the public
   JavaScript. The distributor keys are optional: without them, scans fall back to the label data, as in this demo.
5. **Photos.** Distributor images load from their own domains. Add `https:` to `img-src` in `web/public/_headers`
   and keep passing image URLs through `safeUrl`.

---

© 2026 Alessandro Frondini. All rights reserved.
