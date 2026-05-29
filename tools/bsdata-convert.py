#!/usr/bin/env python3
"""
BattleScribe XML to fleet-data.json converter for Dropfleet Commander.

Reads .gst and .cat files from bsdata-repo/ and outputs JSON matching
the existing data/fleet-data.json format.

Usage: python tools/bsdata-convert.py
"""

import json
import os
import sys
import xml.etree.ElementTree as ET
from collections import OrderedDict
from pathlib import Path

# ------------------------------------------------------------------
# Paths
# ------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
BSDATA_DIR = PROJECT_ROOT / "bsdata-repo"
OUTPUT_PATH = PROJECT_ROOT / "data" / "fleet-data.json"
LORE_PATH = PROJECT_ROOT / "data" / "ship-lore.json"

# ------------------------------------------------------------------
# XML namespaces
# ------------------------------------------------------------------
NS_GST = "{http://www.battlescribe.net/schema/gameSystemSchema}"
NS_CAT = "{http://www.battlescribe.net/schema/catalogueSchema}"

# ------------------------------------------------------------------
# Category IDs (from the .gst)
# ------------------------------------------------------------------
# Group type categories
CAT_COLOSSAL_GROUPS = "52fa-6578-d171-57d6"
CAT_HEAVY_GROUPS = "8d99-053d-ffeb-98c5"
CAT_MEDIUM_GROUPS = "e555-ff57-c478-18cd"
CAT_LIGHT_GROUPS = "f51b-d892-62c0-3f1e"
CAT_PAYLOAD_GROUPS = "8c2b-ea4d-8bea-c6a2"
CAT_ADMIRALS = "fb8b-57b3-d46c-d679"
CAT_FAMOUS_ADMIRALS = "daa7-4c13-fe75-9281"
CAT_FACTION_FAMOUS = "79f7-4244-6fb7-d41a"

# Ship tonnage categories
CAT_COLOSSAL_SHIP = "6e44-cb75-e25f-8b24"
CAT_HEAVY_SHIP = "9d6f-26b0-7969-496b"
CAT_MEDIUM_SHIP = "53c3-afc0-63ef-413a"
CAT_LIGHT_SHIP = "f942-8f88-d77b-13c1"
CAT_PAYLOAD_SHIP = "3fa9-60d3-d9be-6611"

# Space stations
CAT_SPACE_STATIONS = "5ca8-89b2-52c6-d394"
# Deployable Features (unit level)
CAT_DEPLOY_FEAT_UNIT = "11b4-72d7-c64d-25c1"
# Deployable Features (model level)
CAT_DEPLOY_FEAT_MODEL = "73f6-cabc-3dad-5334"

# Points cost type
COST_PTS_TYPE = "ab32-c9b6-10f3-cbdb"

# Profile type IDs
PROFILE_SHIP = "8a2d-efd5-4b60-f4fa"
PROFILE_WEAPON = "02b7-2433-f72f-d510"
PROFILE_LOAD = "7ba8-a64f-b5fb-8c3e"
PROFILE_ADMIRAL = "92cf-ddd3-4d79-e408"
PROFILE_ABILITY = "705b-98a3-a21d-7118"
PROFILE_LAUNCH_ASSET = "2011-41e1-9c7c-9e25"
PROFILE_LAUNCH_FIGHTER = "3057-ca91-b261-38a8"
PROFILE_SPACE_STATION = "a685-1a7d-ba2d-3db8"
PROFILE_DEPLOY_FEATURE = "2b58-1a71-a53a-980d"

# Characteristic type IDs -- Ship
CHAR_THRUST = "d821-4294-3117-e8a6"
CHAR_SCAN = "960a-5d0e-18c5-4310"
CHAR_SIG = "4feb-14c2-b1f1-9fa5"
CHAR_HULL = "5253-be1d-917b-17d9"
CHAR_ES = "42ae-03c9-d0ff-61da"
CHAR_KS = "a4d4-4c63-1848-24f8"
CHAR_BS = "05b6-9825-68e8-4983"
CHAR_G = "32ce-7bbb-1d0f-8c80"
CHAR_SPECIAL = "fdf5-89b6-e62e-570f"

# Characteristic type IDs -- Weapon
CHAR_W_ARC = "7fb7-39ec-1352-3b97"
CHAR_W_ATT = "af4e-6eec-3cb5-5aae"
CHAR_W_LOCK = "ddfe-5610-8f1a-650d"
CHAR_W_DMG = "31b1-2e8b-0b99-b1c7"
CHAR_W_TYPE = "8f83-3218-7832-0818"
CHAR_W_SPECIAL = "1e8b-4801-6eb9-f278"

# Characteristic type IDs -- Load
CHAR_L_LAUNCH = "bcc4-f844-acff-aa94"
CHAR_L_SPECIAL = "d3be-1a27-21ac-fb65"

# Characteristic type IDs -- Admiral
CHAR_A_LEVEL = "391a-b7ae-831e-4cf0"
CHAR_A_SPECIAL = "2a6e-dc3c-846c-d4c2"

# Characteristic type IDs -- Admiral Ability
CHAR_AB_COST = "e725-1a05-f360-abc6"
CHAR_AB_EFFECT = "49ae-26b2-d6ec-81aa"

# Characteristic type IDs -- Launch Asset
CHAR_LA_THRUST = "8c30-992b-18d3-9a9e"
CHAR_LA_ATT = "09f1-844b-5ba1-7b58"
CHAR_LA_LOCK = "243e-e8ac-7e08-3636"
CHAR_LA_DMG = "1f0f-7a09-a26f-cccf"
CHAR_LA_TYPE = "b85d-52e3-cf0f-c002"
CHAR_LA_SPECIAL = "c024-89fd-1161-a30f"

# Characteristic type IDs -- Launch Asset (Fighter)
CHAR_LF_THRUST = "ea0d-696a-c5fa-1684"
CHAR_LF_KS_REROLL = "d1c9-654e-a9f1-a88f"

# Characteristic type IDs -- Space Station
CHAR_SS_SCAN = "e1ee-74b3-00a9-8744"
CHAR_SS_SIG = "1fb1-6992-a308-b4c8"
CHAR_SS_HULL = "c2b4-8dc9-7506-debb"
CHAR_SS_ES = "3afd-b020-ec74-2ea2"
CHAR_SS_KS = "595f-3318-8065-9225"
CHAR_SS_BS = "750b-9043-034b-c27a"
CHAR_SS_G = "8b8c-53e9-20d1-9cbc"
CHAR_SS_SPECIAL = "473b-cbb5-5ba2-c2de"

# Characteristic type IDs -- Deployable Feature profile
CHAR_DF_ES = "0456-bd64-8b8a-2bc5"
CHAR_DF_KS = "adf0-18ce-5bb6-d55e"
CHAR_DF_SPECIAL = "a74a-a43a-1834-d8c4"

