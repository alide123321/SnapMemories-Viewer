#!/usr/bin/env python3
"""Build a private, local viewer dataset from a Snapchat 'Download My Data' export.

Pipeline:
  1. Parse json/memories_history.json  (Date, Media Type, Location)
  2. Scan memories/  -> pair each *-main.* file with its *-overlay.png (shared prefix)
  3. Match metadata -> files by (date, media type) ordering
  4. Reverse-geocode unique coordinates locally (offline) -> city + country
  5. Generate ~400px thumbnails (Pillow for images, ffmpeg for video) + durations
  6. Emit viewer/data.js (window.MEMORIES = [...]) and viewer/geocache.json

Re-runnable and resumable: existing thumbnails are skipped. Everything runs
locally; no network access is used at any point.
"""
import os, sys, re, json, subprocess, collections, datetime
from concurrent.futures import ProcessPoolExecutor, as_completed

ROOT     = os.path.dirname(os.path.abspath(__file__))
MEM_DIR  = os.path.join(ROOT, "memories")
JSON_IN  = os.path.join(ROOT, "json", "memories_history.json")
VIEWER   = os.path.join(ROOT, "viewer")
THUMBS   = os.path.join(ROOT, "thumbs")
DATA_JS  = os.path.join(VIEWER, "data.js")
GEOCACHE = os.path.join(VIEWER, "geocache.json")

THUMB_PX   = 400          # longest edge of generated thumbnails
JPEG_Q     = 80
LOC_RE     = re.compile(r"(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)")


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------
# 1 + 2 : parse metadata, scan files
# --------------------------------------------------------------------------
def parse_date(s):
    """'2026-06-22 05:05:00 UTC' -> (iso 'Z' string, 'YYYY-MM-DD')."""
    dt = datetime.datetime.strptime(s.replace(" UTC", ""), "%Y-%m-%d %H:%M:%S")
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ"), dt.strftime("%Y-%m-%d")


def parse_loc(s):
    """-> (lat, lng) floats, or None when missing / 0,0 placeholder."""
    m = LOC_RE.search(s or "")
    if not m:
        return None
    la, lo = float(m.group(1)), float(m.group(2))
    if la == 0.0 and lo == 0.0:
        return None
    return la, lo


def load_metadata():
    with open(JSON_IN, encoding="utf-8") as f:
        records = json.load(f)["Saved Media"]
    out = []
    for r in records:
        iso, day = parse_date(r["Date"])
        typ = "V" if r.get("Media Type") == "Video" else "I"
        out.append({"iso": iso, "day": day, "type": typ, "loc": parse_loc(r.get("Location", ""))})
    return out


def scan_files():
    """Return dict: key 'YYYY-MM-DD_UUID' -> {day, type, main, overlay}."""
    items = {}
    for name in os.listdir(MEM_DIR):
        if name.endswith("-main.jpg"):
            key, typ = name[:-9], "I"
        elif name.endswith("-main.mp4"):
            key, typ = name[:-9], "V"
        elif name.endswith("-overlay.png"):
            items.setdefault(name[:-12], {}).setdefault("overlay", name)
            continue
        else:
            continue
        e = items.setdefault(key, {})
        e["main"], e["type"], e["day"] = name, typ, name[:10]
    # keep only entries that actually have a main file
    return {k: v for k, v in items.items() if v.get("main")}


# --------------------------------------------------------------------------
# 3 : match metadata records to files, grouped by (day, type)
# --------------------------------------------------------------------------
def match(meta, files):
    meta_by = collections.defaultdict(list)
    for m in meta:
        meta_by[(m["day"], m["type"])].append(m)

    file_by = collections.defaultdict(list)
    for key, v in files.items():
        file_by[(v["day"], v["type"])].append(key)
    for k in file_by:
        file_by[k].sort()  # deterministic order within a day

    matched = unmatched_files = surplus_meta = 0
    out = []
    for (day, typ), keys in file_by.items():
        recs = meta_by.get((day, typ), [])
        for i, key in enumerate(keys):
            v = files[key]
            rec = recs[i] if i < len(recs) else None
            if rec:
                matched += 1
                iso, loc = rec["iso"], rec["loc"]
            else:
                unmatched_files += 1
                iso, loc = day + "T12:00:00Z", None  # fallback to filename date
            out.append({"key": key, "type": typ, "iso": iso, "loc": loc,
                        "overlay": bool(v.get("overlay")),
                        "main": v["main"], "ov_name": v.get("overlay")})
        surplus_meta += max(0, len(recs) - len(keys))

    log(f"  matched={matched}  files-without-metadata={unmatched_files}  "
        f"surplus-metadata-records={surplus_meta}")
    out.sort(key=lambda r: r["iso"], reverse=True)
    return out


# --------------------------------------------------------------------------
# 4 : offline reverse geocoding of unique coordinates
# --------------------------------------------------------------------------
def coord_key(la, lo):
    return f"{round(la, 4)},{round(lo, 4)}"


