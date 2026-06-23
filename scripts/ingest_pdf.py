#!/usr/bin/env python3
"""One-shot Dropfleet PDF ingestion — does the whole job from a Combined Fleet
Stats PDF:

  1. ART     extract the ship art (largest image on each ship page), cut out its
             background to transparent, and save it as assets/art/<slug>.webp.
  2. STATS   parse name / cost / class / tonnage / stat-line / weapons / launch
             loads / refits  (reuses the proven parser in pdf_to_json.py).
  3. RULES   collect the verbatim special-rule prose on the page, matched to the
             rule names in the stat line's Special cell.
  4. LORE    capture the lore paragraph + "Famous ships of the class:" line when
             the PDF carries them (official faction PDFs do; the Bioficer homebrew
             stats sheet does not — those fields come back empty, which is fine).

It writes a per-ship JSON (ready to merge into data/faction-<k>.json) plus a
report of: art written, NEW art slugs you must add to SHIP_ART in js/app.js,
rules whose description it couldn't find, and an optional validation pass.

Nothing is invented: stats/weapons are copied from the table; rule/lore text is
copied verbatim from the page. Treat RULES/LORE as draft to eyeball (same as the
existing "extract then verify" flow) — STATS/ART are reliable.

Usage:
  PYTHONUTF8=1 python scripts/ingest_pdf.py <pdf> --faction bioficer
  PYTHONUTF8=1 python scripts/ingest_pdf.py <pdf> --faction ucm --dry
  PYTHONUTF8=1 python scripts/ingest_pdf.py <pdf> --faction bioficer --validate data/faction-bioficer.json --no-art

Flags: --dry (write nothing), --no-art (skip image extraction), --out <json>,
       --art-dir assets/art, --validate <faction.json>, --thumbs (run gen-thumbnails after).
"""
import sys, os, re, io, json, glob, argparse, subprocess, hashlib
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF required: pip install pymupdf")
try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: pip install pillow")

# Reuse the proven stats/weapons/loads parser rather than reinventing it.
import importlib.util
_spec = importlib.util.spec_from_file_location("pdf_to_json", os.path.join(os.path.dirname(__file__), "pdf_to_json.py"))
P = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(P)

ART_DIR_DEFAULT = "assets/art"

# ── art slug (mirror js/app.js shipArtPath: first word, lowercased, alnum only) ──
def art_slug(name):
    first = re.split(r"\s+", name.strip())[0].lower()
    return re.sub(r"[^a-z0-9]", "", first)

