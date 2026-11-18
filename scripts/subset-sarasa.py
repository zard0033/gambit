"""Re-cut the self-hosted Sarasa UI TC subsets so every non-ASCII character the app uses is covered.

Why: the original 2026-06 subset held only 759 Han characters and missed ~44 that the UI
templates use (首頁／繼續／投降／棋譜…), so those glyphs silently fell back to a system font.

Character set = everything already in the shipped subset ∪ every non-ASCII character in
src/**/*.{vue,ts} and index.html (comments included — cheaper than parsing them out, and the
set only grows). The covered set is written to scripts/sarasa-ui-tc.chars.txt;
tests/smoke/font-coverage.test.ts reads it and fails when new copy adds a character the
subset lacks — rerun this script then.

The font URLs in src/assets/fonts.css get a ?v=<content hash> suffix on every run. The service
worker caches /fonts/ CacheFirst for a year and Workbox never clears runtime caches on update,
so without a new URL every device that already visited would keep the old subset.

Usage (needs `pip install fonttools brotli`; source TTFs are the official Sarasa release):
    python scripts/subset-sarasa.py <dir containing SarasaUiTC-Regular.ttf and SarasaUiTC-Bold.ttf>
On Windows with Sarasa installed per-user:
    python scripts/subset-sarasa.py C:/Users/<you>/AppData/Local/Microsoft/Windows/Fonts
"""

import hashlib
import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parent.parent
FONTS = REPO / "public" / "fonts"
FONTS_CSS = REPO / "src" / "assets" / "fonts.css"
WEIGHTS = {"400": "SarasaUiTC-Regular.ttf", "700": "SarasaUiTC-Bold.ttf"}
MANIFEST = REPO / "scripts" / "sarasa-ui-tc.chars.txt"


def app_chars() -> set[str]:
    files = [*REPO.joinpath("src").rglob("*.vue"), *REPO.joinpath("src").rglob("*.ts"), REPO / "index.html"]
    return {ch for f in files for ch in f.read_text(encoding="utf-8") if ord(ch) > 0x7F}


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src_dir = pathlib.Path(sys.argv[1])
    wanted = {ord(ch) for ch in app_chars()}
    covered: set[int] | None = None
    css = FONTS_CSS.read_text(encoding="utf-8")
    for weight, ttf in WEIGHTS.items():
        source = src_dir / ttf
        if not source.is_file():
            sys.exit(f"missing source font: {source}")
        out = FONTS / f"sarasa-ui-tc-{weight}.woff2"
        shipped = set(TTFont(out).getBestCmap()) if out.exists() else set()
        source_cmap = set(TTFont(source).getBestCmap())
        absent = sorted(wanted - source_cmap)
        if absent:
            print(f"{ttf}: not in source font, left to fallback: {''.join(chr(u) for u in absent)}")
        unicodes = (shipped | wanted | set(range(0x20, 0x7F))) & source_cmap
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        font = subset.load_font(str(source), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=sorted(unicodes))
        subsetter.subset(font)
        subset.save_font(font, str(out), options)
        covered = unicodes if covered is None else covered & unicodes
        digest = hashlib.sha256(out.read_bytes()).hexdigest()[:8]
        css, n = re.subn(rf"/fonts/{re.escape(out.name)}(\?v=[0-9a-f]+)?", f"/fonts/{out.name}?v={digest}", css)
        if n != 1:
            sys.exit(f"expected exactly one url for {out.name} in {FONTS_CSS}, found {n}")
        han = sum(1 for u in unicodes if 0x4E00 <= u <= 0x9FFF)
        print(f"{out.name}: {len(unicodes)} code points, {han} Han, {out.stat().st_size // 1024} KB, v={digest}")
    FONTS_CSS.write_text(css, encoding="utf-8")
    MANIFEST.write_text("".join(chr(u) for u in sorted(covered or set()) if u > 0x7F) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
