# Populate famousShips (+ famousShipsPrefix) for the cross-faction "misc" / civilian
# ships and the Resistance/Bioficer counts-as ships, from the official Misc + Civilian
# PDFs ("ships of the class" / "Recorded ships of the class" lists). Faction-grouped
# entries keep their "(Faction)" tag on the LAST ship of each group so renderFamousShips
# lays them out as columns (the same format the Resistance Grand Battleships use).
# "PDF is king." Applied to every data/faction-*.json leaf + the merged fleet-data mirror.
import json, glob

NOTED    = "Noted ships of the class:"
KNOWN    = "Known ships of the class:"
RECORDED = "Recorded ships of the class:"
ONLY     = "Only ship of the class:"

# keyed by any name that appears on the ship's wrapper, ship leaf, or variant leaf
MAP = {
    # --- cross-faction misc / civilian ships (present in every faction file) ---
    "Pungari Thresher Hive Ship": (NOTED,
        ["Ishmael", "Megellan", "Quint's Bane", "Dust Devil"]),
    "Palatine Command Barge": (RECORDED,
        ["River Queen", "Twilight Spectre", "Eclipse (UCM)",
         "Domus Aurea", "Samuda", "AAA (PHR)",
         "Kabal's Raiment [né Versailles]", "Kabal's Insight [né Midas] (Kalium)",
         "Bruised Beautiful [né Atlantique]", "Daughter of Eden (Vega Scrapfleet)",
         "Gilded Trident", "In Diamond Clad (Independents)"]),
    "OBV-64 Oblivion Barge": (KNOWN,
        ["Rad Wretch", "Trash Bash", "S-Stain (Independents)",
         "Volatile Contents Hauler KHC-04a (Kalium)"]),
    "Type-87 Terminus Harvester": (NOTED,
        ["Terminus", "Slag Pit", "Scrap Hammer"]),
    "VX-22 Flenser": (NOTED,
        ["Wreck & Ruin", "Twisted Metal", "Steel Beams", "Grindcore"]),
    "PRK-91 Provenance Ark": (KNOWN,
        ["Provenance", "Endurance (Independents)", "Capitana (Kalium)"]),
    "Jah’tar Startrader": (KNOWN,
        ["Bird-in-hand", "Lustrous Glint", "Penny for your Thoughts"]),
    "M-Type Barge": (KNOWN,
        ["Ever Astra", "Maersk Olympus", "Foldship Ace", "TTF Shippy"]),
    "DH-Type Penal Transport": (KNOWN,
        ["Dreadhold", "No Mercy", "Last Chance (UCM)", "Infestation (Scourge)",
         "Blood Money", "Tooth and Claw (Independents)", "DH2745 (Kalium)"]),
    "SLM-9 Resupply Hauler": (NOTED,
        ["Crate Expectations", "Right on Time", "Reliable"]),
    "T-Type Tugboats": (KNOWN,
        # "[destroyed]" in brackets, not parens, so it shows verbatim instead of
        # being parsed as a (faction) column tag and dropped.
        ["Tug & Go", "Ride to Die", "Tugging Along", "T-104", "T-666 [destroyed]"]),
    "LKS Dredgers": (NOTED,
        ["Dredger", "Silt Siphon", "Ground Town"]),
    # Unique one-off hulls the PDF flags with "Only ship of the class:".
    "Hyperyacht Aurorum": (ONLY, ["Hyperyacht Aurorum"]),
    "Hyperyacht Somniferum": (ONLY, ["Hyperyacht Somniferum"]),
    # --- Resistance / Bioficer counts-as ships (Misc Combined PDF) ---
    "Centurion Grand Cruisers": (RECORDED,
        ["Pilum", "Fontaine's Miracle", "Myriad (Independents)",
         "Proudcore", "Industry", "Fist of Iron (Kalium)"]),
    "Kalium KNC-5 Line Cruisers": (RECORDED,
        ["Heartbleeder", "Souleater", "Rend II"]),
    "Kalium KNC-5": (RECORDED,
        ["Heartbleeder", "Souleater", "Rend II"]),
    "Kalium KNC-12 Line Cruisers": (RECORDED,
        ["Beton Brut", "Chaimberlain Powelbon", "Du Hast"]),
    "Kalium KNC-12": (RECORDED,
        ["Beton Brut", "Chaimberlain Powelbon", "Du Hast"]),
    "Vicarius": (RECORDED,
        ["Vicarius (Independents)", "Warcrimes", "Grim Enforcer", "Exterminator (Kalium)"]),
    "Styx": (RECORDED, ["Styx"]),
}

def apply(o, prefix, ships):
    o["famousShipsPrefix"] = prefix
    o["famousShips"] = list(ships)

total = {}
for fp in glob.glob('data/faction-*.json') + ['data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    changed = []
    def walk(o, path):
        if isinstance(o, dict):
            nm = o.get('name')
            if nm in MAP and '/altSculpts' not in path:
                prefix, ships = MAP[nm]
                # wrapper -> write onto the inner ship leaf; leaf/variant -> write onto itself
                tgt = o['ship'] if isinstance(o.get('ship'), dict) else o
                apply(tgt, prefix, ships)
                changed.append(nm)
            for k, v in o.items():
                walk(v, path + '/' + str(k))
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, path + '[%d]' % i)
    walk(d, '')
    if changed:
        json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
    total[fp] = changed
    print(fp.split('\\')[-1].split('/')[-1], '->', len(changed), sorted(set(changed)))

# coverage check: which MAP keys were never matched anywhere
all_hit = set()
for v in total.values():
    all_hit.update(v)
missing = [k for k in MAP if k not in all_hit]
print('\nMAP keys never matched (ok if a duplicate alias):', missing)
