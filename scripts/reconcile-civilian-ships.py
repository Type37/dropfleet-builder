# Reconcile OBV-64 Oblivion Barge + Type-87 Terminus Harvester to the verbatim
# Civilian_Ships_Scenarios_260501 profiles ("the PDF is king"). These two cross-faction
# mercenary ships appear in every faction file (+ the merged fleet-data mirror).
import json, glob

# Verbatim rule descriptions from the Civilian PDF.
DESC = {
  'Boardable': ("This Ship can have Battalions Assigned to it as if it were a Space Station.\n"
    "At the start of the round, this Ship is controlled by a Player if only they have any Battalions on it, "
    "lasting until the end of the round.\nPlayers that control a Boardable Ship may activate it as if it were "
    "a Ship in their Fleet, after all other Groups have activated."),
  'Civilian Transport': ("This Ship can only choose the General Quarters order.\nThis Ship cannot be attacked "
    "unless it is controlled by a player. Players cannot attack a friendly Civilian Transport.\nThis Ship "
    "cannot be the target of Abilities."),
  'Expel Hazards': ("This weapon can only be used against targets within Scan range and on the same Orbital "
    "Layer.\nWhile this Ship is below its starting Hull Points, for every 2 Hull Points lost from its starting "
    "Hull Points, increase the attack of this weapon by 1."),
  'Acquired Mines': "This Ship's Mines use the stats of its parent fleet.",
  'Mercenary (OBV)': ("This Ship may be used in any fleet regardless of faction. When taken as part of your "
    "fleet, this Ship loses its Boardable and Civilian Transport rules."),
  'Mercenary (T87)': ("This Ship may be used in any Fleet regardless of faction. When taken as part of your "
    "fleet, this Ship loses its Boardable rule."),
  'Colossal Salvage Cutter': "This weapon can only be used against targets in base contact.",
  'Scrap Hauler': ("If this Group ends its activation within 1\" of a Debris Field, this Group gains a scrap "
    "token and cannot gain scrap tokens from that Debris Field for the rest of the game. A Group can have a "
    "maximum of 8 scrap tokens at any one time. Any attached Payload ships that have any scrap tokens do not "
    "count towards this limit. Whenever another Ship within 6\" of a friendly Ship with this rule is destroyed, "
    "pick one of those friendly Ships, that Ship gains a scrap token."),
  'Scratch Bodge Job': ("At the end of this Ship's activation, you may remove any number of scrap tokens and "
    "choose one of the following:\nScrappy Plating: One friendly Ship within 6\" recovers lost Hull points "
    "equal to the amount of scrap tokens removed.\nBodge Repairs: Remove a crippling effect from a friendly "
    "Ship within 6\" for each scrap token removed."),
}

def rule(name, existing, desc=None):
    """Reuse the existing description (exact bytes) if present, else the verbatim one.
    Reused standard rules (Porter F-2, Monitor, Rare, Reinforced Armour, Industrial
    Design) that aren't on this copy fall back to '' — the app resolves them from the
    shared rules glossary at runtime."""
    if name in existing:
        return {'name': name, 'description': existing[name]}
    return {'name': name, 'description': desc if desc is not None else DESC.get(name, '')}

def reconcile_ship(ship, kind):
    existing = {r['name']: r.get('description', '') for r in ship.get('specialRules', []) if r.get('name')}
    if kind == 'OBV':
        ship['stats']['special'] = 'Boardable, Civilian Transport, Rare, Reinforced Armour'
        ship['specialRules'] = [
            rule('Boardable', existing), rule('Civilian Transport', existing),
            rule('Rare', existing), rule('Reinforced Armour', existing),
            rule('Expel Hazards', existing), rule('Acquired Mines', existing),
            {'name': 'Mercenary', 'description': DESC['Mercenary (OBV)']},
        ]
    else:  # Type-87
        ship['stats']['special'] = 'Boardable, Porter F-2, Reinforced Armour, Monitor'
        ship['specialRules'] = [
            rule('Boardable', existing), rule('Porter F-2', existing),
            rule('Reinforced Armour', existing), rule('Monitor', existing),
            rule('Colossal Salvage Cutter', existing), rule('Scrap Hauler', existing),
            rule('Scratch Bodge Job', existing), rule('Industrial Design', existing),
            {'name': 'Mercenary', 'description': DESC['Mercenary (T87)']},
        ]

TARGETS = {'OBV-64 Oblivion Barge': 'OBV', 'Type-87 Terminus Harvester': 'T87'}
total = 0
for fp in glob.glob('data/faction-*.json') + ['data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    changed = 0
    def walk(o):
        global changed
        if isinstance(o, dict):
            if o.get('name') in TARGETS and isinstance(o.get('ship'), dict):
                reconcile_ship(o['ship'], TARGETS[o['name']]); changed += 1
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    if changed:
        json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
        total += changed
        print(f'{fp}: {changed}')
print('TOTAL ship entries updated:', total)
