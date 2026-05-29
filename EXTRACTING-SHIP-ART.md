# Extracting Ship Art from Faction PDFs

This guide covers how to extract clean ship images from the official TTCombat faction stat PDFs for use in the fleet builder.

## Source PDFs

The source PDFs are stored in `Rules-Mechanics-PDFs/` and follow the naming pattern:

```
{Faction}_Combined_Fleet_Stats_{YYMMDD}.pdf
```

For example: `UCM_Combined_Fleet_Stats_260327.pdf`

Each PDF contains one ship per page with:
- A full-page background image (1143 x 1616 PNG, same on every page)
- A ship artwork image (JPEG, varies in size)
- Stat tables, weapon tables, and rules text

## Method 1: Automated Extraction (pymupdf)

### Requirements

```
pip install pymupdf Pillow
```

### Script

```python
import fitz  # pymupdf
from PIL import Image
import io, os

PDF_PATH = "Rules-Mechanics-PDFs/UCM_Combined_Fleet_Stats_260327.pdf"
OUT_DIR  = "assets/art"
os.makedirs(OUT_DIR, exist_ok=True)

doc = fitz.open(PDF_PATH)

for page_num in range(len(doc)):
    page = doc[page_num]
    images = page.get_images(full=True)

    for img_info in images:
        xref = img_info[0]
        img_data = doc.extract_image(xref)
        w, h = img_data["width"], img_data["height"]

        # Skip the repeated full-page background (1143x1616 PNG)
        if w == 1143 and h == 1616 and img_data["ext"] == "png":
            continue

        # Skip tiny images (icons, decorative elements)
        if w < 200:
            continue

        # This is the ship art
        pil_img = Image.open(io.BytesIO(img_data["image"]))

        # Convert to WebP
        ship_name = f"page_{page_num:03d}"  # Rename manually later
        out_path = os.path.join(OUT_DIR, f"{ship_name}.webp")
        pil_img.save(out_path, "WEBP", quality=85)
        print(f"Page {page_num}: {w}x{h} -> {out_path}")
```

### Post-extraction

After extraction, rename files to match the naming convention used by `app.js`:

- **First word of ship name, lowercase**: `thebes.webp`, `london.webp`
- **Multi-word special cases** use underscores: `new_york.webp`, `las_vegas.webp`
- **See `SHIP_ART_SPECIAL` map** in `js/app.js` for irregular mappings (e.g., Bastion -> `bioficer_battleship_bastion.webp`)

## Method 2: Manual Extraction (Affinity Publisher / Adobe)

1. Open the faction stat PDF in Affinity Publisher or Adobe Acrobat/Illustrator
2. Navigate to the ship's page
3. Click on the ship artwork image to select it
4. Export/save the selected image
5. Convert to WebP (quality 85) and place in `assets/art/`

Affinity Publisher is particularly good for this because you can click directly on embedded images and export them individually.

## File Naming Convention

The fleet builder's `shipArtPath()` function uses a two-tier lookup:

1. **`SHIP_ART_SPECIAL`** map for multi-word or irregular names:
   ```
   'New York'      -> 'new_york.webp'
   'San Francisco' -> 'san_francisco.webp'
   'Yi Sun-sin'    -> 'yi-sun-sin.webp'
   'Bastion'       -> 'bioficer_battleship_bastion.webp'  (disambiguation)
   ```

2. **`SHIP_ART`** Set for first-word matching:
   - Ship name "Thebes Super Battleship" -> first word "thebes" -> `thebes.webp`
   - Ship name "London Dreadnought" -> first word "london" -> `london.webp`

When a ship name's first word collides with another ship (e.g., Bioficer "Bastion" vs a potential future ship), add it to `SHIP_ART_SPECIAL` with a unique filename.

## Lore Text Extraction

Lore/flavor text can also be extracted from the same PDFs using `page.get_text()`. The heuristic for identifying lore lines:

- Lines longer than 60 characters with more than 5 spaces (prose, not stat headers)
- Filter out lines containing point costs, tonnage labels, weapon stat patterns
- "Famous ships of the class" lines are part of the lore

The extracted lore is stored in `data/fleet-data.json` in each ship's `lore` field and also separately in `data/ship-lore.json`.

## Image Specs

- **Format**: WebP, quality 85
- **Typical size**: 20-60 KB per image (much smaller than the original JPEGs)
- **Content**: Clean ship cutouts from stat pages (no space backgrounds, no watermarks)
- **Count**: ~297 images across all 6 factions

## Adding New Ships

When new ships are added to the game:

1. Get the updated faction stat PDF
2. Extract the new ship's image using either method above
3. Name it following the convention (first word lowercase, `.webp`)
4. Add the first word to the `SHIP_ART` Set in `js/app.js`
5. If the name needs special handling, add it to `SHIP_ART_SPECIAL`
6. Place the file in `assets/art/`