# ------------------------------------------------------------------
# Faction mapping
# ------------------------------------------------------------------
FACTION_MAP = {
    "United Colonies of Mankind": "ucm",
    "Post-Human Republic": "phr",
    "Scourge": "scourge",
    "Shaltari": "shaltari",
    "Bioficers": "bioficer",
    "Resistance": "resistance",
}

FACTION_SHORT = {
    "United Colonies of Mankind": "UCM",
    "Post-Human Republic": "PHR",
    "Scourge": "Scourge",
    "Shaltari": "Shaltari",
    "Bioficers": "Bioficers",
    "Resistance": "Resistance",
}

GROUP_CATEGORY_MAP = {
    CAT_COLOSSAL_GROUPS: "colossal",
    CAT_HEAVY_GROUPS: "heavy",
    CAT_MEDIUM_GROUPS: "medium",
    CAT_LIGHT_GROUPS: "light",
    CAT_PAYLOAD_GROUPS: "payload",
}

TONNAGE_MAP = {
    CAT_COLOSSAL_SHIP: "C",
    CAT_HEAVY_SHIP: "H",
    CAT_MEDIUM_SHIP: "M",
    CAT_LIGHT_SHIP: "L",
    CAT_PAYLOAD_SHIP: "P",
}

TONNAGE_FROM_CATEGORY = {
    "colossal": "C",
    "heavy": "H",
    "medium": "M",
    "light": "L",
    "payload": "P",
}

# ------------------------------------------------------------------
# Faction-specific space station mapping
# ------------------------------------------------------------------
# Base stations available to ALL factions
BASE_STATION_IDS = {
    "914b-3a7a-039e-34df",  # Small Space Station
    "218b-faf8-ffab-2cd5",  # Medium Space Station
    "6f26-fe48-4135-7ed3",  # Large Space Station
}

# Faction-specific stations (in addition to the 3 base stations)
FACTION_STATION_IDS = {
    "ucm": {
        "68e9-14ab-4493-0656",  # Defence Hangar
        "6b40-0777-a810-a170",  # Munitions Platform
    },
    "phr": {
        "ec51-7e59-4419-d22d",  # Orbital Picket
        "41e5-a021-0745-4a30",  # Orbital Outpost
        "4bd7-5d82-80d3-afe1",  # Defence Halo
        "432d-69c3-2a23-b3d8",  # Orbital Spire
    },
    "scourge": {
        "2d1a-7c81-0ced-b810",  # Ephyra
        "fec6-51a8-6e61-26f1",  # Nematocyst
    },
    "shaltari": {
        "a3e1-a57d-5032-0fed",  # Gatestation
        "e3fe-8a69-be4d-97e4",  # Grav Hook
        "0854-c0bb-b001-626d",  # Anchor
        "8cf6-6559-ba2d-64a2",  # Shuriken
    },
    "bioficer": set(),  # No faction-specific stations
    "resistance": {
        "eedb-96cd-d7a3-6b75",  # Grand Station
        "1343-3008-33a4-59aa",  # Astrobotanical Outpost
    },
}

# ------------------------------------------------------------------
# Linked catalogue ship exclusions per faction
# Some Misc/Civilian ships are restricted to certain factions via
# complex BattleScribe conditions. This mapping encodes which ships
# (by entry ID) are EXCLUDED from which factions.
# ------------------------------------------------------------------
# Centurion Grand Cruisers (Misc): only UCM, PHR, Resistance
# Palatine Command Barge (Misc): only UCM, PHR, Resistance
# Jah'tar Startrader (Civilian): only UCM, PHR, Shaltari, Resistance
LINKED_SHIP_EXCLUSIONS = {
    "e131-eb84-312c-6fd2": {"scourge", "shaltari", "bioficer"},   # Centurion Grand Cruisers
    "39f3-e983-5400-5b03": {"scourge", "shaltari", "bioficer"},   # Palatine Command Barge
    "e1ee-f46b-05f3-54b2": {"scourge", "bioficer"},               # Jah'tar Startrader
}

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def get_char(profile_el, type_id, ns):
    """Get a characteristic value by typeId from a profile element."""
    for char in profile_el.findall(f".//{ns}characteristic"):
        if char.get("typeId") == type_id:
            return (char.text or "").strip()
    return ""


def get_cost(entry_el, ns):
    """Get point cost from a selectionEntry."""
    for cost in entry_el.findall(f".//{ns}cost"):
        if cost.get("typeId") == COST_PTS_TYPE or cost.get("name") == "pts":
            val = cost.get("value", "0")
            try:
                return int(float(val))
            except (ValueError, TypeError):
                return 0
    return 0


def get_category_ids(entry_el, ns):
    """Get set of category target IDs from categoryLinks."""
    ids = set()
    for cl in entry_el.findall(f"./{ns}categoryLinks/{ns}categoryLink"):
        tid = cl.get("targetId", "")
        if tid:
            ids.add(tid)
    return ids


def get_constraints_minmax(entry_el, ns):
    """Get min and max from constraints."""
    min_val = 1
    max_val = 1
    for c in entry_el.findall(f".//{ns}constraint"):
        try:
            v = int(float(c.get("value", "0")))
        except (ValueError, TypeError):
            continue
        if c.get("type") == "min" and c.get("field") == "selections":
            min_val = v
        elif c.get("type") == "max" and c.get("field") == "selections":
            max_val = v
    return min_val, max_val


def parse_hull(val):
    """Parse hull value - integer."""
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


def clean_stat(val):
    """Clean up stat value - unescape &quot; etc."""
    if val is None:
        return "-"
    val = val.strip()
    if not val:
        return "-"
    return val


# ------------------------------------------------------------------
# Build lookup tables from a catalogue
# ------------------------------------------------------------------

def build_shared_entries_index(root, ns):
    """Build index of all shared selection entries by ID."""
    idx = {}
    for se in root.findall(f".//{ns}sharedSelectionEntries/{ns}selectionEntry"):
        eid = se.get("id", "")
        if eid:
            idx[eid] = se
    return idx


def build_shared_profiles_index(root, ns):
    """Build index of all shared profiles by ID."""
    idx = {}
    for p in root.findall(f".//{ns}sharedProfiles/{ns}profile"):
        pid = p.get("id", "")
        if pid:
            idx[pid] = p
    return idx


def build_shared_rules_index(root, ns):
    """Build index of all shared rules by ID (from .gst and .cat)."""
    idx = {}
    for r in root.findall(f".//{ns}sharedRules/{ns}rule"):
        rid = r.get("id", "")
        if rid:
            idx[rid] = r
    return idx


