#!/usr/bin/env python3
"""fix33: combine the four Franklin & Brentwood batches into research/research-franklin.json, with the executor's fixes.

Generic (as fix31-32): HTML entities in names and deals, corroborated only with 2+ sources, empty notes dropped,
24:00+ normalized. Then every menu the researchers handed off ("PDF not readable", image or script-rendered menus)
was opened on the Mac (pdf2txt.swift, sips renders; files in research/franklin/pdf/, thread folder only) or in
TJ's Chrome, so merge_v2zone.py's unopened-menu check passes.
Order: this -> geocode_v2zone.py -> finish_franklin.py -> apply_google_hours.py -> merge_v2zone.py
-> apply_corrections.py (only if the S4b empty-deals pass finds something).
"""
import json, html, os
H = os.path.dirname(os.path.abspath(__file__))
D = '2026-11-04'
out = {'added': [], 'not_added': []}
for i in range(1, 5):
    b = json.load(open(os.path.join(H, 'batch%d-out.json' % i)))
    out['added'] += b['added']; out['not_added'] += b['not_added']
FIX = {'24:00': '00:00', '25:00': '01:00', '26:00': '02:00'}
log = []
for v in out['added']:
    for k in ('lead', 'name'):
        v[k] = html.unescape(v[k])
    if 'hours_note' in v:
        v['hours_notes'] = v.pop('hours_note')
    for d, rs in v['hours'].items():
        for r in rs:
            if r[1] in FIX:
                log.append('%s %s end %s -> %s' % (v['name'], d, r[1], FIX[r[1]])); r[1] = FIX[r[1]]
    for w in v['windows']:
        for dl in w['deals']:
            dl['desc'] = html.unescape(dl['desc'])
        w['research_notes'] = html.unescape(w.get('research_notes') or '') or None
        if w.get('corroborated') and len(w['sources']) < 2:
            w['corroborated'] = False; log.append('%s: corroborated false (one source)' % v['name'])
        if not w.get('notes'):
            w.pop('notes', None)
        if not w.get('research_notes'):
            w.pop('research_notes', None)
for n in out['not_added']:
    n['lead'] = html.unescape(n['lead'])
    if n.get('note'):  # batch 1 put its hand-offs in `note`; the merge reads `detail`
        n['detail'] = n.pop('note')
by = {v['lead']: v for v in out['added']}


def src(url, kind='venue', confirmed=None):
    return {'url': url, 'kind': kind, 'seen': D, 'confirmed': confirmed}


def drop(lead, reason, url, detail):
    v = by.pop(lead)
    out['added'].remove(v)
    out['not_added'].append({'lead': lead, 'reason': reason, 'url': url, 'detail': detail})


# Perry's: the Social Hour insert PDF (dated 09.02.26) read on the Mac: "SOCIAL HOUR 7 SELECTIONS FOR $9 EACH,
# SUNDAY - FRIDAY | 4 - 6:30 PM": 7 bar bites, 7 mixology cocktails, 7 wines (5 oz); "NOT offered in main dining,
# on promotional holidays, for private events or TO-GO". The researcher's days, times and deals stand.
w = by["Perry's Steakhouse & Grille - Cool Springs"]['windows'][0]
PDF = 'https://perryssteakhouse.com/wp-content/uploads/2026/09/26PER05-024-Social-Hour-Insert_Main-1.pdf'
if PDF not in [s['url'] for s in w['sources']]:
    w['sources'].append(src(PDF))
