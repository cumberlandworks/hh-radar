#!/usr/bin/env python3
"""fix16 data step: finer Nashville neighborhoods (TJ 2026-10-25 03:31: "South has three distinct areas ... some people
would care about their neighborhood being represented - I think it would be good to break those up as well").
Each core venue's hood is set by hand from its street address (not nearest-centroid, which had misfiled 7 venues);
the 8 zones stay. Ocean Prime: TJ 03:37 "Ocean Prime is in Nashville Yards" (990 Signal Crossing is a Nashville Yards
street, per WhatNow/Fox17); inKind's map point was ~3 mi north, so its lat/lon is moved to Nashville Yards (approx.).
Writes venues-20261025l.json and hoods-v2.json (zone -> hoods with centroids = mean of their venues' coordinates)."""
import json
from collections import OrderedDict
PLAN = OrderedDict([
 ('downtown', OrderedDict([
   ('Lower Broadway', ["Acme Feed","Goodnight Nashville","Hank Williams","JBJ's","Jimmy Buffett","Kane Brown","Blue Sushi - 5th","Prince St. Pizza"]),
   ('Downtown & Printers Alley', ["Black Tap","Brugada","E+ROSE - 505","Nashville Barrel Company - Tasting","Pete's Dueling","Sushi By Bou","Taste of NY - Downtown","The Side Piece"]),
   ('SoBro', ["Bakersfield","Southernaire","The Hampton Social","The Pancake Pantry - Nashville","The Southern Steak","ZuZu","koshō","The Herban Perk","City Winery"]),
   ('Rutledge Hill & Rolling Mill Hill', ["E+ROSE - Peabody","Legendary Wings","The Urban Perk","Mr. J's Original - Nashville","LinQ Social"]),
 ])),
 ('gulch', OrderedDict([
   ('The Gulch', ["Bar Mar","Butterfly","E+ROSE - The Gulch","Electric Jane","Kayne Prime","Moto","Philippe Chow","Saint Anejo","Virago","St. Vito","Two Hands - Nashville","V Modern Italian","Van Leeuwen Ice Cream - Gulch","The Grilled Cheeserie - Café"]),
   ('Nashville Yards & North Gulch', ["Chauhan","JINYA","Pins Mechanical","Puttshack","The Detroit Cowboy","The Mockingbird","Tiff's Treats - Nashville Gulch","Ocean Prime"]),
   ('Midtown & Music Row', ["Connie's","Verna","Music Row Bar","Nacho Daddy","Van Leeuwen Ice Cream - Edgehill","Live Oak"]),
   ('Hillsboro Village & Belmont', ["Bungalow 10","Jar 10","NoWhere Special","The Pancake Pantry - Hillsboro","Jashan"]),
   ('West End', ["Chateau West","E+ROSE - OneC1ty"]),
 ])),
 ('north', OrderedDict([
   ('Germantown', ["312 Pizza","Close Company","E+ROSE - Germantown","Fishmonger - Neuhoff","Germantown Cafe","Grandpa Bar","Van Leeuwen Ice Cream - Neuhoff"]),
   ('Buchanan Arts District & North Nashville', ["Bag Lady","Slim & Husky's - Nashville/Buchanan","The Loading Dock","Tío Fun","Riddim N Spice"]),
   ('Dickerson Pike', ["ELEVEN11","Fancypants"]),
 ])),
 ('east', OrderedDict([
   ('Five Points & Main Street', ["Bad Idea","Bad-Ass Breakfast Burritos - East","Butcher & Bee","Dog Haus - East","Love & Exile","Noir Kitchen","The Grilled Cheeserie"]),
   ('Gallatin Avenue & Eastwood', ["Pearl Diver","The Amsterdamian","The Authentique","Two Ten Jack"]),
   ('Inglewood & Riverside', ["The Fox Bar","E+ROSE - East Nashville"]),
   ('East Bank & Fesslers', ["Nashville Barrel Company - HQ"]),
 ])),
 ('south', OrderedDict([
   ('12 South', ["Playdate","The Salty","E+ROSE - 12South"]),
   ('Wedgewood-Houston', ["Alla Vita","E+ROSE - Wedgewood","Fishmonger - Wedgewood","Middleman","Momotaro","Present Tense"]),
   ('Berry Hill', ["Common Ground"]),
   ('Green Hills', ["True Food Kitchen"]),
 ])),
 ('west', OrderedDict([
   ('Sylvan Park', ["Park Cafe","Punk Wok","Tantisimo"]),
   ('The Nations', ["51 North","Nicky's"]),
   ('West Nashville & White Bridge', ["Anatolia","Blue Coast Burrito - Nashville West"]),
   ('Belle Meade', ["360 Bistro"]),
   ('Bellevue', ["Fortuna","Tiff's Treats - Nashville Bellevue"]),
 ])),
 ('outer', OrderedDict([('Donelson & Opry Mills', ["Gregorys Coffee - Opry Mills"])])),
])
d = json.load(open('venues-20261025k.json'))
V = d['venues']
op = [v for v in V if v['name'].startswith('Ocean Prime')]; assert len(op) == 1
op[0]['lat'], op[0]['lon'] = 36.1592, -86.7858
op[0]['notes'] = (op[0]['notes'] + ' Location: Nashville Yards (990 Signal Crossing); map point corrected 2026-10-25, inKind\'s was ~3 mi north.').strip()
done = set()
for z, hs in PLAN.items():
    for h, names in hs.items():
        for n in names:
            m = [v for v in V if v['name'].startswith(n) and v['id'] not in done]
            assert len(m) == 1, (h, n, [x['name'] for x in m])
            m[0]['hood'] = m[0]['neighborhood'] = h; m[0]['zone'] = z; done.add(m[0]['id'])
core_left = [v['name'] for v in V if v['zone'] in ('downtown', 'gulch', 'north', 'east', 'south', 'west') and v['id'] not in done]
assert not core_left, core_left
json.dump(d, open('venues-20261025l.json', 'w'), indent=1, ensure_ascii=False)
hoods = OrderedDict()
for z, hs in PLAN.items():
    hoods[z] = []
    for h in hs:
        vs = [v for v in V if v['hood'] == h]
        hoods[z].append({'hood': h, 'venues': len(vs), 'lat': round(sum(v['lat'] for v in vs) / len(vs), 4), 'lon': round(sum(v['lon'] for v in vs) / len(vs), 4)})
json.dump(hoods, open('hoods-v2.json', 'w'), indent=1, ensure_ascii=False)
print(len(done), 'venues set'); print(json.dumps({z: [(x['hood'], x['venues']) for x in hs] for z, hs in hoods.items()}, ensure_ascii=False))
