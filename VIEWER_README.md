# Snapchat Memories — Private Local Viewer

A fully local viewer for your exported Snapchat memories. **Your photos, videos, and
data never leave this computer.** There is no server and nothing is uploaded. The only
time the internet is touched is to download map background tiles while you use the Map
view (only the map's viewport coordinates are sent — never your media or personal data).
Everything else works with the internet disconnected.

## How to open it

Double-click **`Memories Viewer.html`** (in this folder). It opens `viewer/index.html`
in your default browser. No installation, no setup.

## What you can do

- **Gallery** — scroll all 10,709 memories as thumbnails. Sort by date; filter by type
  (photo/video), year, place, date range, "has caption", "has location". Click any item
  to open it full-size (videos play; Snapchat captions are composited on top).
- **Map** — every geotagged memory as clustered pins over a world map, with a Heatmap
  toggle. Click a pin to preview and open it.
- **Stats** — totals, photos vs videos, 10-year span, places/countries visited, busiest
  day, and charts by year / month / weekday / hour, plus a per-year activity calendar.
- **On This Day** — memories taken on today's calendar date across all years.
- **Trips** — automatically detected travel away from home, with date ranges, counts,
  "View photos", and a "Show route" mini-map per trip.
- **Slideshow** — full-screen auto-advancing playback of whatever the current filters
  show (photos hold a few seconds; videos play through; captions composited).

## Deleting memories

You can remove memories you don't want — and they're **moved to a `Deleted Memories`
folder, not permanently deleted**, so you can always get them back.

1. In the viewer, open a memory (click it) and click **Delete** (click again to confirm).
   It disappears from every view immediately. A new **Deleted** tab collects everything you've
   removed — open it and click **Restore** on anything you change your mind about.
2. When you're ready to actually move the files on disk, open the **Deleted** tab and click
   **Export deletion list** (this saves a small `snapmemories-deletions.json` to your Downloads).
3. Double-click **`Apply Deletions.cmd`**. It moves those memories' files into the
   `Deleted Memories/` folder and updates the viewer so they're gone for good from the gallery.

*Why two steps?* A web page opened by double-clicking (`file://`) isn't allowed to move files on
your disk for security reasons — so the little `Apply Deletions` helper does the actual move.

**To restore a memory after it's been moved:** move its files from `Deleted Memories/memories`
back into `memories/`, then re-run `python build.py`.

## Re-running the build

If you ever add more exported memories, re-run:

```
python build.py
```

It is resumable — existing thumbnails are skipped, so re-runs are fast. It rebuilds
`viewer/data.js` and `viewer/geocache.json`. Requirements (already installed): Python
with `reverse_geocoder`, `pycountry`, `Pillow`, and `ffmpeg`/`ffprobe` on PATH.

## What the build produces

- `thumbs/` — small thumbnails used by the gallery/map (the originals in `memories/`
  are only loaded when you open an item full-size).
- `viewer/data.js` — the metadata manifest (date, type, location, place names) matched
  to each file. Generated locally; do not share it.
- `viewer/geocache.json` — cached offline reverse-geocoding results (coordinates → city/
  country), so re-runs don't repeat the lookup.

Place names come from an **offline** dataset (`reverse_geocoder`) bundled with the
library — your coordinates are never sent anywhere.
