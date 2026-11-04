#!/usr/bin/env python3
"""fix31: combine the four South batches into research/research-south.json, with the executor's fixes.

Generic (as fix30): HTML entities in names, hours past midnight as 00:00-02:00, corroborated only with 2+
sources, empty notes dropped. Then every linked menu the researchers flagged "PDF not readable" (or an image
menu), read on the Mac (pdf2txt.swift; sips renders where the text had no layer or an ambiguous layout; image
menus downloaded and read), so merge_v2zone.py's fix31 unopened-menu check passes. Files: research/south/pdf/.
"""
import json, html, os
H = os.path.dirname(os.path.abspath(__file__))
out = {'added': [], 'not_added': []}
for i in range(1, 5):
    b = json.load(open(os.path.join(H, 'batch%d-out.json' % i)))
    out['added'] += b['added']; out['not_added'] += b['not_added']
FIX = {'24:00': '00:00', '25:00': '01:00', '26:00': '02:00'}
log = []
for v in out['added']:
    for k in ('lead', 'name'):
        if '&amp;' in v[k]:
            v[k] = html.unescape(v[k]); log.append('unescaped ' + v[k])
    for d, rs in v['hours'].items():
        for r in rs:
            if r[1] in FIX:
                log.append('%s %s end %s -> %s' % (v['name'], d, r[1], FIX[r[1]])); r[1] = FIX[r[1]]
    for w in v['windows']:
        if w.get('corroborated') and len(w['sources']) < 2:
            w['corroborated'] = False; log.append('%s: corroborated false (one source)' % v['name'])
        if w.get('notes') == '':
            del w['notes']
for l in out['not_added']:
    l['lead'] = html.unescape(l['lead'])
by = {v['name']: v for v in out['added']}
D = '2026-11-04'


def src(url):
    return {'url': url, 'kind': 'venue', 'seen': D, 'confirmed': None}


# 12 South Taproom: the happy hour is text on the venue's menu page; the "images" are the regular food menu
# (burgers, entrees, sides; executor downloaded and read them). The same page lists Tue, Thu and Sun specials
# the researcher left out (brief step 6: same venue source).
t = by['12 South Taproom & Grill']
P = 'https://www.12southtaproom.com/lead-collection'
t['windows'][0]['research_notes'] = ('Venue menu page (drink section, text): "HAPPY HOUR (M. W. TR. F. SUN. 2-6PM) $1 OFF '
    'Drafts, Wine, Cocktails, Wells, N/A Beers + Mocktails". Page has no date. Open hours on the site: Mon-Sat 11am to '
    "'late(ish)', Sun 11am-10pm; no closing time for Mon-Sat, so hours left empty. fix31: the executor downloaded the "
    'page\'s five menu images; they are the regular food menu (burgers, entrees, sides, kids) and the logo, no happy hour.')
sun = t['windows'][1]
sun['deals'] += [
    {'type': 'drink', 'desc': '$4 Beermosas', 'price': 4},
    {'type': 'drink', 'desc': '$5 mimosas', 'price': 5},
    {'type': 'drink', 'desc': '$7 Bloody Marys', 'price': 7},
]
sun['research_notes'] = ('Venue menu page: "SUNDAY Happy Hour all day & $4 Beermosas, $5 Mimosas & $7 Bloody Marys"; '
    'opening 11am Sunday per the site. fix31: the Sunday drink prices added by the executor from the same page.')
t['windows'] += [
    {'days': ['TUE'], 'start': '11:00', 'end': 'close', 'area': None, 'kind': 'special',
     'deals': [{'type': 'drink', 'desc': '2-for-1 drafts ($7 and under), house wine and double tall wells', 'price': None},
               {'type': 'food', 'desc': '$5 queso or hummus', 'price': 5}],
     'sources': [src(P)], 'last_verified': D, 'corroborated': False, 'confidence': 'med',
     'notes': 'Times not posted: set to the 11:00 opening to close.',
     'research_notes': 'Venue menu page: "TUESDAY 2-4-1\'s (drafts $7 & less, house wine and double tall well drinks) & $5 '
                       'Queso or Hummus". fix31: added by the executor (brief step 6).'},
    {'days': ['THU'], 'start': '11:00', 'end': 'close', 'area': None, 'kind': 'special',
     'deals': [{'type': 'drink', 'desc': '$8 beer and a shot (any domestic can + any well)', 'price': 8}],
     'sources': [src(P)], 'last_verified': D, 'corroborated': False, 'confidence': 'med',
     'notes': 'Times not posted: set to the 11:00 opening to close.',
     'research_notes': 'Venue menu page: "THURSDAY Beer & A Shot $8 (Any Domestic Can + Any Well Liquor)". fix31: added by '
                       'the executor (brief step 6).'},
]