# ── background → transparent (edge-seeded flood fill, from remove-art-bg.py) ──
TOL = 38
def cutout(im):
    im = im.convert("RGBA"); w, h = im.size; px = im.load()
    seeds = [(0,0),(w-1,0),(0,h-1),(w-1,h-1),(w//2,0),(w//2,h-1),(0,h//2),(w-1,h//2)]
    cols = [px[x,y][:3] for x,y in seeds]; tol2 = TOL*TOL
    d2 = lambda a,b:(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2
    is_bg = lambda c: any(d2(c,s)<=tol2 for s in cols)
    vis = bytearray(w*h); dq = deque()
    for x,y in seeds:
        i=y*w+x
        if not vis[i] and is_bg(px[x,y][:3]): vis[i]=1; dq.append((x,y))
    while dq:
        x,y=dq.popleft()
        for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0<=nx<w and 0<=ny<h:
                j=ny*w+nx
                if not vis[j] and is_bg(px[nx,ny][:3]): vis[j]=1; dq.append((nx,ny))
    cleared=0
    for y in range(h):
        b=y*w
        for x in range(w):
            if vis[b+x]: r,g,bl,a=px[x,y]; px[x,y]=(r,g,bl,0); cleared+=1
    # soft 1px edge
    edge=[]
    for y in range(h):
        for x in range(w):
            if not vis[y*w+x] and px[x,y][3]==255:
                for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0<=nx<w and 0<=ny<h and vis[ny*w+nx]: edge.append((x,y)); break
    for x,y in edge:
        r,g,bl,a=px[x,y]; px[x,y]=(r,g,bl,160)
    return im, 100*cleared/(w*h)

def extract_art(doc, page, dry, art_dir, slug):
    """Ship art = the largest embedded image that is NOT the full-page background
    texture (those cover ~the whole page) and not a tiny icon. Returns (status, pct)."""
    imgs = page.get_images(full=True)
    if not imgs: return ("no-image", 0)
    ph = page.rect.height or 1
    page_area = page.rect.width * ph or 1
    # Collect real candidates: not a tiny icon, not the full-page background.
    cands = []   # (pixmap, pixel_area, y0_fraction)
    for x in imgs:
        try:
            pix = fitz.Pixmap(doc, x[0])
            rects = page.get_image_rects(x[0])
        except Exception: continue
        if pix.width * pix.height < 12000:              # tiny arc/type icon
            continue
        cov = (rects[0].width * rects[0].height / page_area) if rects else 1.0
        if cov > 0.70:                                  # full-page background texture
            continue
        y0f = (rects[0].y0 / ph) if rects else 1.0
        cands.append((pix, pix.width * pix.height, y0f))
    if not cands: return ("no-art-image", 0)
    # Ship art sits at the top of the page; icons sit lower in the stat/weapon table.
    top = [c for c in cands if c[2] < 0.50]
    best = max(top or cands, key=lambda c: c[1])[0]
    if best.n - best.alpha >= 4:  # CMYK etc.
        best = fitz.Pixmap(fitz.csRGB, best)
    im = Image.open(io.BytesIO(best.tobytes("png")))
    im, pct = cutout(im)
    if pct > 92: return ("ate-ship?(%.0f%%)" % pct, pct)  # bg fill ran wild — skip, flag
    if not dry:
        os.makedirs(art_dir, exist_ok=True)
        im.save(os.path.join(art_dir, slug + ".webp"), "WEBP", quality=92, method=6)
    return ("ok %.0f%%" % pct, pct)

# ── rule glossary (these PDFs list rule NAMES; descriptions are global, so we
#    resolve them from rules already present in the faction data) ──
def build_glossary(*paths):
    gloss = {}
    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("name"), str) and isinstance(o.get("description"), str):
                gloss.setdefault(o["name"].strip().lower(), o["description"])
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    for p in paths:
        if p and os.path.exists(p):
            try: walk(json.load(open(p, encoding="utf-8")))
            except Exception: pass
    return gloss

def resolve_desc(tok, gloss):
    t = tok.strip().lower()
    if t in gloss: return gloss[t]
    base = re.sub(r'\s*-?\d+("|”)?$', "", t).strip()          # "scald-1"->"scald", 'vanguard-6"'->"vanguard"
    for cand in (base, base + "-x", base + '-x"'):
        if cand in gloss: return gloss[cand]
    # any glossary key that shares the base name
    for k, v in gloss.items():
        if re.sub(r'\s*-?\d+("|”)?$', "", k).strip() == base: return v
    return ""

def extract_rules_lore(text, special_cell, gloss):
    lines = P.merge_cells(text.split("\n"))
    # split the Special cell into tokens, dropping famous-admiral table noise.
    want = [re.sub(r"^[\-–\s]+", "", t).strip() for t in re.split(r",(?![^()]*\))", special_cell or "")]
    want = [t for t in want if t and t != "-" and not re.search(r"\b(Cost|Effect|AP)\b|\*", t)]
    rules, gaps = [], []
    for tok in want:
        d = resolve_desc(tok, gloss)
        rules.append({"name": tok, "description": d})
        if not d: gaps.append(tok)
    # lore: "Famous ships of the class:" line + first narrative (non-rule) paragraph.
    famous = next((l.split(":",1)[1].strip() for l in lines if l.lower().startswith("famous ships of the class")), "")
    lore = ""
    for pl in (l for l in lines if len(l) > 60 and not l.lower().startswith("famous ships")):
        if not re.search(r"\b(roll a dice|enemy|friendly Group|this Ship may|At the start|When |While |Battalion)\b", pl):
            lore = pl; break
    return rules, lore, famous, gaps

def mkid(faction, name):
    h = hashlib.md5((f"ingest:{faction}:{name}").encode()).hexdigest()
    return f"{h[0:4]}-{h[4:8]}-{h[8:12]}-{h[12:16]}"

CAT_BY_CLASS = [
    (r"super ?battleship|grand (battleship|cruiser)|dreadnought|mothership|homeship", "colossal"),
    (r"battleship|battlecruiser|carrier|supercruiser", "heavy"),
    (r"heavy cruiser|cruiser|monitor|troopship|barge", "medium"),
    (r"frigate|destroyer|corvette|cutter|escort|gate|cell|lighter|drone", "light"),
]
def category_for(cls):
    c = (cls or "").lower()
    for pat, cat in CAT_BY_CLASS:
        if re.search(pat, c): return cat
    return "medium"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--faction", required=True)
    ap.add_argument("--out")
    ap.add_argument("--art-dir", default=ART_DIR_DEFAULT)
    ap.add_argument("--no-art", action="store_true")
    ap.add_argument("--only-missing-art", action="store_true", help="only write art whose slug isn't already in --art-dir (don't clobber curated art)")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--validate")
    ap.add_argument("--thumbs", action="store_true")
    args = ap.parse_args()

    existing_slugs = set(os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(args.art_dir, "*.webp")))
    gloss = build_glossary(args.validate, f"data/faction-{args.faction}.json")
    doc = fitz.open(args.pdf)
    ships = []; flat = []; art_report = []; new_slugs = []; rule_gaps = []; perrors = []
    for pi in range(len(doc)):
        page = doc[pi]; text = page.get_text()
        if "Thrust" not in text or "Scan" not in text:
            continue
        try:
            sh = P.parse_page(text)
        except Exception as e:
            perrors.append((pi, str(e))); continue
        if not sh or not sh.get("name") or not sh.get("stats"):
            continue
        sh["_page"] = pi; flat.append(sh)
        name = sh["name"]
        slug = art_slug(name)
        rules, lore, famous, gaps = extract_rules_lore(text, sh.get("stats", {}).get("special", ""), gloss)
        if gaps: rule_gaps.append((name, gaps))
        rec = {
            "id": mkid(args.faction, name),
            "name": name,
            "category": category_for(sh.get("class")),
            "ship": {
                "name": name, "cost": sh.get("cost"),
                "class": sh.get("class"), "tonnage": sh.get("tonnage"),
                "stats": sh.get("stats", {}),
                "weapons": sh.get("weapons", []),
                "loads": sh.get("loads", []),
                "specialRules": rules,
                "lore": lore, "famousShips": famous,
                "refits": sh.get("refits", []),
            },
            "_page": pi, "_artSlug": slug,
        }
        if sh.get("famousAdmiral"): rec["famousAdmiral"] = sh["famousAdmiral"]
        ships.append(rec)
        if not args.no_art:
            if args.only_missing_art and slug in existing_slugs:
                status = "skip (have)"
            else:
                status, pct = extract_art(doc, page, args.dry, args.art_dir, slug)
            art_report.append((name, slug, status))
            if status.startswith("ok") and slug not in existing_slugs and slug not in new_slugs:
                new_slugs.append(slug)

    out = args.out or os.path.join("scripts", f"{args.faction}-ingest.json")
    if not args.dry:
        json.dump(ships, open(out, "w", encoding="utf-8", newline=""), indent=1, ensure_ascii=False)

    print(f"\nParsed {len(ships)} ships from {os.path.basename(args.pdf)}"
          + ("" if args.dry else f" -> {out}"))
    if not args.no_art:
        ok = sum(1 for _,_,s in art_report if s.startswith("ok"))
        print(f"Art: {ok}/{len(art_report)} cut out" + ("" if args.dry else f" -> {args.art_dir}/<slug>.webp"))
        flagged = [(n,s,st) for n,s,st in art_report if not st.startswith("ok")]
        for n,s,st in flagged[:20]: print(f"   FLAG {n} [{s}]: {st}")
        if new_slugs:
            print(f"\n*** ADD these {len(new_slugs)} slugs to SHIP_ART in js/app.js: ***")
            print("   " + ", ".join(f"'{s}'" for s in sorted(new_slugs)))
    if rule_gaps:
        uniq = sorted(set(t for _, g in rule_gaps for t in g))
        print(f"\nRules with NO description in the glossary ({len(uniq)} distinct) — add verbatim from the rulebook:")
        print("   " + ", ".join(uniq))
    if perrors:
        print(f"\nPage parse errors: {perrors[:5]}")
    if args.validate:
        P.validate(flat, args.validate)
    if args.thumbs and not args.dry:
        subprocess.run([sys.executable, os.path.join("scripts", "gen-thumbnails.py")], check=False)

if __name__ == "__main__":
    main()