def build_shared_entry_groups_index(root, ns):
    """Build index of shared selection entry groups by ID."""
    idx = {}
    for seg in root.findall(f".//{ns}sharedSelectionEntryGroups/{ns}selectionEntryGroup"):
        gid = seg.get("id", "")
        if gid:
            idx[gid] = seg
    return idx


# ------------------------------------------------------------------
# Weapon / Load profile extraction
# ------------------------------------------------------------------

def extract_weapon_profile(profile_el, ns):
    """Extract weapon data from a Weapon profile element."""
    return {
        "name": profile_el.get("name", ""),
        "arc": clean_stat(get_char(profile_el, CHAR_W_ARC, ns)),
        "attack": clean_stat(get_char(profile_el, CHAR_W_ATT, ns)),
        "lock": clean_stat(get_char(profile_el, CHAR_W_LOCK, ns)),
        "damage": clean_stat(get_char(profile_el, CHAR_W_DMG, ns)),
        "type": clean_stat(get_char(profile_el, CHAR_W_TYPE, ns)),
        "special": clean_stat(get_char(profile_el, CHAR_W_SPECIAL, ns)),
    }


def extract_load_profile(profile_el, ns):
    """Extract load data from a Load profile element."""
    return {
        "name": profile_el.get("name", ""),
        "launch": clean_stat(get_char(profile_el, CHAR_L_LAUNCH, ns)),
        "special": clean_stat(get_char(profile_el, CHAR_L_SPECIAL, ns)),
    }


def resolve_weapon_or_load(entry_el, ns, shared_entries, shared_profiles):
    """
    Given a selectionEntry (weapon/load), extract its profile.
    It may have a direct profile or reference one via infoLink.
    Returns (type, data) where type is 'weapon' or 'load' or None.
    """
    # Check for direct profiles
    for p in entry_el.findall(f"./{ns}profiles/{ns}profile"):
        tn = p.get("typeName", "")
        if tn == "Weapon":
            return ("weapon", extract_weapon_profile(p, ns))
        elif tn == "Load":
            return ("load", extract_load_profile(p, ns))

    # Check infoLinks for profile references
    for il in entry_el.findall(f"./{ns}infoLinks/{ns}infoLink"):
        if il.get("type") == "profile":
            target_id = il.get("targetId", "")
            if target_id in shared_profiles:
                p = shared_profiles[target_id]
                tn = p.get("typeName", "")
                if tn == "Weapon":
                    return ("weapon", extract_weapon_profile(p, ns))
                elif tn == "Load":
                    return ("load", extract_load_profile(p, ns))

    return (None, None)


def resolve_entry_links(model_el, ns, shared_entries, shared_profiles, shared_entry_groups):
    """
    Resolve all entryLinks on a model to extract weapons, loads,
    and loadout options.
    """
    weapons = []
    loads = []
    loadout_options = []

    for el in model_el.findall(f"./{ns}entryLinks/{ns}entryLink"):
        link_type = el.get("type", "")
        target_id = el.get("targetId", "")

        if link_type == "selectionEntry":
            # Resolve from shared entries
            target = shared_entries.get(target_id)
            if target is None:
                continue

            entry_name = target.get("name", "")

            # Skip dividers and non-game entries
            if entry_name.startswith("-----") or entry_name == "Drive Refit":
                continue

            typ, data = resolve_weapon_or_load(target, ns, shared_entries, shared_profiles)
            if typ == "weapon":
                weapons.append(data)
            elif typ == "load":
                loads.append(data)

        elif link_type == "selectionEntryGroup":
            # This is a loadout option group (like Laser Refit, Minelayer)
            target = shared_entry_groups.get(target_id)
            if target is None:
                continue
            loadout = extract_loadout_group(target, ns, shared_entries, shared_profiles)
            if loadout and loadout.get("options"):
                loadout_options.append(loadout)

    return weapons, loads, loadout_options


def extract_loadout_group(group_el, ns, shared_entries, shared_profiles):
    """Extract a loadout option group (selectionEntryGroup like Laser Refit)."""
    group_name = group_el.get("name", "")

    # Skip the Abilities group (admiral abilities, not loadout)
    if group_name == "Abilities":
        return None

    # Get min/max constraints for the group
    min_sel, max_sel = 0, 1
    for c in group_el.findall(f"./{ns}constraints/{ns}constraint"):
        try:
            v = int(float(c.get("value", "0")))
        except (ValueError, TypeError):
            continue
        if c.get("type") == "min":
            min_sel = v
        elif c.get("type") == "max":
            max_sel = v

    default_id = group_el.get("defaultSelectionEntryId", "")

    options = []
    for opt_entry in group_el.findall(f"./{ns}selectionEntries/{ns}selectionEntry"):
        opt = extract_loadout_option(opt_entry, ns, shared_entries, shared_profiles)
        if opt:
            options.append(opt)

    if not options:
        return None

    result = {
        "name": group_name,
        "minSelections": min_sel,
        "maxSelections": max_sel,
    }
    if default_id:
        result["defaultId"] = default_id
    result["options"] = options

    return result


def extract_loadout_option(opt_el, ns, shared_entries, shared_profiles):
    """Extract a single loadout option from a selectionEntry within a group."""
    name = opt_el.get("name", "")
    cost = get_cost(opt_el, ns)

    opt_weapons = []
    opt_loads = []

    # Direct profiles on this option
    for p in opt_el.findall(f"./{ns}profiles/{ns}profile"):
        tn = p.get("typeName", "")
        if tn == "Weapon":
            opt_weapons.append(extract_weapon_profile(p, ns))
        elif tn == "Load":
            opt_loads.append(extract_load_profile(p, ns))

    # Resolve entryLinks within the option
    for el in opt_el.findall(f"./{ns}entryLinks/{ns}entryLink"):
        if el.get("type") == "selectionEntry":
            target_id = el.get("targetId", "")
            target = shared_entries.get(target_id)
            if target is None:
                continue
            typ, data = resolve_weapon_or_load(target, ns, shared_entries, shared_profiles)
            if typ == "weapon":
                opt_weapons.append(data)
            elif typ == "load":
                opt_loads.append(data)

    result = {
        "name": name,
        "cost": cost,
        "weapons": opt_weapons,
        "loads": opt_loads,
    }
    return result


# ------------------------------------------------------------------
# Special rules resolution
# ------------------------------------------------------------------