# Bottle Cap: the June 2026 menu PDF has no text layer; rendered with sips and read: "HAPPY HOUR MONDAY THRU FRIDAY
# 3PM - 7PM, ALL DAY WEDNESDAY: draft beer $1 off, domestic buckets $15, fruit crushes & mules $7". Matches.
b = by['Bottle Cap']
PDF = 'https://bottlecapnashville.com/wp-content/uploads/2026/06/Menu-Food-Drink-June-2026.pdf'
b['windows'][0]['research_notes'] = ('Venue pages: Happy Hour Mon-Fri 3pm-7pm. Nashville Guru (confirmed 2026-10-19) agrees '
    'on times and deals. fix31: the executor read the June 2026 menu PDF on the Mac (no text layer, so rendered with '
    'sips): "HAPPY HOUR MONDAY THRU FRIDAY 3PM - 7PM, ALL DAY WEDNESDAY", draft beer $1 off, domestic buckets $15, '
    'fruit crushes & mules $7. Matches the deals above.')
b['windows'][1]['research_notes'] = ('Venue special-events page: happy hour all day Wednesday. fix31: the June 2026 menu PDF '
    '(read on the Mac, sips render) says "ALL DAY WEDNESDAY" with the same three deals.')
for w in b['windows']:
    w['sources'].append(src(PDF))

# bartaco: the printable menu (2026-10-06) read on the Mac: the regular food and drink menu, no happy-hour section.
w = by['bartaco']['windows'][0]
w['research_notes'] = ("Venue location page: 'high tide happy hour' at the bar weekdays 3-6pm; Mon-Thu also the last 1.5 "
    'hours before close. The linked High Tide page (bartaco.com/nashvillehightidehour/) has no days, times or deals. '
    "Site says only '11am - late, daily' for hours. No guide confirmed in 2026 lists bartaco deals. fix31: the executor "
    'read the printable menu PDF (dated 2026_10_06 in its name) on the Mac: the regular menu, no happy-hour section '
    'or prices.')

# Postino: beverage and main menus (10.08.26) read on the Mac: regular menus; no happy-hour section.
w = by['Postino 12 South']['windows'][0]
w['research_notes'] = ("Venue location page: 'Daily until 5 PM', $6 glasses of wine and $6 pitchers of beer. Page shows "
    'only the current day\'s hours (11 AM-11 PM). Nashville Guru (confirmed 10/27/26) agrees on $6 wine and pitchers. '
    'fix31: the executor read the beverage and main menu PDFs (P10_TN_Bev / P10_TN_Main, 10.08.26) on the Mac: regular '
    'menus, no happy-hour section. The brunch PDF is a brunch menu.')

# Char: happy-hour PDF read on the Mac; it matches the researcher's list exactly (prices on their lines, one column).
w = by['Char']['windows'][0]
w['sources'].append(src('https://nashville.charrestaurant.com/nashville-happy-hour-pdf'))
w['research_notes'] = ('Venue happy-hour page lists Sun-Thu 3-6pm in the lounge with all deals. fix31: the executor read '
    'the happy-hour PDF on the Mac (pdf2txt.swift; one column, each price on its item\'s line): the same eight bites and '
    '"$5 DRAFT BEERS | $7 WINES | $9 COCKTAILS"; it gives no days.')
for d in w['deals']:
    if d['desc'].startswith('Cocktails $9'):
        d['desc'] = '$9 cocktails'
    elif '(' in d['desc']:
        d['desc'] = '$%s %s' % (d['price'], d['desc'].split(' (')[0].lower()) if d['price'] else d['desc']

# Doughbird: the linked PDF is the main menu (05.27.26 code), read on the Mac: no happy-hour section.
w = by['Doughbird']['windows'][0]
w['research_notes'] = ('Venue page gives Mon-Fri 3-6pm at the bar, no deals. Nashville Guru business page (confirmed '
    '10/23/26) supplies deals and says bar and patio; venue says bar, used the venue\'s. fix31: the executor read the '
    'linked main-menu PDF on the Mac: the regular menu, no happy-hour section.')