w['deals'] = [
    {'type': 'food', 'desc': '$9 bar bites: pork chop bites, filet lettuce wraps, filet sliders and more', 'price': 9},
    {'type': 'drink', 'desc': '$9 mixology cocktails (7 choices)', 'price': 9},
    {'type': 'drink', 'desc': '$9 wine, 5 oz pour (7 choices)', 'price': 9},
]
w['notes'] = 'Social Hour in Bar 79 only, not in the main dining room.'
w['research_notes'] = ("Venue Social Hour page: Sun-Fri 4:00-6:30 PM, Bar 79. fix33: the executor read the linked Social Hour "
    "insert PDF (dated 09.02.26) on the Mac: 'SOCIAL HOUR 7 SELECTIONS FOR $9 EACH, SUNDAY - FRIDAY 4 - 6:30 PM', seven bar "
    "bites, seven mixology cocktails, seven 5 oz wines; not offered in main dining, on promotional holidays, for private "
    "events or to-go. No 2026 closure found.")

# Bonefish: the location page's "Social Hour Menu" link is the Tennessee menu BSH-1-TN_0626 (June 2026), read on the
# Mac: "3:00 PM - 6:30 PM | EVERY. SINGLE. DAY." The researcher's 4 PM start and "close" placeholder are replaced.
b = by['Bonefish Grill (Franklin)']
w = b['windows'][0]
PDF = 'https://bonefishgrill-d8cba7f0a6b8gwd7.a02.azurefd.net/menu/BSH-1-TN_0626.pdf'
w.update({'start': '15:00', 'end': '18:30', 'confidence': 'high', 'area': None})
w['sources'].append(src(PDF))
w['deals'] = [
    {'type': 'food', 'desc': '$9 ahi tuna wonton crisps', 'price': 9},
    {'type': 'food', 'desc': '$9 shrimp toast', 'price': 9},
    {'type': 'food', 'desc': '$7 pickle chips, Bang Bang chicken bites or crispy cauliflower', 'price': 7},
    {'type': 'drink', 'desc': '$7 cocktails (mango bourbon sour, lemon drop, margarita and more)', 'price': 7},
    {'type': 'drink', 'desc': '$6 house wine, 6 oz', 'price': 6},
    {'type': 'drink', 'desc': '$7 select spirits (single-liquor mixed drinks)', 'price': 7},
    {'type': 'drink', 'desc': '$1 off draft beer', 'price': None},
]
w['notes'] = 'Social Hour, every day. Chain-wide Tennessee pricing.'
w['research_notes'] = ("fix33: the executor opened the location page's 'Social Hour Menu' link, the Tennessee menu "
    "BSH-1-TN_0626.pdf (June 2026), and read it on the Mac: '3:00 PM - 6:30 PM | EVERY. SINGLE. DAY.', bites $7-$9, $7 "
    "cocktails, $6/$9 house wine, $9/$13 premium wine, $1 off drafts, $7 select spirits. The researcher had a 4 PM start "
    "and no end from the page text. Location hours: Mon-Thu 3-10, Fri 3-11, Sat 11-11, Sun 11-9. No 2026 closure found.")

# Mojo's Tacos: its "happy hour specials" tab (menu_id=1166624) is script-rendered; read in Chrome.
w = by["Mojo's Tacos (The Factory)"]['windows'][0]
U = 'https://mojostacos.com/drink-menu?menu_id=1166624'
w['sources'].append(src(U))
w['deals'] = [
    {'type': 'drink', 'desc': '$6 house lime margarita', 'price': 6},
    {'type': 'drink', 'desc': '$7 blackberry or strawberry margarita', 'price': 7},
    {'type': 'drink', 'desc': '$8 skinny margarita', 'price': 8},
    {'type': 'drink', 'desc': '$7 passionfruit sangria', 'price': 7},
    {'type': 'drink', 'desc': '$8 house red or white wine', 'price': 8},
    {'type': 'drink', 'desc': '$5 draft beer', 'price': 5},
    {'type': 'drink', 'desc': '$10 pint and a shot', 'price': 10},
    {'type': 'drink', 'desc': '$25 margarita pitcher', 'price': 25},
    {'type': 'drink', 'desc': '$20 beer pitcher', 'price': 20},
]
w.pop('notes', None)
w['research_notes'] = ("Home page (Franklin Rd address): Happy Hour Monday-Friday 3-6 PM. fix33: the executor read the "
    "'happy hour specials' tab of the drink menu in Chrome (menu_id=1166624, the active tab): margaritas $6-$8, sangria $7, "
    "house wine $8, drafts $5, pint & a shot $10, pitchers $25/$20. Undated, and the home page doesn't say which location "
    "the times apply to, so med. No 2026 closure found.")