def resolve_special_rules(entry_el, ns, gst_rules, cat_rules):
    """
    Resolve infoLinks of type="rule" to get special rules with descriptions.
    """
    rules = []
    seen = set()
    for il in entry_el.findall(f"./{ns}infoLinks/{ns}infoLink"):
        if il.get("type") == "rule":
            target_id = il.get("targetId", "")
            if target_id in seen:
                continue
            seen.add(target_id)

            rule_el = gst_rules.get(target_id)
            if rule_el is None:
                rule_el = cat_rules.get(target_id)
            if rule_el is not None:
                rule_name = rule_el.get("name", "")
                desc_el = rule_el.find(f"description")
                if desc_el is None:
                    desc_el = rule_el.find(f"{NS_GST}description")
                if desc_el is None:
                    desc_el = rule_el.find(f"{NS_CAT}description")
                desc = ""
                if desc_el is not None and desc_el.text:
                    desc = desc_el.text.strip()
                rule_entry = {"name": rule_name, "description": desc}
                page = rule_el.get("page", "")
                if page:
                    rule_entry["page"] = page
                pub_id = rule_el.get("publicationId", "")
                if pub_id:
                    rule_entry["publicationId"] = pub_id
                rules.append(rule_entry)
    return rules


# ------------------------------------------------------------------
# Ship extraction
# ------------------------------------------------------------------

def extract_ship_from_model(model_el, ns, shared_entries, shared_profiles,
                            shared_entry_groups, gst_rules, cat_rules):
    """Extract ship data from a model-type selectionEntry."""
    ship_name = model_el.get("name", "")

    # Get ship profile
    ship_profile = None
    for p in model_el.findall(f"./{ns}profiles/{ns}profile"):
        if p.get("typeName") == "Ship" or p.get("typeId") == PROFILE_SHIP:
            ship_profile = p
            break

    if ship_profile is None:
        return None

    # Get tonnage from categoryLinks
    model_cats = get_category_ids(model_el, ns)
    tonnage = "M"  # default
    for cat_id, ton in TONNAGE_MAP.items():
        if cat_id in model_cats:
            tonnage = ton
            break

    # Get point cost
    cost = get_cost(model_el, ns)

    # Parse stats
    stats = {
        "thrust": clean_stat(get_char(ship_profile, CHAR_THRUST, ns)),
        "scan": clean_stat(get_char(ship_profile, CHAR_SCAN, ns)),
        "sig": clean_stat(get_char(ship_profile, CHAR_SIG, ns)),
        "hull": parse_hull(get_char(ship_profile, CHAR_HULL, ns)),
        "es": clean_stat(get_char(ship_profile, CHAR_ES, ns)),
        "ks": clean_stat(get_char(ship_profile, CHAR_KS, ns)),
        "bs": clean_stat(get_char(ship_profile, CHAR_BS, ns)),
        "g": clean_stat(get_char(ship_profile, CHAR_G, ns)),
        "special": clean_stat(get_char(ship_profile, CHAR_SPECIAL, ns)),
    }

    # Get min/max group constraints
    group_min, group_max = get_constraints_minmax(model_el, ns)

    # Resolve weapons, loads, loadout options from entryLinks
    weapons, loads_list, loadout_options = resolve_entry_links(
        model_el, ns, shared_entries, shared_profiles, shared_entry_groups
    )

    # Also extract weapons/loads from direct child selectionEntry elements
    # (used by Civilian/Misc catalogue ships and some faction ships)
    for child_se in model_el.findall(f"./{ns}selectionEntries/{ns}selectionEntry"):
        child_name = child_se.get("name", "")
        if child_name.startswith("-----"):
            continue
        typ, data = resolve_weapon_or_load(child_se, ns, shared_entries, shared_profiles)
        if typ == "weapon":
            # Avoid duplicates (same weapon name already from entryLinks)
            if not any(w["name"] == data["name"] for w in weapons):
                weapons.append(data)
        elif typ == "load":
            if not any(l["name"] == data["name"] for l in loads_list):
                loads_list.append(data)

    # Resolve special rules from infoLinks
    special_rules = resolve_special_rules(model_el, ns, gst_rules, cat_rules)

    # Check for Rare/Unique in special text
    special_text = stats.get("special", "")
    is_rare = "Rare" in special_text
    is_unique = "Unique" in special_text

    ship = {
        "name": ship_name,
        "cost": cost,
        "stats": stats,
        "weapons": weapons,
        "loads": loads_list,
        "specialRules": special_rules,
        "groupMin": group_min,
        "groupMax": group_max,
        "isRare": is_rare,
        "isUnique": is_unique,
        "tonnage": tonnage,
    }

    if loadout_options:
        ship["loadoutOptions"] = loadout_options

    return ship


# ------------------------------------------------------------------
# Admiral extraction
# ------------------------------------------------------------------

def extract_admiral_abilities_from_profiles(entry_el, ns):
    """Extract admiral abilities from profiles with typeName='Admiral Ability'."""
    abilities = []
    for p in entry_el.findall(f".//{ns}profile"):
        if p.get("typeName") == "Admiral Ability" or p.get("typeId") == PROFILE_ABILITY:
            ab = {
                "name": p.get("name", ""),
                "cost": clean_stat(get_char(p, CHAR_AB_COST, ns)),
                "effect": clean_stat(get_char(p, CHAR_AB_EFFECT, ns)),
            }
            abilities.append(ab)
    return abilities


def extract_shared_abilities(entry_el, ns, shared_entry_groups):
    """Extract shared faction abilities linked via entryLink to Abilities group."""
    abilities = []
    for el in entry_el.findall(f".//{ns}entryLink"):
        if el.get("type") == "selectionEntryGroup":
            target_id = el.get("targetId", "")
            group = shared_entry_groups.get(target_id)
            if group is None:
                continue
            if group.get("name") != "Abilities":
                continue
            # Extract abilities from each entry in this group
            for se in group.findall(f"./{ns}selectionEntries/{ns}selectionEntry"):
                for p in se.findall(f"./{ns}profiles/{ns}profile"):
                    if p.get("typeName") == "Admiral Ability" or p.get("typeId") == PROFILE_ABILITY:
                        ab = {
                            "name": p.get("name", ""),
                            "cost": clean_stat(get_char(p, CHAR_AB_COST, ns)),
                            "effect": clean_stat(get_char(p, CHAR_AB_EFFECT, ns)),
                        }
                        abilities.append(ab)
    return abilities