# North Italia: its Spring 2026 happy-hour PDF, read on the Mac and rendered (letter-spaced text puts prices on their
# own lines). Venue deals replace the guide's.
n = by['North Italia']
w = n['windows'][0]
w['deals'] = [
    {'type': 'food', 'desc': '$8 zucca chips', 'price': 8},
    {'type': 'food', 'desc': '$12 cacio e pepe arancini', 'price': 12},
    {'type': 'food', 'desc': '$14 Italian meatballs', 'price': 14},
    {'type': 'food', 'desc': '$10 garlic knot sliders', 'price': 10},
    {'type': 'food', 'desc': '$18 Margherita or cacio e pepe pizza', 'price': 18},
    {'type': 'food', 'desc': "$18 chef's board", 'price': 18},
    {'type': 'drink', 'desc': 'Wine or red sangria $8 glass, $30 bottle', 'price': None},
    {'type': 'drink', 'desc': '$12 craft cocktails', 'price': 12},
    {'type': 'drink', 'desc': '$5.50 all beers', 'price': 5.5},
    {'type': 'drink', 'desc': '$44 bottle of featured wine and a pizza or board', 'price': 44},
]
w['sources'] = [s for s in w['sources'] if s['kind'] != 'guide'] + [src('https://www.northitalia.com/wp-content/uploads/2025/08/NOR_HH_SPRING-2026-NMRO_V3.pdf')]
w['corroborated'] = False
w['confidence'] = 'high'
w['notes'] = 'In the bar. Half-off bottles of wine all day Monday (excludes reserve).'
w['research_notes'] = ('Venue location page gives Mon-Fri 3-6pm in the bar. fix31: the executor read the happy-hour PDF '
    '(NOR_HH_SPRING-2026, V3) on the Mac with pdf2txt.swift and a sips render: "Happy Hour served in the bar MONDAY - '
    'FRIDAY 3 P.M. - 6 P.M.", the food list with prices, page 2 Wine & Sangria 8/30, Craft Cocktails 12, Zero Proof 8, '
    'Beer 5.5, Bottle & Board 44. These venue deals replace the Nashville Guru list the researcher used.')

# etc.: drink, mid-day, dinner and lunch PDFs read on the Mac: regular menus. The drink menu says only "rotating
# cocktail and wine specials"; the mid-day menu (mon-fri 2-4pm) is a menu, not happy hour.
w = by['etc.']['windows'][0]
w['research_notes'] = ('Venue home page and menus page agree on Mon-Sat 4:00-6:30 at the bar. Site shows Sunday brunch '
    'yet Sunday closed in hours; hours taken from the hours section. fix31: the executor read the four linked PDFs '
    '(drink, mid-day, dinner, lunch) on the Mac: regular menus with no happy-hour section; the drink menu mentions '
    '"rotating cocktail and wine specials" and the mid-day menu is served Mon-Fri 2-4pm (a menu, not a happy hour).')

# Hearts: the venue's happy-hour image (HappyHour_draft_website.jpg), downloaded and read: venue deals replace Guru's.
h = by['Hearts']
w = h['windows'][0]
w['deals'] = [
    {'type': 'drink', 'desc': '$10 spritz or glass of wine', 'price': 10},
    {'type': 'drink', 'desc': '$35 spritz pitcher or bottle of wine', 'price': 35},
    {'type': 'drink', 'desc': '$8 Narragansett and a shot of bourbon', 'price': 8},
    {'type': 'food', 'desc': '$7 Vegemite pimento cheese and toast', 'price': 7},
    {'type': 'food', 'desc': '$4 chicken salt fries', 'price': 4},
]
w['sources'] = [s for s in w['sources'] if s['kind'] != 'guide']
w['corroborated'] = len(w['sources']) >= 2
w.pop('notes', None)
w['research_notes'] = ('Venue locations page: happy hour 2PM to close, every day (matches Nashville Guru, confirmed '
    '10/27/26). Posted hours end at 3PM/5PM, which conflicts with "to close"; both as posted. fix31: the venue menu '
    'page\'s happy-hour image (HappyHour_draft_website.jpg) was downloaded and read by the executor: $10 spritz or glass '
    'of wine, $35 spritz pitcher or bottle, $8 Narragansett + shot of bourbon, $7 Vegemite pimento cheese + toast, '
    '$4 chicken salt fries. These venue deals replace the guide\'s list.')

# The GreenHouse Bar: "Happy All Day" list; only the items the page prices are deals (prices read from the page
# text, each "$" line after its item). Unpriced drink names are not deals.
g = by['The GreenHouse Bar']
for w in g['windows']:
    w['deals'] = [
        {'type': 'drink', 'desc': '$3 Jello shots (5 for $12)', 'price': 3},
        {'type': 'drink', 'desc': '$3 GreenHouse shots, rum melon (5 for $12)', 'price': 3},
        {'type': 'drink', 'desc': 'PBR tallboy bucket, 3 for $18', 'price': None},
    ]
    w['notes'] = w['notes'].replace(' Some items show no price on the page.', '') + ' Other drinks on the list have no posted price.'
    w['research_notes'] += (' fix31: the executor kept only the priced items as deals; the list\'s other drinks (Lynchburg '
        '75, Double Jack Honey, Tipsy Tea, Roberta\'s Margarita, Sangria, Ranch Water, Fish Bowl) show no price, and the '
        'page\'s "$3 for $18" after Ranch Water is ambiguous, so it is not used.')

json.dump(out, open(os.path.join(H, '..', 'research-south.json'), 'w'), indent=1, ensure_ascii=False)
print('\n'.join(log))
print('added %d, not added %d' % (len(out['added']), len(out['not_added'])))
print('no hours:', [v['name'] for v in out['added'] if not v['hours']])
print('empty-deal HH windows:', [(v['name'], ','.join(x['days'])) for v in out['added'] for x in v['windows'] if x['kind'] == 'happy_hour' and not x['deals']])
