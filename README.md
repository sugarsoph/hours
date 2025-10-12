# My Hours Sat Down — Study Tracker

React + Vite frontend, Vercel serverless API, Supabase Postgres (service role ONLY in API).

## Quick start (deploy)

1. **Create a Supabase project.** In SQL editor, run:

```sql
create extension if not exists pgcrypto;

create table entries (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  label text not null,
  minutes int not null check (minutes >= 0),
  note text,
  created_at timestamptz default now()
);
create index on entries (day);

create table labels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color_hex text,
  created_at timestamptz default now()
);

create table sticky_note (
  id text primary key default 'main',
  content text,
  updated_at timestamptz default now()
);

insert into sticky_note (id, content) values ('main', '') on conflict (id) do nothing;
```

2. **On Vercel**, import this repo.
   - Set **Environment Variables**:
     - `SUPABASE_URL` — your Supabase project's URL
     - `SUPABASE_SERVICE_ROLE` — the Service Role key (keep private)
     - `APP_PASSCODE` — `Iamworkingtowardsmydreams`
   - Deploy.

3. **Bookmark the site.** On first load you'll see a passcode modal. Enter the passcode once; the app sets a 1‑year `session=ok` **HttpOnly** cookie with `Secure; SameSite=Lax; Path=/` so you won't be asked again for one year on that device/browser.

## Using the app

- **Top card:** Label (free‑type with autocomplete), Minutes (integer), Save.
- **Total today:** shows `X.XX h` and updates immediately after save/edit/delete.
- **Sticky note:** yellow notepad on the right. Placeholder “Note”. Auto‑saves on blur and while typing.
- **Recent entries:** two‑week list under inputs with edit/delete.
- **Label Manager:** click the 🏷️ button near the Label input.
  - Rename names, set colors via HEX, delete labels.
  - A pastel “wheel” helps you pick soft hues; you can also type a HEX (e.g. `#FFD7E2`).

## Charts

All charts update on any add/edit/delete:

- **𝓓𝓪𝓲𝓵𝔂:** last 7 days, 0–12 h y‑axis.
- **𝓜𝓸𝓷𝓽𝓱𝓵𝔂:** current month, dynamic y‑axis.
- **Task Breakdown:** current month by label (bars use each label’s color).
- **Yearly / Cumulative:** 12 bars, total hours per month of current year.

Tooltips and axes are formatted in **hours** to 2 decimals. Minutes are stored as integers in the DB.

## Security

- Frontend **never** talks to Supabase directly.
- All API routes check for the `session=ok` cookie, except `/api/login`.
- Service Role key is used only inside the serverless functions.

## Styling

- Title: `𝓜𝔂  𝓗𝓸𝓾𝓻𝓼  𝓢𝓪𝓽  𝓓𝓸𝔀𝓷` (cursive look).
- Pastel pink accents `#FFD7E2`; cards are rounded with soft shadows.
- Responsive: sticky note stacks under log card on small screens.
- Footer: “Let's see how you do it. ♡” centered.

## Dev

```bash
pnpm i   # or npm i / yarn
pnpm dev
```

Vercel will build the Vite app and deploy API functions from `/api/` automatically.
