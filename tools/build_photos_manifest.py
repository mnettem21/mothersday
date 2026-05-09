#!/usr/bin/env python3
"""
Build photos.json: scan ./amma (or PHOTOS_SOURCE) for images, sort by capture time
(EXIF, then mtime), write manifest with URLs like amma/<filename> for the timeline.
Optional MEDIA_URL_PREFIX overrides the path prefix (default: amma).
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image

# EXIF tag ids (no dependency on Pillow enum stability for these)
TAG_DATETIME = 306
TAG_DATETIME_ORIGINAL = 36867
TAG_OFFSET_TIME_ORIGINAL = 36881

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".HEIC", ".JPG", ".JPEG", ".PNG"}

# Filenames never shown on timeline (decorative assets kept alongside photos).
SKIP_FILENAMES = frozenset({"kiss.png"})

# Manual timeline date overrides for specific photos.
# Use this for known memories where EXIF/mtime is wrong or missing.
DATE_OVERRIDES = {
    "Asset0026 (5).jpeg": datetime(2022, 5, 6, 12, 0, 0),
    "IMG_0276.jpeg": datetime(2007, 6, 22, 12, 0, 0),
    # User-confirmed old photos that imported with modern mtime.
    "CA7F59B0-5C93-4510-BD33-5A1E2A56FAE7.jpg": datetime(2004, 5, 2, 11, 31, 0),
    "IMG_1222.JPG": datetime(2004, 5, 2, 12, 0, 0),
    "IMG_9454.PNG": datetime(2023, 8, 13, 12, 0, 0),
    "IMG_4201.JPG": datetime(2018, 2, 26, 12, 0, 0),
    "ed7354e3-b834-4d0a-abac-f2e3e9f36a97.jpg": datetime(2023, 7, 21, 12, 0, 0),
}


def parse_exif_datetime(s: str) -> datetime | None:
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def taken_at_from_image(path: Path) -> datetime:
    try:
        with Image.open(path) as img:
            exif = img.getexif()
            if exif:
                raw = exif.get(TAG_DATETIME_ORIGINAL) or exif.get(TAG_DATETIME)
                dt = parse_exif_datetime(raw) if raw else None
                if dt:
                    return dt
    except OSError:
        pass
    stat = path.stat()
    return datetime.fromtimestamp(stat.st_mtime)


def format_caption(dt: datetime) -> str:
    return dt.strftime("%B %-d, %Y") if sys.platform != "win32" else dt.strftime("%B %d, %Y")


def main() -> int:
    out_dir = Path(__file__).resolve().parent.parent
    default_src = out_dir / "amma"
    src = Path(os.environ.get("PHOTOS_SOURCE", str(default_src))).resolve()
    manifest_path = out_dir / "photos.json"
    url_prefix = os.environ.get("MEDIA_URL_PREFIX", "amma")

    if not src.is_dir():
        print(f"Source folder not found: {src}", file=sys.stderr)
        print("Add a ./amma folder or set PHOTOS_SOURCE to your images directory.", file=sys.stderr)
        return 1

    entries: list[tuple[datetime, dict]] = []
    for f in sorted(src.rglob("*")):
        if not f.is_file() or f.suffix not in IMAGE_SUFFIXES:
            continue
        if f.name.lower() in SKIP_FILENAMES:
            continue
        dt = DATE_OVERRIDES.get(f.name) or taken_at_from_image(f)
        rel = f"{url_prefix.rstrip('/')}/{f.relative_to(src).as_posix()}"
        entries.append(
            (
                dt,
                {
                    "image": rel,
                    "taken": dt.isoformat(),
                    "caption": format_caption(dt),
                },
            )
        )

    entries.sort(key=lambda x: x[0])
    data = [e[1] for e in entries]

    manifest_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(data)} entries to {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