# Mere Bulles: the drink menu is text (no images) with no happy hour; the FOOD menu has a HAPPY HOUR tab
# (menu_id=212830), read in Chrome: "Monday - Friday 2:00 - 6:00 pm | Dine-in ONLY".
w = by['Mere Bulles']['windows'][0]
U = 'https://merebulles.com/food-menu?menu_id=212830'
w['sources'].append(src(U))
w['deals'] = [
    {'type': 'food', 'desc': '$6 small bites: salads, truffle fries, tacos, desserts', 'price': 6},
    {'type': 'food', 'desc': '$9 small bites: she-crab bisque, bruschetta, cheeseburger and more', 'price': 9},
    {'type': 'food', 'desc': '$12 crab cake, shrimp cocktail or Angus rib rolls', 'price': 12},
    {'type': 'drink', 'desc': '$10 cocktails (bramble mule, spritz, tiny tinis, whiskey on the rocks)', 'price': 10},
    {'type': 'drink', 'desc': '$6 wine (red, white, bubbles)', 'price': 6},
    {'type': 'drink', 'desc': '$5 beer', 'price': 5},
]
w['notes'] = 'Dine-in only.'
w['confidence'] = 'med'  # S5 note: the venue's pages carry no date (brief confidence rule; fix32 did the same for Maggie's)
w['research_notes'] = ("Home page: Happy Hour Monday-Friday 2-6 PM. fix33: the drink menu (handed off as unreadable) is plain text with "
    "no happy-hour section; the executor found the HAPPY HOUR tab on the food menu (menu_id=212830) and read it in Chrome: "
    "'Monday - Friday 2:00 - 6:00 pm | Dine-in ONLY', small bites $6/$9/$12, cocktails $10, wine $6, beer $5. Daily 50% off "
    "bottled wine and Whiskey Wednesday are not happy hour and are left out. Undated, so med. No 2026 closure found.")

# Sportsman's Grille (Brentwood): the menu page's "Cool Springs menu" PDF (SL-MENU-5-25, the Brentwood lodge) read on
# the Mac: no happy-hour section (the Belle Meade menu's page 4 has one; this one's page 4 is the lodge's history).
# The home page's "Happy Hour (2-6 PM daily)" sits under "Locations in Brentwood & Nashville", unscoped: med stands.
w = by["Sportsman's Grille (Brentwood)"]['windows'][0]
w['research_notes'] = ("Home page (undated), under 'Locations in Brentwood & Nashville': 'Happy Hour (2-6 PM daily) Half-off: "
    "Well & Liquor, Draft Beer, and House Wines', not tied to one location. fix33: the executor read the Cool Springs "
    "(Brentwood) menu PDF, SL-MENU-5-25, on the Mac: no happy-hour section. Med. The closed Sportsman's is the Hillsboro "
    "Village one; nothing for 1640 Westgate Cir.")
w['notes'] = 'Daily 2-6pm, as the venue posts it for its Brentwood and Nashville locations.'

