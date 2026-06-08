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


# UCM hulls are named for Earth cities (and a few historical figures). These
# definitions are the user's own hand-written write-ups, transcribed from the
# UCM_ALL TAROT/cards PDF on their Neocities site. Keyed by the city phrase the
# ship name starts with, so multi-word "New X" cities each resolve correctly.
NAMESAKES["ucm"] = {
    "Santiago": "Santiago de Chile was founded in 1541 by Spanish conquistador Pedro de Valdivia on the floodplain between the Mapocho and Maipo rivers; its full official name is Santiago de Nueva Extremadura.",
    "Lysander": "Lysander of Sparta, ancient Greece, was the navarch who destroyed the Athenian fleet at Aegospotami in 405 BC, ending the Peloponnesian War and becoming the first Greek general to receive divine honours in his own lifetime.",
    "Toulon": "Toulon is a port city on the Mediterranean coast of Provence in southern France, home to France's principal naval base since Louis XIV ordered its construction in the seventeenth century.",
    "Taipei": "Taipei became the capital of Taiwan in 1949 when the Republic of China government retreated from the mainland, and today sits in a basin surrounded by volcanic highlands at the northern tip of the island.",
    "Jakarta": "Jakarta served as the capital of Indonesia from independence in 1945 until 2024, when the government formally relocated to the new city of Nusantara on Borneo; Jakarta remains the country's largest city and commercial centre.",
    "Lima": "Lima, Peru served as the seat of the Spanish Viceroyalty of Peru for nearly three centuries — the most powerful administrative centre on the Pacific coast of South America.",
    "Detroit": "Detroit was founded by French explorer Antoine de la Mothe Cadillac in 1701 on the strait between Lakes Erie and Huron, and a century later became the manufacturing centre of the American automobile industry.",
    "Sheffield": "Sheffield is an industrial city in South Yorkshire, England, that became synonymous with steel production during the nineteenth century industrial revolution and lent its name to Sheffield plate silverware worldwide.",
    "New Orleans": "New Orleans was founded by French colonists in 1718 on a crescent of land between Lake Pontchartrain and the Mississippi River, and remained the most significant port in North America for much of the nineteenth century.",
    "Reykjavik": "Reykjavik, Iceland takes its name from the Old Norse for 'Smoky Bay', after the geothermal steam the first Norse settlers observed rising from hot springs on the shore.",
    "Vienna": "Vienna has served as the capital of Austria since the thirteenth century, and from 1558 to 1806 was the seat of the Holy Roman Emperors; the city's Ringstrasse boulevard was constructed in the 1860s to project imperial prestige.",
    "Istanbul": "Istanbul, Turkey has been continuously inhabited for over two thousand years, serving successively as Byzantium, Constantinople, and its current name; it is the only city in the world that spans two continents.",
    "Havana": "Havana, Cuba was established as a Spanish colonial port in 1519 and served for centuries as the principal assembly point for the treasure fleets carrying silver from the Americas back to Spain.",
    "Oslo": "Oslo has been the capital of Norway since 1814, though the city was called Christiania from 1624 until 1925 after King Christian IV ordered its reconstruction following a fire; it sits at the head of the Oslofjord.",
    "Nuuk": "Nuuk is the capital and largest city of Greenland, situated at the mouth of the Nuup Kangerlua fjord; with a population of under twenty thousand, it is one of the smallest capitals in the world.",
    "Caracas": "Caracas, Venezuela sits in a narrow Andean valley some nine hundred metres above the Caribbean coast, shielded from the humid lowlands by a wall of mountains. The city takes its name from the indigenous Caracas people who inhabited the valley before Spanish contact.",
    "Kyiv": "Kyiv is the capital and largest city of Ukraine, one of the oldest cities in Eastern Europe, founded on the high right bank of the Dnieper River; it served as the centre of the medieval Kievan Rus state from the ninth century.",
    "Vancouver": "Vancouver, Canada was founded in 1886 as the western terminus of the Canadian Pacific Railway; it sits on a peninsula between Burrard Inlet and the Fraser River delta, with the Coast Mountains as its backdrop.",
    "Boston": "Boston was founded by Puritan colonists in 1630 on the Shawmut Peninsula of Massachusetts Bay, and served as the intellectual and political centre of the American independence movement in the 1770s.",
    "New Cairo": "New Cairo, Egypt is a planned city on the desert plateau east of historic Cairo, begun in the 1990s to relieve pressure on the ancient capital; the original Cairo was founded in 969 AD by the Fatimid caliphate beside the ruins of earlier Roman and Arab settlements.",
    "Osaka": "Osaka has been Japan's commercial capital since the Edo period, when the city's merchant class accumulated enough wealth to produce a distinct urban culture; it sits at the eastern end of the Seto Inland Sea on the Kansai plain.",
    "Madrid": "Madrid, Spain sits at nearly seven hundred metres above sea level on the Castilian Plateau, making it the highest capital city in the European Union. Philip II chose it as his seat of government in 1561 not for strategic or commercial reasons, but simply because it lay at the geographic centre of the Iberian Peninsula.",
    "Berlin": "Berlin became the capital of a unified Germany in 1871, was divided between Allied occupation zones after 1945, and reunified only in 1990; the Brandenburg Gate stood in no-man's land between East and West for twenty-eight years.",
    "Rio": "Rio de Janeiro, Brazil was founded by Portuguese colonists in 1565 on the southern shore of Guanabara Bay, served as the capital of Brazil until 1960, and is home to the largest urban forest in the world at Tijuca National Park.",
    "Bucharest": "Bucharest became the capital of Wallachia in 1659, and of unified Romania in 1862; its early twentieth century Francophile architecture earned it the nickname Little Paris before large-scale demolition under Ceausescu's 1980s reconstruction programme.",
    "Ulaanbaatar": "Ulaanbaatar is the capital of Mongolia and the coldest national capital on Earth by average annual temperature, founded in 1639 as a nomadic Buddhist monastic centre before being permanently settled in 1778 on the banks of the Tuul River; it holds roughly half of Mongolia's entire population.",
    "Bruges": "Bruges, Belgium was medieval Europe's wealthiest trading city, the northern terminus of the Hanseatic League's commercial network in the fourteenth century; the silting of its harbour in the late fifteenth century ended its dominance overnight.",
    "Geneva": "Geneva sits at the southwestern tip of Lake Geneva on the Swiss Plateau; it became the centre of Protestant reform under John Calvin in the sixteenth century and later the seat of the League of Nations.",
    "Glasgow": "Glasgow grew from a small medieval cathedral town into Britain's second city during the eighteenth and nineteenth centuries, driven by transatlantic tobacco and cotton trading and then by shipbuilding on the Clyde.",
    "Warsaw": "Warsaw became the capital of Poland in 1596, was systematically destroyed by Nazi forces in 1944 following the Warsaw Uprising, and was rebuilt almost stone by stone from historic records over the following decades.",
    "New Mombasa": "Mombasa has been Kenya's principal port for over a millennium, occupied by Arab traders, Portuguese colonialists, and the British in succession before Kenyan independence in 1963; the island city is connected to the mainland by the Makupa Causeway. The name New Mombasa will be familiar to veterans of a certain twenty-sixth century war.",
    "Seattle": "Seattle was incorporated in 1869 on a steep hillside above Puget Sound; the city was almost entirely rebuilt after a fire destroyed its wooden downtown in 1889, this time in brick and stone.",
    "Las Vegas": "Las Vegas takes its name from the Spanish for 'The Meadows', a reference to artesian wells that once made it a rare source of water on desert crossings.",
    "Edmonton": "Edmonton, Alberta was founded as a Hudson's Bay Company trading post in 1795 and later the staging point for the Klondike Gold Rush of 1897; it became Alberta's provincial capital in 1905 and is the northernmost major city in North America.",
    "Vilnius": "Vilnius has been the capital of Lithuania since the fourteenth century, when Grand Duke Gediminas moved his court there; its remarkably intact baroque old town is among the largest in Europe.",
    "Busan": "Busan is South Korea's second city and the country's primary seaport, situated on the southeastern tip of the peninsula where the Korea Strait narrows between Korea and Japan.",
    "Yokohama": "Yokohama, Japan was a small fishing village until US Commodore Matthew Perry forced the country to open the port to foreign trade in 1854; it grew into Japan's largest port and the gateway for Western goods and ideas into the Meiji-era country.",
    "Rome": "Rome, Italy was traditionally founded in 753 BC on seven hills beside the Tiber River, grew to govern an empire stretching from Scotland to Mesopotamia, and has been continuously inhabited longer than any other city in Western Europe.",
    "Perth": "Perth was founded in 1829 on the Swan River in Western Australia as a free settlement; it is the most geographically isolated major city on Earth, closer to Singapore than to Sydney, and grew rapidly after gold was discovered in the hinterland in 1893.",
    "Johannesburg": "Johannesburg, South Africa was established in 1886 as a mining camp after the discovery of the world's largest gold deposit on the Witwatersrand; it grew into sub-Saharan Africa's largest city within a generation.",
    "San Francisco": "San Francisco occupies one of the most geographically dramatic sites on the Pacific coast, wrapped around a deep natural harbour on a narrow peninsula of steep hills. The city was largely destroyed by earthquake and fire in 1906 and rebuilt within a decade — its streetcars were running again within three years of the disaster.",
    "Siam": "Siam was the name of the kingdom centred on the Chao Phraya River basin in Southeast Asia from the fourteenth century until 1939, when the government renamed the country Thailand; the historical name persisted in foreign usage for decades afterward.",
    "Venice": "Venice, Italy is the only major city in the world built entirely on water — its 118 islands connected by roughly 400 bridges over 150 canals. The city has been slowly sinking into the Adriatic since its construction, and the threat of flooding has grown acute enough that a system of mobile floodgates now seals the lagoon during high-water events.",
    "Milwaukee": "By the twenty-first century, Milwaukee had settled into being a fairly small city in Wisconsin — industrial heritage, good breweries, lake views. In 2025 it also became the home of Adepticon, the world's largest tabletop gaming convention.",
    "Rotterdam": "Rotterdam, Netherlands handles more cargo tonnage than any other port in Europe, a position built on its location at the mouth of the Rhine-Meuse-Scheldt delta; much of the city was destroyed by German bombing in May 1940 and rebuilt in a modernist style.",
    "New Dubai": "Dubai, United Arab Emirates was a small pearl-diving settlement at the mouth of a creek on the Persian Gulf until oil revenues in the 1960s funded the construction of a modern port; the city has since built the tallest building on Earth and islands visible from orbit.",
    "Tokyo": "Tokyo, Japan was a small fishing village called Edo until 1603, when the Tokugawa shogunate established its seat of government there; it became the imperial capital in 1869 and is today the most populous metropolitan area on Earth.",
    "New York": "New York was founded as New Amsterdam by the Dutch West India Company in 1626 on the southern tip of Manhattan Island, captured by the English in 1664, and grew into the most populous city in the Western world.",
    "Beijing": "Beijing, China has been the seat of imperial power for most of the past seven centuries and is home to the Forbidden City, a palace complex covering 72 hectares and containing nearly a thousand individual buildings. The name translates as 'Northern Capital', distinguishing it from Nanjing, the Southern Capital, which held the seat of power during the intervening periods.",
    "Hong Kong": "Hong Kong was a British Crown Colony from 1842 until 1997, when sovereignty transferred to China; the territory's deep natural harbour and low-tax trade policy made it one of the world's highest-density commercial centres.",
    "Babylon": "Babylon stood on the Euphrates River in what is now central Iraq, was the largest city in the world under Nebuchadnezzar II in the sixth century BC, and gave its name to a civilisation; Alexander the Great died within its walls in 323 BC.",
    "Delhi": "Delhi, India has served as the capital of successive empires on the Indo-Gangetic Plain for over a millennium; the city's layered history produced at least seven distinct urban centres, with New Delhi built by the British as an eighth from 1911.",
    "Hanoi": "Hanoi has been the capital of Vietnam for most of the past thousand years, first founded as the Ly dynasty capital in 1010 on a bend of the Red River; the city's name means 'inside the river bend'.",
    "Thebes": "Thebes was the most powerful city-state in Greece during the fourth century BC, home to the Sacred Band of Thebes; its earlier Egyptian namesake served as Egypt's capital for much of the New Kingdom period and is now known as Luxor.",
    "Carthage": "Carthage was a Phoenician trading colony founded near modern Tunis, Tunisia around 814 BC, became Rome's most dangerous rival for control of the western Mediterranean, and was destroyed by Scipio Aemilianus in 146 BC after a three-year siege.",
    "Byzantium": "Byzantium, on the European shore of the Bosphorus where the strait narrows to less than a kilometre, is one of the most strategically coveted sites in the ancient world. The settlement was renamed Constantinople by Constantine the Great in 330 AD, became Istanbul after the Ottoman conquest of 1453, and has never stopped being one of the most important cities on Earth under any of its names.",
    "Washington": "Washington DC was designed from scratch as a purpose-built capital in 1790, sited on the Potomac River between Maryland and Virginia at the insistence of George Washington; the city was burned by British forces in 1814 and rebuilt within a year.",
    "London": "London has been England's capital since the Romans founded Londinium in approximately 43 AD on the north bank of the Thames; it became the largest city in the world during the nineteenth century and remains the most visited city on Earth.",
}


def main():
    for faction, table in NAMESAKES.items():
        path = os.path.join(ROOT, f"faction-{faction}.json")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Longest key first so "New Orleans" wins over any bare "New".
        keys = sorted(table, key=len, reverse=True)
        added = 0
        for g in data.get("groups", []):
            ship = g.get("ship", {})
            name = ship.get("name", "")
            if ship.get("namesake"):
                continue
            match = next((k for k in keys if name.startswith(k)), None)
            if match:
                ship["namesake"] = table[match]
                added += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{faction}: set {added} namesakes")


if __name__ == "__main__":
    main()