def extract_admiral(entry_el, ns, shared_entries, shared_profiles,
                    shared_entry_groups, gst_rules, cat_rules, is_famous):
    """Extract admiral data from a selectionEntry."""
    entry_id = entry_el.get("id", "")
    entry_name = entry_el.get("name", "")

    if is_famous:
        # Famous admirals have a nested model with subType="crew" for the admiral
        admiral_model = None
        for se in entry_el.findall(f"./{ns}selectionEntries/{ns}selectionEntry"):
            if se.get("type") == "model" and se.get("subType") == "crew":
                admiral_model = se
                break

        if admiral_model is None:
            # Try any model child
            for se in entry_el.findall(f"./{ns}selectionEntries/{ns}selectionEntry"):
                if se.get("type") == "model":
                    admiral_model = se
                    break

        if admiral_model is None:
            return None

        name = admiral_model.get("name", "")
        cost = get_cost(admiral_model, ns)

        # Get admiral profile
        level = 1
        special = "-"
        for p in admiral_model.findall(f"./{ns}profiles/{ns}profile"):
            if p.get("typeName") == "Admiral" or p.get("typeId") == PROFILE_ADMIRAL:
                level_str = get_char(p, CHAR_A_LEVEL, ns)
                try:
                    level = int(level_str)
                except (ValueError, TypeError):
                    level = 1
                special = clean_stat(get_char(p, CHAR_A_SPECIAL, ns))
                break

        # Get unique abilities from the admiral model
        unique_abilities = extract_admiral_abilities_from_profiles(admiral_model, ns)

        # Get shared faction abilities
        shared_abilities = extract_shared_abilities(admiral_model, ns, shared_entry_groups)

        all_abilities = unique_abilities + shared_abilities

        # Get flagship - from entryLinks on the main entry
        flagship = None
        for el in entry_el.findall(f"./{ns}entryLinks/{ns}entryLink"):
            if el.get("type") == "selectionEntry":
                target_id = el.get("targetId", "")
                target = shared_entries.get(target_id)
                if target is None:
                    continue
                # Check if this is a ship (model with Ship profile)
                has_ship = False
                for p in target.findall(f".//{ns}profile"):
                    if p.get("typeName") == "Ship" or p.get("typeId") == PROFILE_SHIP:
                        has_ship = True
                        break
                if not has_ship:
                    continue

                # This entryLink may have modifier overrides for the special field
                special_override = None
                special_override_mode = "set"
                for mod in el.findall(f"./{ns}modifiers/{ns}modifier"):
                    if mod.get("field") == CHAR_SPECIAL:
                        special_override = mod.get("value", "")
                        special_override_mode = mod.get("type", "set")
                        special_join = mod.get("join", ", ")

                # Determine the group category from categoryLinks on the entryLink
                el_cats = get_category_ids(el, ns)
                flagship_category = "heavy"
                for cat_id, cat_name in GROUP_CATEGORY_MAP.items():
                    if cat_id in el_cats:
                        flagship_category = cat_name
                        break

                # Extract the ship
                flagship_ship = extract_ship_from_model(
                    target, ns, shared_entries, shared_profiles,
                    shared_entry_groups, gst_rules, cat_rules
                )
                if flagship_ship:
                    # Apply special override if present
                    if special_override is not None:
                        if special_override_mode == "append":
                            base = flagship_ship["stats"].get("special", "")
                            if base and base != "-":
                                flagship_ship["stats"]["special"] = base + special_join + special_override
                            else:
                                flagship_ship["stats"]["special"] = special_override
                        else:
                            flagship_ship["stats"]["special"] = special_override

                    # Resolve special rules from infoLinks on the entryLink
                    extra_rules = resolve_special_rules(el, ns, gst_rules, cat_rules)
                    if extra_rules:
                        existing_names = {r["name"] for r in flagship_ship.get("specialRules", [])}
                        for r in extra_rules:
                            if r["name"] not in existing_names:
                                flagship_ship["specialRules"].append(r)

                    flagship_ship["category"] = flagship_category
                    flagship = flagship_ship
                    break

        admiral = {
            "id": entry_id,
            "name": name,
            "level": level,
            "cost": cost,
            "isFamous": True,
            "special": special,
            "abilities": all_abilities,
            "flagship": flagship,
        }
        return admiral

    else:
        # Regular admiral - no nested model, profile directly on entry
        name_raw = entry_name
        # Strip prefix like "Lvl 1: "
        if ": " in name_raw:
            name = name_raw.split(": ", 1)[1].strip()
        else:
            name = name_raw

        cost = get_cost(entry_el, ns)

        # Get admiral profile
        level = 1
        special = "-"
        for p in entry_el.findall(f"./{ns}profiles/{ns}profile"):
            if p.get("typeName") == "Admiral" or p.get("typeId") == PROFILE_ADMIRAL:
                level_str = get_char(p, CHAR_A_LEVEL, ns)
                try:
                    level = int(level_str)
                except (ValueError, TypeError):
                    level = 1
                special = clean_stat(get_char(p, CHAR_A_SPECIAL, ns))
                break

        # Get unique abilities from the entry directly
        unique_abilities = extract_admiral_abilities_from_profiles(entry_el, ns)

        # Get shared faction abilities
        shared_abilities = extract_shared_abilities(entry_el, ns, shared_entry_groups)

        all_abilities = unique_abilities + shared_abilities

        admiral = {
            "id": entry_id,
            "name": name,
            "level": level,
            "cost": cost,
            "isFamous": False,
            "special": special,
            "abilities": all_abilities,
            "flagship": None,
        }
        return admiral


# ------------------------------------------------------------------
# Launch Assets extraction
# ------------------------------------------------------------------

def extract_launch_assets(root, ns):
    """Extract the Launch Assets reference entry with all asset profiles."""
    assets = []
    asset_entries = []

    # Find all entries named "Launch Assets" in shared selection entries
    for se in root.findall(f".//{ns}selectionEntry"):
        if se.get("name") == "Launch Assets" and se.get("type") == "upgrade":
            asset_entries.append(se)

    for ae in asset_entries:
        entry_id = ae.get("id", "")
        asset_list = []

        # Look for nested selection entries with Launch Asset or Fighter profiles
        for child_se in ae.findall(f".//{ns}selectionEntry"):
            for p in child_se.findall(f"./{ns}profiles/{ns}profile"):
                type_name = p.get("typeName", "")

                if type_name == "Launch Asset" and p.get("typeId") == PROFILE_LAUNCH_ASSET:
                    asset = {
                        "name": p.get("name", ""),
                        "thrust": clean_stat(get_char(p, CHAR_LA_THRUST, ns)),
                        "attack": clean_stat(get_char(p, CHAR_LA_ATT, ns)),
                        "lock": clean_stat(get_char(p, CHAR_LA_LOCK, ns)),
                        "damage": clean_stat(get_char(p, CHAR_LA_DMG, ns)),
                        "type": clean_stat(get_char(p, CHAR_LA_TYPE, ns)),
                        "special": clean_stat(get_char(p, CHAR_LA_SPECIAL, ns)),
                    }
                    # Clean up type/special if empty
                    if not asset["type"] or asset["type"] == "-":
                        asset["type"] = "K"
                    if not asset["special"]:
                        asset["special"] = "-"
                    asset_list.append(asset)

                elif type_name == "Launch Asset" and p.get("typeId") == PROFILE_LAUNCH_FIGHTER:
                    asset = {
                        "name": p.get("name", ""),
                        "thrust": clean_stat(get_char(p, CHAR_LF_THRUST, ns)),
                        "ksReroll": clean_stat(get_char(p, CHAR_LF_KS_REROLL, ns)),
                    }
                    asset_list.append(asset)

        if asset_list:
            assets.append({
                "id": entry_id,
                "name": "Launch Assets",
                "assets": asset_list,
            })

    return assets