# Carrabba's: the location page's Tennessee happy-hour PDF HH-4-7-TN_0926 (Sept 2026) read on the Mac:
# "ENJOY IN THE BAR AREA 4-7PM DAILY". Days are now read, not inferred.
w = by["Carrabba's Italian Grill (Franklin)"]['windows'][0]
w.update({'confidence': 'high', 'area': 'bar', 'days': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']})
w['sources'] = [s for s in w['sources'] if 'trade' not in s['url']]
w['deals'] = [
    {'type': 'food', 'desc': '$5 spinach arancini or zucchini fritte', 'price': 5},
    {'type': 'food', 'desc': '$7 lasagne dip, mezzaluna fritte or shrimp focaccia bites', 'price': 7},
    {'type': 'food', 'desc': '$9 calamari, meatball sliders or Calabrian wings', 'price': 9},
    {'type': 'drink', 'desc': '$5 red sangria or blood orange margarita', 'price': 5},
    {'type': 'drink', 'desc': '$7 rose sangria, pomegranate martini, limoncello spritz or Italian buck', 'price': 7},
    {'type': 'drink', 'desc': '$9 blackberry sangria, espresso martini or Italian old fashioned', 'price': 9},
    {'type': 'drink', 'desc': 'House wines $5, $7 or $9 (6 oz)', 'price': None},
    {'type': 'drink', 'desc': '$3 Michelob Ultra draft', 'price': 3},
]
w['notes'] = 'In the bar area. Chain-wide Tennessee pricing.'
w['research_notes'] = ("Location page links the Tennessee happy-hour menu HH-4-7-TN_0926. fix33: the executor read it on the Mac "
    "(pdf2txt.swift): 'ENJOY IN THE BAR AREA 4-7PM DAILY', bites $5/$7/$9, cocktails and sangrias $5/$7/$9, wines $5/$7/$9, "
    "drafts from $3. Days are from the PDF (the researcher had inferred them). No 2026 closure found.")

# Twin Peaks Cool Springs: the location's flyer (lo109523_TP_Promo_CoolSprings-10.7.25.pdf; "2/25" in its footer)
# read on the Mac, text plus a sips render. Page 2: "HAPPY HOUR | MONDAY-FRIDAY | 2PM-7PM, $1 OFF SELECT DRAFTS &
# $1 OFF WELL DRINKS". A pre-2026 flyer: low (step 14), on the watchlist. The page's "Sorry, We're Closed" is read
# against Google's banner in S2.
w = by['Twin Peaks (Brentwood)']['windows'][0]
w['deals'] = [
    {'type': 'drink', 'desc': '$1 off select drafts', 'price': None},
    {'type': 'drink', 'desc': '$1 off well drinks', 'price': None},
]
w['confidence'] = 'low'
w['notes'] = "Deals from the location's October 2025 flyer, still linked from its page."
w['research_notes'] = ("fix33: the executor read the location's flyer PDF (file dated 10.7.25, footer '2/25') on the Mac, text and "
    "a sips render. Page 2: 'HAPPY HOUR | MONDAY-FRIDAY | 2PM-7PM', $1 off select drafts and $1 off well drinks. Page 1 is "
    "the weekly drink specials. A pre-2026 flyer, so low (brief step 14). The location page showed 'Sorry, We're Closed' "
    "with no reason or date when fetched; the parent company filed Chapter 11 in Jan 2026; no closure report found.")

# Otaku Ramen (The Factory): the researcher found no Otaku site and used The Factory's tenant listing, with weekend
# hours read through a typo ("11:00 pm - 9:00 pm", 11 am assumed). Otaku's own location page exists and was read in
# Chrome (S4b): "HAPPY HOUR EVERYDAY 4-7PM | Sake, batch cocktails, beer, frozen drinks & boba" (no prices), and
# HOURS Mon-Fri 11am-3pm, 4pm-9pm; Sat-Sun 11am-9pm. It replaces the listing for the site, the hours and the window.
o = by['Otaku Ramen (The Factory)']
U = 'https://otakuramen.com/locations/franklin'
o['official_site'] = U
o['address'] = '230 Franklin Rd Ste 11-T'
o['hours'] = {d: [['11:00', '15:00'], ['16:00', '21:00']] for d in ('MON', 'TUE', 'WED', 'THU', 'FRI')}
o['hours'].update({d: [['11:00', '21:00']] for d in ('SAT', 'SUN')})
o['hours_confidence'] = 'high'
o['hours_source'] = 'researched %s (high confidence): %s' % (D, U)
o.pop('hours_notes', None)
w = o['windows'][0]
w['sources'] = [src(U), src('https://factoryatfranklin.com/?p=1218')]
w['confidence'] = 'med'
w['corroborated'] = True
w['notes'] = 'Happy hour drinks: sake, batch cocktails, beer, frozen drinks and boba. Prices not posted.'
w['research_notes'] = ("fix33: the executor found Otaku's own Franklin page (the researcher had not) and read it in Chrome: "
    "'HAPPY HOUR EVERYDAY 4-7PM | Sake, batch cocktails, beer, frozen drinks & boba', no prices; hours Mon-Fri 11am-3pm, "
    "4pm-9pm, Sat-Sun 11am-9pm. The Factory at Franklin's tenant listing agrees on 4-7 daily. The site's Happy Hour link "
    "with deals is the Gulch location's only. Undated, so med. No 2026 closure found.")

# Corner Pub - Franklin: cornerpubtn.com is an expired Squarespace site ("Website Expired", in Chrome). The
# researcher's deals came from a search-engine excerpt of it, not a live page. No venue or social source left, and
# the guides are undated: not added.
drop('Corner Pub - Franklin', 'no happy hour found', 'https://www.cornerpubtn.com/happy-hour',
     "fix33 executor: cornerpubtn.com shows 'Website Expired' (Squarespace) in Chrome; the researcher's deals came from a "
     'search excerpt of the dead site. Only undated guides (Atly, Happy Hopper) remain.')

# Brixx (Franklin): the Franklin menu PDF (NSP-A-2026-01_FKLN, Apr 2026) read on the Mac: no happy hour. Stays not added.
for n in out['not_added']:
    if n['lead'].startswith('Brixx'):
        n['detail'] = ("fix33 executor: read the Franklin menu PDF (NSP-A-2026-01_FKLN.pdf, Apr 2026) on the Mac: no happy-hour "
                       'section. Only undated guides show a happy hour.')

# Lint (validate: long-parenthetical / too-long), trimmed to the posted words, as fix32 did.
TRIM = {
    '$7 cocktails (mango bourbon sour, lemon drop, margarita and more)': '$7 cocktails: mango bourbon sour, lemon drop, margarita and more',
    '$10 bites (cheesesteak eggrolls, roasted buffalo wings, ahi tacos)': '$10 bites: cheesesteak eggrolls, buffalo wings, ahi tacos',
    '$10 cocktails (Moscow Mule, Grille Margarita, Old Fashioned)': '$10 cocktails: Moscow Mule, Grille Margarita, Old Fashioned',
    '$10 cocktails (bramble mule, spritz, tiny tinis, whiskey on the rocks)': '$10 cocktails: bramble mule, spritz, tiny tinis and more',
}
for v in out['added']:
    for w in v['windows']:
        for dl in w['deals']:
            if dl['desc'] in TRIM:
                dl['desc'] = TRIM[dl['desc']]
            elif dl['desc'].startswith('$10 bites: Zucca Chips'):
                dl['desc'] = '$10 bites: zucca chips, arancini, meatballs, flatbreads and more'
            elif dl['desc'].startswith('Wines by the glass $7 to $12 ('):
                dl['desc'] = 'Wines by the glass $7 to $12'
            elif dl['desc'].startswith('Cocktails $9 to $14 ('):
                dl['desc'] = 'Cocktails $9 to $14: French 75, Sazerac, Hurricane and more'

json.dump(out, open(os.path.join(H, '..', 'research-franklin.json'), 'w'), indent=1, ensure_ascii=False)
print('added %d, not added %d' % (len(out['added']), len(out['not_added'])))
for l in log:
    print(' ', l)
