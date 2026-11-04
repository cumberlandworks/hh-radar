#!/usr/bin/env python3
"""fix32: combine the four West batches into research/research-west.json, with the executor's fixes.

Generic (as fix31): HTML entities in names and deals, corroborated only with 2+ sources, empty notes dropped,
24:00+ normalized. Then every linked menu the researchers flagged (PDF not readable, image menus) was opened on
the Mac (pdf2txt.swift, sips renders, downloaded images; files in research/west/pdf/, thread folder only), so
merge_v2zone.py's unopened-menu check passes. Order: this -> geocode_v2zone.py -> finish_west.py ->
apply_google_hours.py -> merge_v2zone.py.
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
    if 'hours_note' in v:  # Otto's: the field is hours_notes
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
by = {v['name']: v for v in out['added']}


def src(url, kind='venue', confirmed=None):
    return {'url': url, 'kind': kind, 'seen': D, 'confirmed': confirmed}


# answer.: the linked happy-hour PDF (titled "HH Menu 2020 to Print", file last modified 2025-03-04) read on the
# Mac with pdf2txt.swift: "monday - saturday 4:15pm - 6:00pm BAR TOP ONLY everything is $6": snacks (hummus,
# potatoes, dip, pretzels, peppers, asparagus, flatbread) and drinks (draft beer, cocktail, wine). Deals only from
# a pre-2026 menu: low (brief step 14), and on the refresh watchlist.
a = by['answer.']
PDF = 'https://www.answerrestaurant.com/s/HH-2020-n8bf.pdf'
w = a['windows'][0]
w['deals'] = [
    {'type': 'food', 'desc': '$6 bar snacks: hummus, potatoes, dip, pretzels, shishitos and more', 'price': 6},
    {'type': 'drink', 'desc': '$6 draft beer', 'price': 6},
    {'type': 'drink', 'desc': '$6 cocktail (changes weekly)', 'price': 6},
    {'type': 'drink', 'desc': '$6 wine (red, white, rose or prosecco)', 'price': 6},
]
w['sources'].append(src(PDF))
w['confidence'] = 'low'
w['notes'] = ("Bar top seating only, from 4:15, before the 4:30 dinner opening. Deals from the venue's 2020 happy-hour menu (file last updated March 2025), "
              'still linked from its site.')
w['research_notes'] = ('Venue home page (undated): happy hour Mon-Sat 4:15-6:00pm, bar top seating only. fix32: the executor '
    'read the linked PDF on the Mac (pdf2txt.swift): "monday - saturday 4:15pm - 6:00pm BAR TOP ONLY everything is $6", '
    'snacks and draft beer, cocktail, wine. The PDF is titled "HH Menu 2020 to Print" (created 2020-09-01, modified '
    '2025-03-04), so confidence is low (brief step 14).')

# Lions Share Tavern: /menus/happy-hour.pdf (the researcher guessed the wrong path) read on the Mac, text plus a sips
# render: "HAPPY HOUR daily in the bar, lounge & patio 4-6pm". The venue is closed Sun-Mon, so the homepage's Tue-Sat
# stands. The PDF's own prices are added; it lists fish & chips at $16 where the homepage says half-price.
ls = by['Lions Share Tavern']
w = ls['windows'][0]
PDF = 'https://www.lionssharetavern.com/menus/happy-hour.pdf'
w['deals'] += [
    {'type': 'food', 'desc': '$4 French fries', 'price': 4},
    {'type': 'food', 'desc': '$8 smoked salmon', 'price': 8},
    {'type': 'food', 'desc': '$12 shrimp cocktail (4 pcs)', 'price': 12},
    {'type': 'food', 'desc': '$16 dry-aged burger', 'price': 16},
    {'type': 'drink', 'desc': '$6 Wiseacre Tiny Bomb', 'price': 6},
]
w['sources'].append(src(PDF))
w['area'] = None
w['notes'] = 'In the bar, lounge and patio. Bar opens at 4 pm; dining room at 5 pm.'
w['research_notes'] = ('Venue homepage (2026 copyright): Tue-Sat 4-6pm, $2 oysters, half-price fish and chips, $8 wine, $10 '
    'cocktails; the menus page agrees on days and times. fix32: the executor read the happy-hour PDF '
    '(/menus/happy-hour.pdf) on the Mac with text and a sips render: "daily in the bar, lounge & patio 4-6pm", oysters $2 '
    'ea, fries $4, smoked salmon $8, shrimp cocktail $12, fish & chips $16, dry-aged burger $16, cocktails $10, two wines '
    '$8, Wiseacre Tiny Bomb $6. The venue is closed Sun-Mon, so the days stay Tue-Sat. The PDF prices fish & chips at $16 '
    'where the homepage says half-price; the homepage deal is kept. A June 2026 press release described a 4-5:30 '
    '"Tiny Tinis" bar hour; the venue\'s own current pages were used.')

# Sportsman's Grille: the May 2025 menu PDF read on the Mac. Page 4: "BELLE MEADE HAPPY HOUR 2 to 6 DAILY, $1.00 off
# Pints, 1/2 off Well Liquor, 1/2 off House Wines". It ties the daily 2-6 happy hour to this (Belle Meade) location.
# The homepage's current deals (half-off draft beer) are kept; the 2025 menu's "$1 off pints" is noted.
s = by["Sportsman's Grille"]
w = s['windows'][0]
w['sources'].append(src('https://sportsmansgrilletn.com/wp-content/uploads/2025/05/SG-MENU-5-25.pdf'))
w['corroborated'] = False
w['notes'] = 'Daily 2-6pm at the Belle Meade location.'
w['research_notes'] = ("Homepage (undated): 'Happy Hour (2-6 PM daily)', half-off well and liquor, draft beer and house wines. "
    "fix32: the executor read the venue's May 2025 menu PDF on the Mac (pdf2txt.swift). Page 4: 'BELLE MEADE HAPPY HOUR "
    "2 to 6 DAILY', $1.00 off pints, half off well liquor, half off house wines. That ties the daily 2-6 to this location. "
    "The homepage's half-off draft beer is kept over the 2025 menu's $1 off pints. StyleBlueprint (undated) agrees on "
    "2-6 daily. Closure search for 2026: nothing for 5405 Harding Pike.")

# Maggie's Place: the Specials page's happy-hour graphic, downloaded and read: "HAPPY HOUR MON, WED-FRI 3-7PM: $2 OFF
# ALL DRAFTS, $5 MONTUCKY 16oz, $7/GLASS HOUSE WHITE & RED WINE, 5 FOR $8 MINI TACOS, $20 32oz / $36 60oz MARG
# PITCHERS". A venue source for the window: med, and the guide note goes.
m = by["Maggie's Place"]
w = m['windows'][0]
w['sources'] = [src('https://www.maggiesplacenashville.com/specials')] + w['sources']
w['deals'] = [
    {'type': 'drink', 'desc': '$2 off all drafts', 'price': None},
    {'type': 'drink', 'desc': '$5 Montucky 16oz', 'price': 5},
    {'type': 'drink', 'desc': '$7 house white and red wine by the glass', 'price': 7},
    {'type': 'drink', 'desc': '$20 32oz / $36 60oz margarita pitchers', 'price': None},
    {'type': 'food', 'desc': '5 mini tacos for $8', 'price': 8},
]
w['confidence'] = 'med'
w['corroborated'] = True
w.pop('notes', None)
w['research_notes'] = ("fix32: the executor downloaded the Specials page's happy-hour graphic and read it: 'HAPPY HOUR MON, "
    "WED-FRI 3-7PM', $2 off all drafts, $5 Montucky 16oz, $7/glass house white & red wine, 5 for $8 mini tacos, "
    "$20 32oz / $36 60oz marg pitchers. Undated, so med. Nashville Guru's business page (confirmed 10/23/26) agrees. "
    "Hours from the venue's homepage. No 2026 closure found (opened Dec 2025).")

# S5 round 1 miss: the Taco Tuesday special is from an undated venue page, so med, not high (brief confidence rule).
m['windows'][1]['confidence'] = 'med'

# Nicky's Coal Fired: the site's menu graphics (food, drinks, holiday cocktails), downloaded and read: regular menus,
# no happy-hour section. The Guru-sourced window stays low.
n = by["Nicky's Coal Fired"]
n['windows'][0]['research_notes'] = ("The venue's site says 'the best happy hour in the Nations' but posts no days, times or "
    "deals. fix32: the executor downloaded and read the site's menu graphics (food, wine, cocktails, taps, holiday "
    "drinks): regular menus with no happy-hour section. Window from the Nashville Guru business page (Mon-Fri "
    "5:00-6:00pm, last confirmed 10/27/26); other guides list other times. No 2026 closure found.")

# Long parentheticals (validate lint), trimmed to the posted words.
for w in by['Miel Restaurant']['windows']:
    for dl in w['deals']:
        if dl['desc'].startswith('Rocks Cocktails $7'):
            dl['desc'] = 'Rocks cocktails $7: vodka, gin or bourbon with soda'
for w in by["Otto's Bar"]['windows']:
    for dl in w['deals']:
        if dl['desc'].startswith('Taco Tuesday: 2 tacos for $5'):
            dl['desc'] = 'Taco Tuesday: 2 tacos for $5, dine-in only'

# Five Points Pizza: the 2026 menu PDF the researcher didn't need is not a happy-hour source; wording kept plain.
f = by['Five Points Pizza (West Nashville)']
f['windows'][0]['research_notes'] = ('West Nashville page (undated): happy hour weekdays 2:00-6:00pm with those two combos. '
    'No 2026 closure found for this location.')

for n_ in out['not_added']:
    if n_['lead'] == 'Hathorne':
        n_['detail'] = 'researcher: closed (Nashville Guru marks it closed)'

json.dump(out, open(os.path.join(H, '..', 'research-west.json'), 'w'), indent=1, ensure_ascii=False)
print('added %d, not added %d' % (len(out['added']), len(out['not_added'])))
for l in log:
    print(' ', l)
