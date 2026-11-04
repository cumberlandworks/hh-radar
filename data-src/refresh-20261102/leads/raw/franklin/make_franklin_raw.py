#!/usr/bin/env python3
"""fix33: the Franklin & Brentwood leads -> leads/raw/leads-raw-franklin.json (same shape as leads-raw.json).

Leads only: names, addresses, the venue's site and the guide pages that list it. No deal text.
The merge across sources is by hand (one row per location), because the guides spell the same
venue many ways ("1799 Kitchen & Bar Room" / "1799 Kitchen & Cocktails") and two chains have a
Franklin and a Brentwood location (55 South, Firebirds) that must stay apart.
See fetch-log-franklin.md for what each page was and how it was read.
Usage: python3 make_franklin_raw.py   (writes ../leads-raw-franklin.json)
"""
import json, os

FIS_F = 'https://franklinis.com/a-toast-to-top-happy-hours-in-franklin-tennessee/'
FIS_X = 'https://franklinis.com/happy-hour-at-the-factory-at-franklin-where-to-sip-snack-and-unwind/'
FIS_B = 'https://franklinis.com/cheers-to-the-best-happy-hours-in-brentwood-tennessee/'
OT = 'https://www.opentable.com/features/best-happy-hour-restaurants-franklin-tennessee-tn'
WS = 'https://www.williamsonscene.com/brentwood/top-10-happy-hours-in-brentwood/article_02f548f8-0203-11ed-9551-d7d7922094f3.html'
BL = 'https://baselocal.com/?p=13964'
HH_F = 'https://happyhopper.app/restaurant-directory/tennessee/franklin'
HH_B = 'https://happyhopper.app/restaurant-directory/tennessee/brentwood'
SRC = {'fis': (FIS_F,), 'fisx': (FIS_X,), 'fisb': (FIS_B,), 'ot': (OT,), 'ws': (WS,), 'bl': (BL,),
       'hhf': (HH_F,), 'hhb': (HH_B,)}