# ------------------------------------------------------------------
# Space Station extraction (from linked catalogues)
# ------------------------------------------------------------------

def extract_space_stations_from_linked_cat(root, ns, gst_rules):
    """Extract space station data from a linked catalogue."""
    stations = []

    for se in root.findall(f".//{ns}selectionEntry"):
        cats = get_category_ids(se, ns)
        if CAT_SPACE_STATIONS not in cats:
            continue

        station_profile = None
        for p in se.findall(f"./{ns}profiles/{ns}profile"):
            if p.get("typeName") == "Space Station" or p.get("typeId") == PROFILE_SPACE_STATION:
                station_profile = p
                break

        if station_profile is None:
            continue

        cost = get_cost(se, ns)
        name = se.get("name", "")
        eid = se.get("id", "")

        stats = {
            "scan": clean_stat(get_char(station_profile, CHAR_SS_SCAN, ns)),
            "sig": clean_stat(get_char(station_profile, CHAR_SS_SIG, ns)),
            "hull": parse_hull(get_char(station_profile, CHAR_SS_HULL, ns)),
            "es": clean_stat(get_char(station_profile, CHAR_SS_ES, ns)),
            "ks": clean_stat(get_char(station_profile, CHAR_SS_KS, ns)),
            "bs": clean_stat(get_char(station_profile, CHAR_SS_BS, ns)),
            "g": clean_stat(get_char(station_profile, CHAR_SS_G, ns)),
            "special": clean_stat(get_char(station_profile, CHAR_SS_SPECIAL, ns)),
        }

        # Get special rules
        cat_rules = build_shared_rules_index(root, ns)
        special_rules = resolve_special_rules(se, ns, gst_rules, cat_rules)

        station = {
            "id": eid,
            "name": name,
            "cost": cost,
            "stats": stats,
            "specialRules": special_rules,
        }
        stations.append(station)

    return stations


# ------------------------------------------------------------------
# Deployable Feature extraction
# ------------------------------------------------------------------

def extract_deployable_features(root, ns, gst_rules, cat_rules):
    """Extract deployable features from the catalogue."""
    features = []

    # Search all selectionEntry elements (both in sharedSelectionEntries and elsewhere)
    for se in root.findall(f".//{ns}selectionEntry"):
        if se.get("type") != "unit":
            continue
        cats = get_category_ids(se, ns)
        if CAT_DEPLOY_FEAT_UNIT not in cats:
            continue

        eid = se.get("id", "")
        name = se.get("name", "")
        cost = get_cost(se, ns)

        feature_profiles = []
        rules = []

        # Look for nested model entries with Feature profiles
        for model in se.findall(f"./{ns}selectionEntries/{ns}selectionEntry"):
            if model.get("type") != "model":
                continue

            # Extract Feature profiles (typeName="Feature")
            for p in model.findall(f"./{ns}profiles/{ns}profile"):
                tn = p.get("typeName", "")
                if tn == "Feature":
                    # Get characteristics by name (these use different typeIds per catalogue)
                    es_val = "-"
                    ks_val = "-"
                    special_val = "-"
                    for c in p.findall(f".//{ns}characteristic"):
                        cname = c.get("name", "")
                        ctext = (c.text or "").strip()
                        if cname == "ES":
                            es_val = ctext or "-"
                        elif cname == "KS":
                            ks_val = ctext or "-"
                        elif cname == "Special":
                            special_val = ctext or "-"
                    fp = {
                        "name": p.get("name", ""),
                        "es": es_val,
                        "ks": ks_val,
                        "special": special_val,
                    }
                    feature_profiles.append(fp)

            # Get rules embedded directly as <rules><rule> elements
            for r in model.findall(f"./{ns}rules/{ns}rule"):
                rule_name = r.get("name", "")
                desc_el = r.find(f"{ns}description")
                desc = ""
                if desc_el is not None and desc_el.text:
                    desc = desc_el.text.strip()
                rules.append({"name": rule_name, "description": desc})

            # Also get rules from infoLinks
            model_rules = resolve_special_rules(model, ns, gst_rules, cat_rules)
            for r in model_rules:
                if r["name"] not in {rr["name"] for rr in rules}:
                    rules.append(r)

        # Also check the top-level entry's own embedded rules
        for r in se.findall(f"./{ns}rules/{ns}rule"):
            rule_name = r.get("name", "")
            if rule_name not in {rr["name"] for rr in rules}:
                desc_el = r.find(f"{ns}description")
                desc = ""
                if desc_el is not None and desc_el.text:
                    desc = desc_el.text.strip()
                rules.append({"name": rule_name, "description": desc})

        if feature_profiles or rules:
            features.append({
                "id": eid,
                "name": name,
                "cost": cost,
                "features": feature_profiles,
                "rules": rules,
            })

    return features


# ------------------------------------------------------------------
# Parse .gst for shared rules
# ------------------------------------------------------------------

def parse_gst(gst_path):
    """Parse the game system .gst file for shared rules and objectives."""
    tree = ET.parse(gst_path)
    root = tree.getroot()
    ns = NS_GST

    # Extract shared rules
    shared_rules = {}
    rules_index = {}
    for rule in root.findall(f".//{ns}sharedRules/{ns}rule"):
        name = rule.get("name", "")
        rid = rule.get("id", "")
        desc_el = rule.find(f"{ns}description")
        if desc_el is None:
            desc_el = rule.find("description")
        desc = ""
        if desc_el is not None and desc_el.text:
            desc = desc_el.text.strip()
        if name:
            entry = {"description": desc}
            page = rule.get("page", "")
            if page:
                entry["page"] = page
            shared_rules[name] = entry
        if rid:
            rules_index[rid] = rule

    # Extract objectives from the "Secondary Objectives" entry group
    objectives = []
    for seg in root.findall(f".//{ns}selectionEntryGroup"):
        if seg.get("name") == "Secondary Objectives":
            for se in seg.findall(f"./{ns}selectionEntries/{ns}selectionEntry"):
                for p in se.findall(f"./{ns}profiles/{ns}profile"):
                    if p.get("typeName") == "Objective":
                        obj_name = p.get("name", "")
                        desc_char = ""
                        for c in p.findall(f".//{ns}characteristic"):
                            if c.get("name") == "Description":
                                desc_char = (c.text or "").strip()
                                break
                        objectives.append({
                            "name": obj_name,
                            "description": desc_char,
                        })

    return shared_rules, rules_index, objectives, root


