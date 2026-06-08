#!/usr/bin/env python3
"""
Add 1-2 sentence `namesake` definitions to Scourge and Resistance ships.

Scourge ships are named for demons and mythological monsters; Resistance ships
for explorers, astronauts, admirals, famous warships, and figures of Rome.
The renderer (desktop + mobile) prepends a "Namesake" label, so the field holds
just the definition. Type-code hulls (DH-Type, LKS, OBV-64...) and pure role
words (Pathfinder, Explorer, Coloniser) have no namesake and are skipped.

Re-runnable: only sets a namesake on a ship whose class-name (first word)
matches and that doesn't already have one. Writes back in the source's compact
(minified) JSON so the diff is limited to the changed ships.

Usage:  python scripts/add-namesakes.py
"""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "data")

NAMESAKES = {
    "scourge": {
        "Akuma": "In Japanese belief, an akuma is a malevolent fire-spirit or demon that brings misfortune and ruin.",
        "Bael": "Bael (or Baal), a king of Hell and the first spirit named in the Lesser Key of Solomon, commanding legions of demons.",
        "Banshee": "A wailing female spirit of Irish folklore whose mournful cry in the night foretells a coming death.",
        "Beelzebub": "A prince of Hell whose name means 'Lord of the Flies', ranked among the chief demons and tied to the sin of gluttony.",
        "Charybdis": "A monstrous Greek whirlpool that swallowed the sea three times a day, lurking opposite the man-eating Scylla.",
        "Chimera": "A fire-breathing Greek monster stitched from lion, goat and serpent, slain by the hero Bellerophon.",
        "Cthulhu": "H.P. Lovecraft's cosmic monster-god, slumbering in the sunken city of R'lyeh and driving mad any who glimpse it.",
        "Daemon": "From the Greek 'daimon', a spirit standing between gods and mortals; in later lore, a demon outright.",
        "Devil": "The Devil, supreme spirit of evil and adversary of the divine across Christian and folk tradition.",
        "Djinn": "A djinn (genie), a spirit of smokeless fire in Arabian myth, able to grant wishes or work terrible harm.",
        "Dragon": "The dragon, the great winged serpent of myth the world over, hoarder of treasure and breather of fire.",
        "Ebisu": "One of Japan's Seven Lucky Gods, Ebisu is the patron of fishermen and good fortune, often shown with a sea bream.",
        "Faust": "Dr. Faust, the legendary scholar who sold his soul to the devil Mephistopheles for knowledge and power.",
        "Gargoyle": "The grotesque stone beast perched on medieval cathedrals to spout rainwater and, in legend, ward off evil.",
        "Gremlin": "A mischievous gremlin, the imp blamed by airmen for unexplained mechanical faults and sabotage.",
        "Harpy": "A harpy, the winged woman-bird of Greek myth who snatched away food and souls upon storm winds.",
        "Hiruko": "Hiruko, the 'leech child' of Shinto myth, a malformed deity set adrift on the sea by its divine parents.",
        "Hydra": "The Lernaean Hydra, the Greek serpent that sprouted two heads for each one severed, slain by Heracles.",
        "Ifrit": "An ifrit, a powerful and cunning fire-demon of Arabian myth, among the most fearsome classes of djinn.",
        "Incubus": "An incubus, a demon of European folklore that preys upon sleepers in the dead of night.",
        "Kulshedra": "A fire-spitting she-dragon of Albanian myth, a vast serpent that hoards drought until a hero slays it.",
        "Lamassu": "An Assyrian guardian spirit, a colossal winged bull with a human head, set at palace gates to repel evil.",
        "Lucifer": "Lucifer, the 'light-bringer', proudest of the angels cast out of Heaven and identified with Satan.",
        "Nephilim": "The Nephilim, the giant offspring of the 'sons of God' and mortal women in the Book of Genesis.",
        "Nickar": "A nicker (or nixie), a shape-shifting water-spirit of Germanic folklore that lures travellers to drown.",
        "Nosferatu": "Nosferatu, the archaic name for a vampire, made famous by the 1922 silent film of the same name.",
        "Raiju": "A beast of lightning in Japanese myth, a creature of fire and storm that leaps with the thunderbolt.",
        "Raum": "Raum, a Great Earl of Hell in demonology who appears as a crow and steals treasures from kings.",
        "Revenant": "A revenant, a corpse risen from the grave in medieval folklore to torment the living.",
        "Samael": "Samael, the dread angel of death and venom in Jewish lore, at once accuser, destroyer and seducer.",
        "Scylla": "A six-headed Greek sea monster that plucked sailors from the cliffs, paired with the whirlpool Charybdis.",
        "Shedu": "A Mesopotamian protective spirit, a winged bull-man set as a guardian upon the thresholds of palaces.",
        "Shenlong": "A spiritual dragon of Chinese myth, master of wind and rain whose moods bring storm or drought.",
        "Sphinx": "The Sphinx, the lion-bodied riddler of Greek myth who devoured any traveller that failed her riddle.",
        "Strix": "A strix, the screech-owl of Roman myth believed to feed by night on the flesh and blood of the unwary.",
        "Succubus": "A succubus, a female demon of European folklore that visits and drains sleeping men.",
        "Umbra": "Latin for 'shade' or 'shadow' - the umbra was also a ghost, the lingering spirit of the dead.",
        "Wraith": "A wraith, a ghostly apparition of Scottish lore whose appearance often heralds a death.",
        "Wyvern": "A wyvern, the two-legged winged dragon of European heraldry, fierce and venom-tailed.",
        "Yokai": "Yokai, the vast family of supernatural creatures and spirits of Japanese folklore.",
    },
    "resistance": {
        "Aldrin": "Buzz Aldrin (born 1930), the Apollo 11 lunar-module pilot and the second human to walk on the Moon.",
        "Armstrong": "Neil Armstrong (1930-2012), commander of Apollo 11 and the first human to set foot on the Moon, in 1969.",
        "Collins": "Michael Collins (1930-2021), the Apollo 11 command-module pilot who orbited the Moon alone while his crewmates landed.",
        "Baleares": "The Balearic Islands, whose slingers were prized as deadly skirmishers in the armies of Carthage and Rome.",
        "Barbarossa": "Hayreddin Barbarossa (c.1478-1546), the corsair who became grand admiral of the Ottoman fleet and ruled the Mediterranean.",
        "Centurion": "A centurion, the hardened professional officer who commanded a century of some eighty legionaries in the Roman army.",
        "Drake": "Sir Francis Drake (c.1540-1596), the English privateer and explorer, second to circumnavigate the globe and scourge of Spain.",
        "Farragut": "David Farragut (1801-1870), the first admiral of the US Navy, remembered for 'Damn the torpedoes, full speed ahead.'",
        "Galileo": "Galileo Galilei (1564-1642), the Italian astronomer whose telescope revealed Jupiter's moons and remade our view of the heavens.",
        "Gladiator": "A gladiator, the armed fighter who battled for the crowd's favour in the arenas of ancient Rome.",
        "Guy": "Guy Fawkes (1570-1606), the conspirator caught beneath Parliament with the gunpowder meant to blow it sky-high in 1605.",
        "Iowa": "USS Iowa (BB-61), lead ship of the US Navy's last class of battleships, famed for her nine 16-inch guns.",
        "Lexington": "USS Lexington, the US aircraft carrier nicknamed 'Lady Lex', lost in the Battle of the Coral Sea in 1942.",
        "Munifex": "A munifex, the ordinary Roman legionary liable for the full burden of fatigues and labour.",
        "Musashi": "The Japanese battleship Musashi, among the two largest ever built, sunk under a hail of US air attacks in 1944.",
        "Nelson": "Admiral Horatio Nelson (1758-1805), who shattered the Franco-Spanish fleet at Trafalgar and died in the hour of victory.",
        "Newton": "Sir Isaac Newton (1642-1727), who set down the laws of motion and gravitation that govern every ship's course.",
        "Nimitz": "Fleet Admiral Chester Nimitz (1885-1966), commander of US naval forces across the Pacific in the Second World War.",
        "Palatine": "The Palatine, the Roman hill at the heart of the city where the emperors raised their palaces - the root of the word itself.",
        "Phalanx": "The phalanx, the dense wall of spears and shields with which Greek and Macedonian armies broke their foes.",
        "Sagitarii": "The sagittarii, the auxiliary archers who lent ranged firepower to the close-packed ranks of the Roman legions.",
        "Senator": "A senator, one of the elder statesmen of the Roman Senate, the council that steered the Republic and Empire.",
        "Seneca": "Seneca the Younger (c.4 BC-AD 65), the Roman Stoic philosopher and statesman, tutor to Nero and forced to take his own life.",
        "Tribune": "A tribune, a senior Roman officer of the legions, or the people's elected champion against the power of the Senate.",
        "Triumvir": "A triumvir, one of the three men who shared supreme power in Rome's triumvirates, such as Caesar, Pompey and Crassus.",
        "Vanguard": "HMS Vanguard, the last and largest battleship ever built for the Royal Navy, completed just after the Second World War.",
        "Yamamoto": "Isoroku Yamamoto (1884-1943), the Japanese admiral who conceived and directed the attack on Pearl Harbor.",
        "Yi": "Yi Sun-sin (1545-1598), the Korean admiral whose armoured 'turtle ships' crushed far larger Japanese fleets without a single defeat.",
    },
    "shaltari": {
        "Actinium": "A rare, silvery radioactive metal that glows pale blue in the dark and lends its name to the actinide series.",
        "Amber": "Fossilised tree resin, warm and golden, that sometimes preserves insects trapped within it millions of years ago.",
        "Amethyst": "The violet variety of quartz, long worn as a gemstone and once believed to guard against drunkenness.",
        "Aquamarine": "A sea-blue gem of the beryl family, prized for its clarity and named for the colour of seawater.",
        "Azurite": "A deep-blue copper mineral, once ground into one of the most precious blue pigments of the old masters.",
        "Basalt": "A dark, fine-grained volcanic rock - the most common stone of the planet's crust and ocean floors.",
        "Boracite": "A hard borate mineral, usually colourless to green, that forms within beds of salt and gypsum.",
        "Bronze": "The alloy of copper and tin whose mastery gave its name to an entire age of human history.",
        "Caesium": "A soft, golden alkali metal so reactive it ignites in air; its atomic vibrations define the modern second.",
        "Cerium": "The most abundant of the rare-earth metals, iron-grey and reactive, used to polish glass and spark lighter flints.",
        "Chromium": "A hard, lustrous metal that resists tarnish; its name comes from the Greek for 'colour', for its vivid compounds.",
        "Citrine": "The golden-yellow variety of quartz, named for the citron fruit it resembles in hue.",
        "Cobalt": "A hard, silver-blue metal that has coloured glass and ceramics a deep blue for thousands of years.",
        "Copper": "A reddish, highly conductive metal, one of the first ever worked by human hands.",
        "Diamond": "The hardest natural material known, a crystal of pure carbon forged under immense heat and pressure.",
        "Emerald": "The brilliant green gem of the beryl family, valued since antiquity above almost all other stones.",
        "Euclase": "A rare, pale blue-green gemstone whose name, Greek for 'easily broken', warns of its fragile cleavage.",
        "Gallium": "A soft, silvery metal that melts in the warmth of a human hand, just above room temperature.",
        "Glass": "A hard, brittle, transparent solid, prized for millennia for windows, lenses and vessels.",
        "Goethite": "A brown-to-yellow iron mineral and major ore of iron, named after the poet Goethe.",
        "Gold": "The dense, untarnishing yellow metal that has served as treasure and currency across every civilisation.",
        "Granite": "A hard, coarse-grained igneous rock of quartz and feldspar - the bedrock of the continents.",
        "Helium": "The second-lightest element, an inert gas born in the hearts of stars and lighter than air.",
        "Hematite": "A metallic grey-to-red iron ore that takes a mirror polish; its name comes from the Greek for 'blood'.",
        "Iridium": "One of the densest, most corrosion-resistant metals, scattered worldwide in the layer left by the asteroid that ended the dinosaurs.",
        "Iron": "The workhorse metal at the heart of steel, of planets, and of red blood itself.",
        "Jade": "A tough green ornamental stone, carved and revered above gold in ancient China and Mesoamerica.",
        "Jet": "A deep-black gem of fossilised wood, polished for mourning jewellery in the Victorian age.",
        "Lanthanum": "A soft, silvery rare-earth metal that gives its name to the lanthanide series and brightens camera lenses.",
        "Mercury": "The only metal liquid at room temperature, a shimmering silver fluid once called quicksilver.",
        "Mesolite": "A delicate, needle-like white zeolite mineral that forms in the cavities of volcanic rock.",
        "Natrolite": "A white-to-colourless zeolite that grows in slender radiating crystals; its name nods to its sodium content.",
        "Obsidian": "A jet-black volcanic glass that fractures to edges sharper than steel, knapped into blades since the Stone Age.",
        "Onyx": "A banded variety of agate, classically black, carved for cameos and seals since antiquity.",
        "Opal": "A gem that scatters light into shifting fires of colour, formed from silica laid down over ages.",
        "Painite": "Once the rarest mineral on the planet, a borate gem so scarce that only a handful of crystals were known for decades.",
        "Platinum": "A dense, precious, silver-white metal, prized for jewellery and as a catalyst, and rarer than gold.",
        "Plutonium": "A heavy, radioactive metal forged in reactors, warm to the touch from its own decay.",
        "Ruby": "The blood-red variety of corundum, among the most valued of all coloured gemstones.",
        "Sapphire": "The blue variety of corundum, second only to diamond in hardness among gems.",
        "Scoria": "A dark, bubble-riddled volcanic rock, lighter than it looks for all the gas frozen within it.",
        "Selenium": "A nonmetal that conducts electricity when struck by light - the principle behind the first photocells.",
        "Silicon": "The grey metalloid that, after oxygen, makes up most of the crust, and the foundation of every microchip.",
        "Silver": "The brilliant white precious metal, the finest conductor of electricity and a coin of the realm for ages.",
        "Spinel": "A hard gem found in every colour, long mistaken for ruby - some 'rubies' among the crown jewels are spinels.",
        "Strontium": "A soft, silvery metal whose salts burn a brilliant crimson in fireworks and signal flares.",
        "Thorium": "A weakly radioactive metal, more abundant than uranium and long studied as a nuclear fuel.",
        "Topaz": "A hard gemstone found in golden, blue and pink hues, prized since the ancient world.",
        "Turquoise": "A sky-blue to green stone treasured by ancient Egypt, Persia and the peoples of the Americas alike.",
        "Uranium": "The heavy, radioactive metal whose splitting atoms power reactors and the most destructive of weapons.",
    },
}


def main():
    for faction, table in NAMESAKES.items():
        path = os.path.join(ROOT, f"faction-{faction}.json")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        added = 0
        for g in data.get("groups", []):
            ship = g.get("ship", {})
            name = ship.get("name", "")
            key = name.split()[0] if name else ""
            if key in table and not ship.get("namesake"):
                ship["namesake"] = table[key]
                added += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{faction}: set {added} namesakes")


if __name__ == "__main__":
    main()