F, B = 'Franklin', 'Brentwood'
FACTORY = '230 Franklin Rd, Franklin, TN 37064'
# (name, town, address or None, site or None, [sources])
LEADS = [
    ("Tony's Eat and Drink", F, '1000 Meridian Blvd #100, Franklin, TN 37067', 'https://tonyseatanddrink.com/', ['fis', 'hhf']),
    ("Jonathan's Grille", F, '7135 S Springs Dr, Franklin, TN 37067', 'https://www.jonathansgrille.com/', ['fis', 'hhf']),
    ("Neighbors Franklin", F, '4031 Aspen Grove Dr Suite 162, Franklin, TN 37067', 'https://neighborsnashville.com/franklin-location/', ['fis']),
    ("Puckett's (Franklin)", F, '120 4th Ave S, Franklin, TN 37064', 'https://www.puckettsrestaurant.com/', ['fis', 'bl', 'hhf']),
    ("Curio Brewing Company", F, '216 Noah Dr #140, Franklin, TN 37064', 'https://curiobrewing.com/', ['fis']),
    ("Blue Sushi Sake Grill - McEwen Northside", F, '5001 Aspen Grove Dr Ste 142, Franklin, TN 37067', 'https://www.bluesushisakegrill.com/locations/mcewen-northside', ['fis', 'ot', 'hhf']),
    ("The White Alligator Po-Boys & Cocktails", F, FACTORY, 'https://thewhitealligator.com/', ['fis', 'fisx']),
    ("Brixx Wood Fired Pizza + Craft Bar (Franklin)", F, '1550 W McEwen Dr Suite 10, Franklin, TN 37067', 'https://brixxpizza.com/', ['fis']),
    ("Sperry's Cool Springs", F, '650 Frazier Dr, Franklin, TN 37067', 'https://www.sperrys.com/', ['fis']),
    ("McCreary's Irish Pub & Eatery", F, '414 Main St, Franklin, TN 37064', 'https://mccrearyspub.com/', ['fis', 'hhf']),
    ("Scout's Pub", F, '158 Front St #120, Franklin, TN 37064', 'https://www.scoutspub.com/', ['fis', 'hhf']),
    ("55 South (Franklin)", F, '403 Main St, Franklin, TN 37064', 'https://www.eat55.com/', ['fis']),
    ("The Skylight Bar", F, FACTORY, 'https://theskylight.com/', ['fis', 'fisx', 'bl']),
    ("Perry's Steakhouse & Grille - Cool Springs", F, '5028 Aspen Grove Dr, Franklin, TN 37067', 'https://perryssteakhouse.com/locations/tn/nashville/cool-springs/', ['fis', 'ot']),
    ("Vintage Vine 100", F, '4051 Aspen Grove Dr, Franklin, TN 37067', 'https://www.vintagevine100.com/', ['fis', 'bl']),
    ("Stable Reserve", F, '412 Main St, Franklin, TN 37064', 'https://www.stablereservespirits.com/', ['fis']),
    ("1799 Kitchen & Bar Room", F, '130 2nd Ave N, Franklin, TN 37064', 'https://www.1799franklin.com/', ['fis', 'ot']),
    ("JJ's Wine Bar", F, '206 E Main St, Franklin, TN 37064', 'https://www.jjswinebar.com/', ['fis', 'hhf']),
    ("The Rutledge", F, '105 International Dr, Franklin, TN 37067', 'https://www.therutledge.co/', ['fis']),
    ("Saffire", F, FACTORY, 'https://www.saffirerestaurant.com/', ['fis', 'fisx']),
    ("etch Franklin", F, FACTORY, None, ['fis', 'fisx', 'ot']),
    ("Bonefish Grill (Franklin)", F, '3010 A Mallory Ln, Franklin, TN 37067', None, ['fis', 'hhf']),
    ("Otaku Ramen (The Factory)", F, FACTORY, None, ['fisx']),
    ("Mojo's Tacos (The Factory)", F, FACTORY, 'https://mojostacos.com/', ['fisx']),
    ("Karrington Rowe", B, None, 'https://karringtonrowe.com/', ['fisb', 'ot']),
    ("Serrato's Steakhouse", F, '3046 Columbia Ave #102, Franklin, TN 37064', 'https://serratossteakhouse.com/', ['fisb', 'hhf']),
    ("Del Frisco's Grille (Brentwood)", B, '207 Franklin Rd, Brentwood, TN 37027', 'https://www.delfriscosgrille.com/location/del-friscos-grille-brentwood-tn/', ['fisb', 'ws']),
    ("55 South (Brentwood)", B, '7031 Executive Center Dr Suite 101, Brentwood, TN 37027', 'https://www.eat55.com/', ['fisb', 'ws']),
    ("Mere Bulles", B, '5201 Maryland Way, Brentwood, TN 37027', 'https://merebulles.com/', ['fisb', 'ot', 'hhb']),
    ("Firebirds Wood Fired Grill - Brentwood", B, '700 Old Hickory Blvd, Brentwood, TN 37027', 'https://firebirdsrestaurants.com/brentwood', ['fisb', 'ot', 'ws']),
    ("Amerigo Italian Restaurant (Brentwood)", B, '1656 Westgate Cir, Brentwood, TN 37027', 'https://amerigo.net/', ['fisb']),
    ("Cinco de Mayo Mexican Restaurant (Brentwood)", B, '4944 Thoroughbred Ln, Brentwood, TN 37027', 'https://www.cincodemayomexicanrestaurant.com/', ['fisb', 'ws']),
    ("Uncle Julio's Brentwood", B, '209 Franklin Rd, Brentwood, TN 37027', 'https://unclejulios.com/', ['fisb', 'ws']),
    ("Sportsman's Grille (Brentwood)", B, '1640 Westgate Cir, Brentwood, TN 37027', 'https://sportsmansgrilletn.com/', ['fisb', 'hhb']),
    ("Sip & Sound", B, None, 'https://www.sipandsound.com/', ['fisb']),
    ("Culinary Dropout - Franklin", F, None, None, ['ot']),
    ("North Italia - Franklin", F, '4041 Aspen Grove Dr #100, Franklin, TN 37067', None, ['ot']),
    ("P.F. Chang's - Cool Springs", F, None, None, ['ot']),
    ("Connors Steak & Seafood - Cool Springs", F, '1916 Galleria Blvd, Franklin, TN 37067', None, ['ot']),
    ("Granite City Food & Brewery - Franklin", F, '1864 W McEwen Dr, Franklin, TN 37067', None, ['ot']),
    ("Brewhouse South & Sauced Pizza Kitchen", F, '1855 Galleria Blvd, Franklin, TN 37067', None, ['ot']),
    ("Corner Pub - Brentwood", B, '710 Old Hickory Blvd, Brentwood, TN 37027', None, ['ws', 'hhb']),
    ("Esquina Cantina", B, '710 Old Hickory Blvd Suite 302, Brentwood, TN 37027', None, ['ws']),
    ("Chili's Grill & Bar (Brentwood)", B, '107 Creekside Crossing, Brentwood, TN 37027', None, ['ws']),
    ("Ludlow & Prime", B, '330 Franklin Rd Suite 226B, Brentwood, TN 37027', None, ['ws']),
    ("Jefferson's (Brentwood)", B, '214 Ward Cir Suite 1200, Brentwood, TN 37027', None, ['ws']),
    ("Dolan's Bar & Grill", F, '4140 Carothers Pkwy #2, Franklin, TN 37067', None, ['bl']),
    ("Benchmark Sports Pub + Eatery", F, '5000 Hughes Crossing #115, Franklin, TN 37064', None, ['bl']),
    ("MAFIAoZA'S Franklin", F, '230 Franklin Rd Building 1, Franklin, TN 37064', None, ['bl']),
    ("M.L.Rose (Franklin, per guide)", F, None, None, ['bl']),
    ("Nacho's Mexican Restaurant - Franklin", F, '1031 Riverside Dr C, Franklin, TN 37064', None, ['hhf']),
    ("Corner Pub - Franklin", F, '1916 Columbia Ave, Franklin, TN 37064', None, ['hhf']),
    ("Corner Pub Cool Springs", F, '9200 Carothers Pkwy Suite 100, Franklin, TN 37067', None, ['hhf']),
    ("Cajun Steamer Bar & Grill", F, '1175 Meridian Blvd #108, Franklin, TN 37067', None, ['hhf']),
    ("Drake's Cool Springs", F, '553 Cool Springs Blvd, Franklin, TN 37067', None, ['hhf']),
    ("Burger Up Franklin", F, '401 Cool Springs Blvd B, Franklin, TN 37067', None, ['hhf']),
    ("Kokomo Trading Company", F, '158 Front St #100, Franklin, TN 37064', None, ['hhf']),
    ("Mellow Mushroom Franklin", F, '317 Main St Ste 100, Franklin, TN 37064', None, ['hhf']),
    ("The Tin Roof 2", F, '9135 Carothers Pkwy #100, Franklin, TN 37067', None, ['hhf']),
    ("Carrabba's Italian Grill (Franklin)", F, '533 Cool Springs Blvd, Franklin, TN 37067', None, ['hhf']),
    ("Buffalo Wild Wings (Franklin)", F, '320 Spring Creek Dr, Franklin, TN 37067', None, ['hhf']),
    ("Coal Town Public House", F, '187 Front St Suite 103B, Franklin, TN 37064', None, ['hhf']),
    ("Condado Tacos (Franklin)", F, '4031 Aspen Grove Dr #108, Franklin, TN 37067', None, ['hhf']),
    ("The Cheesecake Factory (Franklin)", F, '1800 Galleria Blvd #1166, Franklin, TN 37067', None, ['hhf']),
    ("Hop House Tennessee Taps", F, '117 5th Ave N B, Franklin, TN 37064', None, ['hhf']),
    ("Twin Peaks (Brentwood)", B, '1634 Galleria Blvd, Brentwood, TN 37027', None, ['hhb']),
]
# OpenTable's Franklin page is ranked by distance and lists 134 restaurants, 122 of them in
# Davidson County (zones already done). Only its own area facets outside Franklin & Brentwood
# that are outer suburbs are listed here; the 118 core-Nashville ones are not leads for this run.
OUTER = [
    ("Firebirds Wood Fired Grill - Murfreesboro", 'Murfreesboro', ['ot']),
    ("BJ's Restaurant & Brewhouse - Murfreesboro", 'Murfreesboro', ['ot']),
    ("Calabria Italian Kitchen", 'Mt. Juliet', ['ot']),
    ("Calabria Brickoven Pizzeria Goodlettsville", 'Goodlettsville', ['ot']),
]

out = []
for name, town, addr, site, srcs in LEADS:
    out.append({'name': name, 'neighborhood_text': town, 'address': addr,
                'guides': [{'url': SRC[s][0], 'confirmed': None} for s in srcs], 'site': site,
                'sources': srcs})
for name, city, srcs in OUTER:
    out.append({'name': name, 'neighborhood_text': city, 'address': None, 'outer_city': city,
                'guides': [{'url': SRC[s][0], 'confirmed': None} for s in srcs], 'site': None, 'sources': srcs})
names = [o['name'] for o in out]
assert len(names) == len(set(names)), 'duplicate lead name'
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'leads-raw-franklin.json')
json.dump(out, open(dst, 'w'), indent=1, ensure_ascii=False)
open(dst, 'a').write('\n')
per = {}
for o in out:
    for s in o['sources']:
        per[s] = per.get(s, 0) + 1
print(json.dumps({'leads': len(LEADS), 'outer': len(OUTER), 'per_source': per}))