# ------------------------------------------------------------------
# Parse a .cat file for a faction
# ------------------------------------------------------------------

def process_unit_entries(entries, ns, shared_entries, shared_profiles,
                         shared_entry_groups, gst_rules_index, cat_rules,
                         source_name=None, faction_key=None):
    """Process a list of unit selectionEntry elements into admirals and groups."""
    admirals = []
    groups = []

    for se in entries:
        if se.get("type") != "unit":
            continue

        entry_name = se.get("name", "")
        entry_id = se.get("id", "")

        # Check faction-specific exclusions for linked catalogue ships
        if faction_key and entry_id in LINKED_SHIP_EXCLUSIONS:
            if faction_key in LINKED_SHIP_EXCLUSIONS[entry_id]:
                continue

        # Skip dividers
        if entry_name.startswith("-----"):
            continue

        cats = get_category_ids(se, ns)

        # Skip space stations, deployable features, and reference entries
        if CAT_SPACE_STATIONS in cats:
            continue
        if CAT_DEPLOY_FEAT_UNIT in cats:
            continue
        if "dbff-12ce-7e10-7001" in cats:  # Reference category
            continue

        # Determine if this is an admiral or a ship group
        is_admiral = CAT_ADMIRALS in cats
        is_famous = CAT_FAMOUS_ADMIRALS in cats

        if is_admiral or is_famous:
            admiral = extract_admiral(
                se, ns, shared_entries, shared_profiles,
                shared_entry_groups, gst_rules_index, cat_rules, is_famous
            )
            if admiral:
                admirals.append(admiral)
        else:
            # Ship group
            group_cat = "medium"
            for cat_id_check, cat_name_check in GROUP_CATEGORY_MAP.items():
                if cat_id_check in cats:
                    group_cat = cat_name_check
                    break

            # Find the model entry inside
            for model in se.findall(f"./{ns}selectionEntries/{ns}selectionEntry"):
                if model.get("type") == "model":
                    ship = extract_ship_from_model(
                        model, ns, shared_entries, shared_profiles,
                        shared_entry_groups, gst_rules_index, cat_rules
                    )
                    if ship:
                        group_entry = {
                            "id": entry_id,
                            "name": entry_name,
                            "category": group_cat,
                            "ship": ship,
                        }
                        groups.append(group_entry)
                    break

    return admirals, groups


def parse_linked_catalogue(cat_path, ns, gst_rules_index):
    """Parse a linked catalogue (Civilian, Misc, etc.) and return its data."""
    if not cat_path.exists():
        return [], {}, {}, {}, {}, {}

    tree = ET.parse(cat_path)
    root = tree.getroot()

    shared_entries = build_shared_entries_index(root, ns)
    shared_profiles = build_shared_profiles_index(root, ns)
    cat_rules = build_shared_rules_index(root, ns)
    shared_entry_groups = build_shared_entry_groups_index(root, ns)

    # Index all entries
    for se in root.findall(f".//{ns}selectionEntry"):
        eid = se.get("id", "")
        if eid and eid not in shared_entries:
            shared_entries[eid] = se

    # Get top-level unit entries
    unit_entries = []
    for se in root.findall(f"./{ns}sharedSelectionEntries/{ns}selectionEntry"):
        if se.get("type") == "unit":
            unit_entries.append(se)

    return unit_entries, shared_entries, shared_profiles, cat_rules, shared_entry_groups, root


def parse_catalogue(cat_path, gst_rules_index, gst_root, faction_key=None):
    """Parse a faction .cat file and extract all data."""
    tree = ET.parse(cat_path)
    root = tree.getroot()
    ns = NS_CAT

    cat_name = root.get("name", "")
    cat_id = root.get("id", "")

    # Build indices for the main catalogue
    shared_entries = build_shared_entries_index(root, ns)
    shared_profiles = build_shared_profiles_index(root, ns)
    cat_rules = build_shared_rules_index(root, ns)
    shared_entry_groups = build_shared_entry_groups_index(root, ns)

    # Also index inline entries
    for se in root.findall(f".//{ns}selectionEntry"):
        eid = se.get("id", "")
        if eid and eid not in shared_entries:
            shared_entries[eid] = se

    # Process main catalogue entries
    main_entries = list(root.findall(f"./{ns}sharedSelectionEntries/{ns}selectionEntry"))
    admirals, groups = process_unit_entries(
        main_entries, ns, shared_entries, shared_profiles,
        shared_entry_groups, gst_rules_index, cat_rules,
        faction_key=faction_key
    )

    # Process linked catalogues (Civilian, Misc, etc.)
    linked_cat_names = {}
    for cl in root.findall(f"./{ns}catalogueLinks/{ns}catalogueLink"):
        link_name = cl.get("name", "")
        link_target = cl.get("targetId", "")
        if link_name and link_target:
            linked_cat_names[link_name] = link_target

    for link_name in linked_cat_names:
        # Skip Fleet Space Stations (handled separately)
        if link_name == "Fleet Space Stations":
            continue

        linked_path = BSDATA_DIR / f"{link_name}.cat"
        if not linked_path.exists():
            continue

        (linked_entries, linked_shared_entries, linked_shared_profiles,
         linked_cat_rules, linked_entry_groups, linked_root) = parse_linked_catalogue(
            linked_path, ns, gst_rules_index
        )

        if linked_entries:
            # Merge linked indices into main indices for resolution
            merged_entries = {**shared_entries, **linked_shared_entries}
            merged_profiles = {**shared_profiles, **linked_shared_profiles}
            merged_rules = {**cat_rules, **linked_cat_rules}
            merged_groups = {**shared_entry_groups, **linked_entry_groups}

            linked_admirals, linked_groups = process_unit_entries(
                linked_entries, ns, merged_entries, merged_profiles,
                merged_groups, gst_rules_index, merged_rules,
                source_name=link_name, faction_key=faction_key
            )
            admirals.extend(linked_admirals)
            groups.extend(linked_groups)

    # Extract launch assets
    launch_assets = extract_launch_assets(root, ns)

    # Extract space stations from Fleet Space Stations catalogue
    space_stations = []
    ss_cat_path = BSDATA_DIR / "Fleet Space Stations.cat"
    if ss_cat_path.exists():
        ss_tree = ET.parse(ss_cat_path)
        ss_root = ss_tree.getroot()
        ss_rules = build_shared_rules_index(ss_root, ns)
        all_stations = extract_space_stations_from_linked_cat(ss_root, ns, gst_rules_index)

        # Filter stations: base stations (shared by all) + faction-specific
        allowed_ids = set(BASE_STATION_IDS)
        if faction_key and faction_key in FACTION_STATION_IDS:
            allowed_ids |= FACTION_STATION_IDS[faction_key]

        for st in all_stations:
            if st.get("id", "") in allowed_ids:
                space_stations.append(st)

    # Extract deployable features
    deployable_features = extract_deployable_features(root, ns, gst_rules_index, cat_rules)

    return {
        "cat_id": cat_id,
        "cat_name": cat_name,
        "admirals": admirals,
        "groups": groups,
        "launchAssets": launch_assets,
        "spaceStations": space_stations,
        "deployableFeatures": deployable_features,
    }


