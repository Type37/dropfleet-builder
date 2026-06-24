# Reconcile four more cross-faction civilian/mercenary ships to their verbatim
# Civilian_Ships_Scenarios_260501 profiles (the audit found their specialRules empty
# or incomplete and their stats.special wrong): PRK-91 Provenance Ark (incl. the
# Genesis Spikes / Mutant Fauna rule), M-Type Barge, SLM-9 Resupply Hauler, VX-22
# Flenser. Same approach as reconcile-civilian-ships.py (OBV-64 / Type-87). These
# ships appear in every faction file + the merged fleet-data mirror. "PDF is king."
import json, glob

# Verbatim rule descriptions (from the Civilian PDF). Common rules reuse the same
# wording the OBV-64 reconcile already shipped.
DESC = {
  'Boardable': ("This Ship can have Battalions Assigned to it as if it were a Space Station.\n"
    "At the start of the round, this Ship is controlled by a Player if only they have any Battalions on it, "
    "lasting until the end of the round.\nPlayers that control a Boardable Ship may activate it as if it were "
    "a Ship in their Fleet, after all other Groups have activated."),
  'Civilian Transport': ("This Ship can only choose the General Quarters order.\nThis Ship cannot be attacked "
    "unless it is controlled by a player. Players cannot attack a friendly Civilian Transport.\nThis Ship "
    "cannot be the target of Abilities."),
  'Genesis Spikes': ("When this weapon successfully inflicts any amount of damage against a City, place a Mutant "
    "Fauna token on that Dropsite. Mutant Fauna tokens are not Battalions and cannot control or contest a "
    "Dropsite. When any player deploys any number of Battalions to that Dropsite, if that Dropsite has any Mutant "
    "Fauna tokens, those Battalions are only placed on a roll of a 5+. If any Battalions are not placed this way, "
    "remove a Mutant Fauna token from that Dropsite. If a Dropsite starts a round with a Mutant Fauna token, "
    "remove that token at the end of the round."),
  'Expansive Radiator Systems': "At the start of this Ship's activation, remove two Spikes from it.",
  'Feature Carrier (Outpost)': "This Ship starts the game carrying a Military Outpost as a Deployable Feature.",
  'Resupply and Rearm': ("If this ship ends its movement in base contact with a friendly ship of Medium Tonnage "
    "or higher or a Space Station, pick one of the following:\nResupply: That Ship or Space Station recovers 3 "
    "Hull points and remove any Crippling Effect tokens.\nRearm: Increase the Limited-X value of any of that Ship "
    "or Space Station's Weapons and Launch Assets by 1 until the end of the round."),
  'Flawed Design': "This Ship cannot use its Resupply and Rearm rule if it is below half of its starting Hull.",
  'Scrap Collection': ("If this Ship ends its activation within 1\" of a Debris Field, this Ship gains a scrap "
    "token and cannot gain scrap tokens from that Debris Field for the rest of the game. A Ship with this rule can "
    "have a maximum of 3 scrap tokens at any one time. Whenever another Ship within 6\" of a friendly Ship with "
    "this rule is destroyed, pick one of those friendly Ships, that Ship gains a scrap token."),
  'Unload': "When you attach this Ship to a Porter Ship, you may have the Porter Ship gain all of this Ship's scrap tokens.",
  'Mercenary (loses B+CT)': ("This Ship may be used in any Fleet regardless of faction. When taken as part of your "
    "fleet, this Ship loses its Boardable and Civilian Transport rules."),
  'Mercenary (loses B+CT+FB)': ("This Ship may be used in any Fleet regardless of faction. When taken as part of "
    "your fleet, this Ship loses its Boardable and Civilian Transport rules. This ship's Fighters & Bombers use "
    "the stats of its parent fleet (if you included this ship in a Scourge fleet, its Fighters & Bombers would "
    "follow the Scourge Fighters & Bombers rules)."),
  'Mercenary (loses B)': ("This Ship may be used in any Fleet regardless of faction. When taken as part of your "
    "fleet, this Ship loses its Boardable rule."),
}

def rule(name, existing, desc_key=None):
    """Reuse the exact bytes already on this ship if present (keeps Monitor/Vectored/
    Payload F-1/Industrial Design intact); else use the verbatim text from DESC."""
    if name in existing and (existing[name] or '').strip():
        return {'name': name, 'description': existing[name]}
    return {'name': name, 'description': DESC.get(desc_key or name, '')}

def reconcile(ship, kind):
    ex = {r['name']: r.get('description', '') for r in ship.get('specialRules', []) if r.get('name')}
    if kind == 'PRK':
        ship['stats']['special'] = 'Boardable, Civilian Transport'
        ship['specialRules'] = [
            rule('Boardable', ex), rule('Civilian Transport', ex), rule('Genesis Spikes', ex),
            rule('Expansive Radiator Systems', ex),
            {'name': 'Mercenary', 'description': DESC['Mercenary (loses B+CT+FB)']},
        ]
    elif kind == 'MTYPE':
        ship['stats']['special'] = 'Boardable, Civilian Transport, Monitor'
        ship['specialRules'] = [
            rule('Boardable', ex), rule('Civilian Transport', ex), rule('Monitor', ex),
            rule('Feature Carrier (Outpost)', ex),
            {'name': 'Mercenary', 'description': DESC['Mercenary (loses B+CT)']},
        ]
    elif kind == 'SLM9':
        ship['stats']['special'] = 'Boardable, Vectored'
        ship['specialRules'] = [
            rule('Boardable', ex), rule('Vectored', ex),
            rule('Resupply and Rearm', ex), rule('Flawed Design', ex),
            {'name': 'Mercenary', 'description': DESC['Mercenary (loses B)']},
        ]
    elif kind == 'VX22':
        ship['stats']['special'] = 'Payload F-1, Vectored'
        ship['specialRules'] = [
            rule('Payload F-1', ex), rule('Vectored', ex), rule('Industrial Design', ex),
            rule('Scrap Collection', ex), rule('Unload', ex),
            {'name': 'Mercenary', 'description': DESC['Mercenary (loses B)']},
        ]

TARGETS = {'PRK-91 Provenance Ark': 'PRK', 'M-Type Barge': 'MTYPE',
           'SLM-9 Resupply Hauler': 'SLM9', 'VX-22 Flenser': 'VX22'}
total = 0
for fp in glob.glob('data/faction-*.json') + ['data/fleet-data.json']:
    d = json.load(open(fp, encoding='utf-8'))
    n = 0
    def walk(o):
        global n
        if isinstance(o, dict):
            if o.get('name') in TARGETS and isinstance(o.get('ship'), dict):
                reconcile(o['ship'], TARGETS[o['name']]); n += 1
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    if n:
        json.dump(d, open(fp, 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
        total += n
        print(fp.split('\\')[-1].split('/')[-1], n)
print('TOTAL ship entries reconciled:', total)