def geocode(items):
    """Fill place/country for every located item using a local cities dataset."""
    try:
        cache = json.load(open(GEOCACHE, encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}

    located = [it for it in items if it["loc"]]
    need = {}
    for it in located:
        k = coord_key(*it["loc"])
        if k not in cache:
            need[k] = it["loc"]

    if need:
        log(f"  reverse-geocoding {len(need)} new unique coordinates (offline)...")
        import reverse_geocoder as rg
        import pycountry
        keys = list(need)
        coords = [need[k] for k in keys]
        os.makedirs(VIEWER, exist_ok=True)
        results = rg.search(coords, mode=1)  # mode=1: single-threaded (no nested procs)
        for k, res in zip(keys, results):
            cc = res.get("cc", "")
            try:
                country = pycountry.countries.get(alpha_2=cc).name if cc else ""
            except Exception:
                country = cc
            city = res.get("name", "")
            admin1 = res.get("admin1", "")
            place = ", ".join(p for p in (city, admin1) if p) or country
            cache[k] = {"place": place, "country": country}
        json.dump(cache, open(GEOCACHE, "w", encoding="utf-8"), ensure_ascii=False)
        log(f"  geocache now holds {len(cache)} coordinates")
    else:
        log("  geocache up to date, nothing new to look up")

    for it in items:
        if it["loc"]:
            g = cache.get(coord_key(*it["loc"]), {})
            it["place"], it["country"] = g.get("place", ""), g.get("country", "")
        else:
            it["place"], it["country"] = "", ""


# --------------------------------------------------------------------------
# 5 : thumbnails + video durations (parallel, resumable)
# --------------------------------------------------------------------------
def make_image_thumb(src, dst):
    from PIL import Image, ImageOps
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((THUMB_PX, THUMB_PX))
        im.save(dst, "JPEG", quality=JPEG_Q)


def video_duration(src):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", src],
            capture_output=True, text=True, timeout=60)
        return round(float(out.stdout.strip()), 1)
    except Exception:
        return None


def make_video_thumb(src, dst):
    # try a frame at 0.5s, fall back to the very first frame for short clips
    for ss in ("0.5", "0"):
        r = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-ss", ss, "-i", src,
             "-frames:v", "1", "-vf", f"scale='min({THUMB_PX},iw)':-2", dst],
            capture_output=True, timeout=120)
        if r.returncode == 0 and os.path.exists(dst) and os.path.getsize(dst) > 0:
            return True
    return False


def thumb_worker(task):
    """task = (key, type, main_filename). Returns (key, duration_or_None, ok)."""
    key, typ, main = task
    src = os.path.join(MEM_DIR, main)
    dst = os.path.join(THUMBS, key + ".jpg")
    dur = video_duration(src) if typ == "V" else None
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return key, dur, True               # resume: thumbnail already present
    try:
        if typ == "I":
            make_image_thumb(src, dst)
            ok = True
        else:
            ok = make_video_thumb(src, dst)
    except Exception:
        ok = False
    return key, dur, ok


def build_thumbnails(items):
    os.makedirs(THUMBS, exist_ok=True)
    tasks = [(it["key"], it["type"], it["main"]) for it in items]
    durations, failed, done = {}, [], 0
    workers = max(2, (os.cpu_count() or 4))
    log(f"  generating thumbnails with {workers} workers ({len(tasks)} items)...")
    with ProcessPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(thumb_worker, t) for t in tasks]
        for fut in as_completed(futs):
            key, dur, ok = fut.result()
            if dur is not None:
                durations[key] = dur
            if not ok:
                failed.append(key)
            done += 1
            if done % 500 == 0:
                log(f"    {done}/{len(tasks)} processed")
    log(f"  thumbnails done: {len(tasks) - len(failed)} ok, {len(failed)} failed")
    if failed:
        log(f"    first failures: {failed[:5]}")
    return durations, set(failed)


# --------------------------------------------------------------------------
# 6 : emit viewer/data.js
# --------------------------------------------------------------------------
def emit(items, durations, failed):
    records = []
    for it in items:
        r = {"i": it["key"], "t": it["type"], "d": it["iso"],
             "o": 1 if it["overlay"] else 0,
             "th": 0 if it["key"] in failed else 1}
        if it["loc"]:
            r["la"], r["lo"] = round(it["loc"][0], 6), round(it["loc"][1], 6)
            if it["place"]:
                r["p"] = it["place"]
            if it["country"]:
                r["c"] = it["country"]
        if it["type"] == "V" and durations.get(it["key"]) is not None:
            r["dv"] = durations[it["key"]]
        records.append(r)

    os.makedirs(VIEWER, exist_ok=True)
    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by build.py. Local data only; do not share.\n")
        f.write("window.MEMORIES = ")
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    size_mb = os.path.getsize(DATA_JS) / 1e6
    located = sum(1 for r in records if "la" in r)
    log(f"  wrote {DATA_JS}  ({len(records)} records, {located} located, {size_mb:.1f} MB)")


# --------------------------------------------------------------------------
def main():
    if not os.path.isfile(JSON_IN):
        sys.exit(f"metadata not found: {JSON_IN}")
    os.makedirs(VIEWER, exist_ok=True)
    os.makedirs(THUMBS, exist_ok=True)
    log("[1/5] parsing metadata + scanning files...")
    meta  = load_metadata()
    files = scan_files()
    log(f"  metadata records={len(meta)}  main files={len(files)}")

    log("[2/5] matching metadata to files...")
    items = match(meta, files)

    log("[3/5] reverse geocoding...")
    geocode(items)

    log("[4/5] building thumbnails...")
    durations, failed = build_thumbnails(items)

    log("[5/5] emitting data.js...")
    emit(items, durations, failed)
    log("done.")


if __name__ == "__main__":
    main()