# ------------------------------------------------------------------
# Merge lore data
# ------------------------------------------------------------------

def merge_lore(faction_data, faction_key, lore_data):
    """Merge lore data into faction data."""
    if faction_key not in lore_data:
        return

    faction_lore = lore_data[faction_key]

    # Merge lore into admirals (famous admirals)
    for admiral in faction_data.get("admirals", []):
        if admiral.get("isFamous"):
            # Try "Name - Ship" format
            flagship = admiral.get("flagship")
            if flagship:
                ship_name = flagship.get("name", "")
                admiral_name = admiral.get("name", "")
                lore_key = f"{admiral_name} - {ship_name}"
                if lore_key in faction_lore:
                    admiral["lore"] = faction_lore[lore_key]
                    if flagship:
                        flagship["lore"] = faction_lore[lore_key]

    # Merge lore into ship groups
    for group in faction_data.get("groups", []):
        ship = group.get("ship", {})
        ship_name = ship.get("name", "")
        # Try full group name first, then ship name
        group_name = group.get("name", "")

        # Strip common suffixes to match lore keys
        for lore_key_candidate in [group_name, ship_name]:
            # Try exact match first
            if lore_key_candidate in faction_lore:
                ship["lore"] = faction_lore[lore_key_candidate]
                break
            # Try stripping plurals and class suffixes
            base = lore_key_candidate
            for suffix in [" Cruisers", " Battlecruiser", " Battleship", " Destroyers",
                           " Frigates", " Corvettes", " Cutters", " Monitors",
                           " Carriers", " Lighters", " Harassers", "s"]:
                if base.endswith(suffix):
                    base_stripped = base[:-len(suffix)]
                    if base_stripped in faction_lore:
                        ship["lore"] = faction_lore[base_stripped]
                        break
            if "lore" in ship:
                break


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

def main():
    print("BattleScribe XML to fleet-data.json converter")
    print("=" * 50)

    # Check paths
    gst_path = BSDATA_DIR / "dropfleet-commander-2024.gst"
    if not gst_path.exists():
        print(f"ERROR: Game system file not found: {gst_path}")
        sys.exit(1)

    # Parse game system
    print(f"\nParsing game system: {gst_path.name}")
    shared_rules, gst_rules_index, objectives, gst_root = parse_gst(gst_path)
    print(f"  Shared rules: {len(shared_rules)}")
    print(f"  Objectives: {len(objectives)}")

    # Hardcoded game system data (stable values from the .gst modifiers)
    game_system = {
        "gameSizes": {
            "skirmish": {
                "label": "Skirmish",
                "min": 501,
                "max": 1000,
                "maxGroups": 16,
                "maxColossalGroups": 0,
                "maxAdmiralLevel": 2,
            },
            "clash": {
                "label": "Clash",
                "min": 1001,
                "max": 2000,
                "maxGroups": 20,
                "maxColossalGroups": 1,
                "maxAdmiralLevel": 3,
            },
            "battle": {
                "label": "Battle",
                "min": 2001,
                "max": 3000,
                "maxGroups": 24,
                "maxColossalGroups": 2,
                "maxAdmiralLevel": 4,
            },
            "reconquest": {
                "label": "Reconquest",
                "min": 3001,
                "max": -1,
                "maxGroups": 28,
                "maxColossalGroups": 3,
                "maxAdmiralLevel": 5,
            },
        },
        "admiralLevels": [
            {"level": 2, "cost": 20},
            {"level": 3, "cost": 40},
            {"level": 4, "cost": 60},
            {"level": 5, "cost": 80},
        ],
        "objectives": objectives,
    }

    # Load lore data
    lore_data = {}
    if LORE_PATH.exists():
        print(f"\nLoading lore data: {LORE_PATH.name}")
        with open(LORE_PATH, "r", encoding="utf-8") as f:
            lore_data = json.load(f)
        total_lore = sum(len(v) for v in lore_data.values())
        print(f"  Lore entries: {total_lore}")

    # Process each faction
    factions = {}
    total_ships = 0
    total_admirals = 0

    for cat_file in sorted(BSDATA_DIR.glob("*.cat")):
        cat_name_raw = cat_file.stem
        if cat_name_raw not in FACTION_MAP:
            continue

        faction_key = FACTION_MAP[cat_name_raw]
        short_name = FACTION_SHORT[cat_name_raw]

        print(f"\nParsing faction: {cat_name_raw} -> {faction_key}")

        faction_data = parse_catalogue(cat_file, gst_rules_index, gst_root, faction_key=faction_key)

        # Merge lore
        merge_lore(faction_data, faction_key, lore_data)

        # Build faction output
        faction = {
            "id": faction_data["cat_id"],
            "name": cat_name_raw,
            "shortName": short_name,
            "admirals": faction_data["admirals"],
            "groups": faction_data["groups"],
            "launchAssets": faction_data["launchAssets"],
            "spaceStations": faction_data["spaceStations"],
            "deployableFeatures": faction_data["deployableFeatures"],
        }

        factions[faction_key] = faction

        ship_count = len(faction_data["groups"])
        admiral_count = len(faction_data["admirals"])
        famous_count = sum(1 for a in faction_data["admirals"] if a.get("isFamous"))
        regular_count = admiral_count - famous_count

        total_ships += ship_count
        total_admirals += admiral_count

        print(f"  Ship groups: {ship_count}")
        print(f"  Admirals: {admiral_count} ({regular_count} regular, {famous_count} famous)")
        print(f"  Launch asset sets: {len(faction_data['launchAssets'])}")
        print(f"  Space stations: {len(faction_data['spaceStations'])}")
        print(f"  Deployable features: {len(faction_data['deployableFeatures'])}")

    # Build final output
    output = {
        "gameSystem": game_system,
        "sharedRules": shared_rules,
        "factions": factions,
    }

    # Write output
    os.makedirs(OUTPUT_PATH.parent, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 50}")
    print(f"Output written to: {OUTPUT_PATH}")
    print(f"Total factions: {len(factions)}")
    print(f"Total ship groups: {total_ships}")
    print(f"Total admirals: {total_admirals}")
    print(f"File size: {OUTPUT_PATH.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
