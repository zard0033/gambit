"""Re-cut the self-hosted Sarasa UI TC subsets so every CJK character the app uses is covered.

Why: the original 2026-06 subset held only 759 Han characters and missed ~44 that the UI
templates use (首頁／繼續／投降／棋譜…), so those glyphs silently fell back to a system font.

Character set = everything already in the shipped subset ∪ every non-ASCII character in
src/**/*.{vue,ts} and index.html. The covered set is also written to
scripts/sarasa-ui-tc.chars.txt; tests/smoke/font-coverage.test.ts reads it and fails when new
copy adds a character the subset lacks — rerun this script then.

Usage (needs `pip install fonttools brotli`; source TTFs are the official Sarasa release):
    python scripts/subset-sarasa.py <dir containing SarasaUiTC-Regular.ttf and SarasaUiTC-Bold.ttf>
On Windows with Sarasa installed per-user:
    python scripts/subset-sarasa.py C:/Users/<you>/AppData/Local/Microsoft/Windows/Fonts
"""

import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parent.parent
FONTS = REPO / "public" / "fonts"
WEIGHTS = {"400": "SarasaUiTC-Regular.ttf", "700": "SarasaUiTC-Bold.ttf"}
MANIFEST = REPO / "scripts" / "sarasa-ui-tc.chars.txt"


def app_chars() -> set[str]:
    files = [*REPO.joinpath("src").rglob("*.vue"), *REPO.joinpath("src").rglob("*.ts"), REPO / "index.html"]
    return {ch for f in files for ch in f.read_text(encoding="utf-8") if ord(ch) > 0x7F}


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src_dir = pathlib.Path(sys.argv[1])
    wanted = app_chars()
    covered: set[int] | None = None
    for weight, ttf in WEIGHTS.items():
        source = src_dir / ttf
        if not source.is_file():
            sys.exit(f"missing source font: {source}")
        out = FONTS / f"sarasa-ui-tc-{weight}.woff2"
        unicodes = set(TTFont(out).getBestCmap()) | {ord(ch) for ch in wanted} | set(range(0x20, 0x7F))
        source_cmap = TTFont(source).getBestCmap()
        unicodes &= set(source_cmap)
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
        han = sum(1 for u in unicodes if 0x4E00 <= u <= 0x9FFF)
        print(f"{out.name}: {len(unicodes)} code points, {han} Han, {out.stat().st_size // 1024} KB")
    MANIFEST.write_text("".join(chr(u) for u in sorted(covered or set()) if u > 0x7F) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
