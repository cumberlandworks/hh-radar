#!/usr/bin/env python3
"""fix30: combine the four North batches into research/research-north.json, with the executor's fixes:
HTML entities in names, hours past midnight as 00:00-02:00, corroborated only with 2+ sources, and the
three linked PDFs read on the Mac (pdf2txt.swift / sips render): Sedona, Butchertown Hall, Henrietta Red."""
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
D = '2026-11-03'

# Sedona: the PDF shows one Mon-Fri 3-6:30 happy hour ("STH Steals"); the day list beside it is weekly specials.
s = by['Sedona Taphouse']
pdf = 'https://sedonataphouse.com/wp-content/uploads/2019/01/HappyHourMenu_Nashville_3.17.26.pdf'
w = s['windows'][0]
w['days'] = ['MON', 'TUE', 'WED', 'THU', 'FRI']
w['deals'] = [
    {'type': 'drink', 'desc': '50% off all drafts', 'price': None},
    {'type': 'drink', 'desc': '50% off select craft beer bottles and cans', 'price': None},
    {'type': 'drink', 'desc': '50% off house wine by the glass', 'price': None},
    {'type': 'drink', 'desc': '$6 red or white sangria by the glass', 'price': 6},
    {'type': 'drink', 'desc': '$8 craft cocktails and martinis', 'price': 8},
    {'type': 'food', 'desc': '$7 truffle fries and flatbreads', 'price': 7},
    {'type': 'food', 'desc': '$9 canyon nachos or spicy Thai shrimp', 'price': 9},
]
w['sources'].append({'url': pdf, 'kind': 'venue', 'seen': D, 'confirmed': None})
w.pop('notes', None)
w['research_notes'] = ('Venue pages state happy hour Mon-Fri 3pm-6:30pm and link the happy-hour PDF (dated 3.17.26 in its '
    'file name). fix30: the executor read the PDF on the Mac (pdf2txt.swift, then a rendered image, since the text '
    'columns interleave): "STH Steals, Monday - Friday 3pm - 6:30pm" with Beer + Wine 50% off, $6 sangria, $8 craft '
    'cocktails + martinis (Paloma, BYO Mule, STH Spritz, Lemon Drop, Pomegranate Margarita Spritzer), $7 bites '
    '(truffle fries, five flatbreads), $9 canyon nachos / spicy Thai shrimp. The day-by-day column beside it is '
    '"Weekly Specials" (Mon dine-out for charity, Tue $5 brut or old fashioned, Wed half-off wine bottles), not happy '
    'hour, so the researcher\'s Thursday-only window was a misread and is folded into Mon-Fri.')
s['windows'] = [w]

# Butchertown Hall: happy-hour PDF (uploaded 2026-09-17), "4P-6P SUN-FRI", food list with prices.
b = by['Butchertown Hall']
w = b['windows'][0]
w['deals'] = [
    {'type': 'food', 'desc': '$5 house salsas', 'price': 5},
    {'type': 'food', 'desc': 'Queso $8 small, $12 large', 'price': None},
    {'type': 'food', 'desc': '$9 chips and guac', 'price': 9},
    {'type': 'food', 'desc': '$14 brisket nachos', 'price': 14},
    {'type': 'food', 'desc': '$5 french fries', 'price': 5},
    {'type': 'food', 'desc': 'Tacos: two for $10, three for $14', 'price': None},
    {'type': 'food', 'desc': '$12 sandwiches with fries (BBQ pork, smoked brisket, cheeseburger)', 'price': 12},
    {'type': 'drink', 'desc': "$21 'Girl Dinner': Bombay dirty martini, fries, Caesar salad", 'price': 21},
]
w['sources'].append({'url': 'https://www.butchertownhall.com/s/NEWHappyWeb.pdf', 'kind': 'venue', 'seen': D, 'confirmed': None})
w.pop('notes', None)
w['research_notes'] = (w['research_notes'].replace('PDF not readable: ', 'PDF (WebFetch could not read it): ')
    + ' fix30: the executor read the PDF on the Mac (pdf2txt.swift and a rendered image; Squarespace upload stamp '
    '2026-09-17): "HAPPY HOUR 4P-6P SUN-FRI", food items with prices as listed; no drink list beyond the Girl Dinner.')

# Henrietta Red: beverage book PDF (created 2026-10-02), page 3 "HAPPY HOUR | 5-6PM EVERY DAY".
h = by['Henrietta Red']
w = h['windows'][0]
w['deals'] = [
    {'type': 'food', 'desc': "$2 oysters (chef's choice)", 'price': 2},
    {'type': 'drink', 'desc': '$10 classic cocktails', 'price': 10},
    {'type': 'drink', 'desc': '$7 cava', 'price': 7},
    {'type': 'drink', 'desc': '$7 white, red or rose wine', 'price': 7},
    {'type': 'drink', 'desc': '$7 rotating draft', 'price': 7},
]
w['sources'].append({'url': 'https://henriettared.com/s/HRBeverageBook1002.pdf', 'kind': 'venue', 'seen': D, 'confirmed': None})
w['notes'] = 'Closed Mondays; the menu says "every day" for the days the restaurant is open.'
w['research_notes'] += (' fix30: the executor opened the beverage book on the Mac (PDF created 2026-10-02, pdf2txt.swift): '
    'page 3 "HAPPY HOUR | 5-6PM EVERY DAY" with $2 oysters, $10 cocktails (Vesper, Tommy\'s Margarita, Old Fashioned, Daiquiri, Gold Rush, French 75), $7 cava, $7 white/red/rose, $7 rotating draft.')


# The Goat: the linked happy-hour PDF (created 2026-08-18), read on the Mac: "EVERY DAY | 3PM - 6PM".
g = by['The Goat (Germantown)']
w = g['windows'][0]
w['deals'] = [
    {'type': 'food', 'desc': '$7.99 buffalo cauliflower', 'price': 7.99},
    {'type': 'food', 'desc': '$8.99 Italian pizza rolls', 'price': 8.99},
    {'type': 'food', 'desc': '$6.99 fried green tomatoes', 'price': 6.99},
    {'type': 'food', 'desc': '$9.99 whipped feta and honey', 'price': 9.99},
    {'type': 'food', 'desc': '$8.99 crispy Brussels and sweet potatoes', 'price': 8.99},
    {'type': 'food', 'desc': '$11.99 Bianca or Dueling Pepperoni pizza', 'price': 11.99},
    {'type': 'drink', 'desc': '$6 house wines', 'price': 6},
    {'type': 'drink', 'desc': '$7 cocktails', 'price': 7},
    {'type': 'drink', 'desc': '$2 off all drafts', 'price': None},
]
w['sources'].append({'url': 'https://www.lcgoat.com/s/Goat-New-Happy-Hour-Menu-kred.pdf', 'kind': 'venue', 'seen': D, 'confirmed': None})
w.pop('notes', None)
w['research_notes'] = ('Venue location page lists Happy Hour every day, 3 PM to 6 PM. Address and hours from the same page. '
    'fix30: the linked Happy Hour Menu PDF (WebFetch could not read it; created 2026-08-18) was read on the Mac '
    '(pdf2txt.swift and a rendered image): "EVERY DAY | 3PM - 6PM", five shareables and two pizzas with prices, $6 house '
    'wines, $7 cocktails (Blueberry Mule, Classic Margarita, Goat Smash, Strawberry Mojito), $2 off all drafts.')

# Waldo's: the venue's "Daily 3pm - 6pm, All Day Tuesday + Sunday" is one happy hour with one deal list; Nashville Guru
# (confirmed 2026-10-27) lists the same deals for Tue and Sun all day. Split so the days don't overlap.
wd = by["Waldo's Chicken & Beer (Germantown)"]
w0, w1 = wd['windows']
w0['days'] = ['MON', 'WED', 'THU', 'FRI', 'SAT']
w0['notes'] = '3pm-6pm; all day on Tuesday and Sunday.'
w1['deals'] = [dict(x) for x in w0['deals']]
w1['notes'] = 'All day: from the 11:00 opening.'
w1['sources'].append({'url': 'https://nashvilleguru.com/businesses/waldos-chicken-and-beer', 'kind': 'guide', 'seen': D, 'confirmed': '2026-10-27'})
w1['corroborated'] = True
w1['research_notes'] = ("Venue's Germantown page: 'Happy Hour: 2-4-1 Draft Beer + $5 Waldo-Ritas Daily 3pm - 6pm All Day "
    "Tuesday + Sunday' (one happy hour, one deal list). fix30 empty-deals pass: Nashville Guru's business page (confirmed "
    "10/27/26) lists Tue and Sun as all day with the same 2-for-1 drafts and $5 Waldo-Ritas. The daily window is set to the "
    "other five days so the two don't overlap.")

# Tailor: guide-only (step 3). Guru names "full bar and rotating seasonal bar snacks", which are not deals.
t = by['Tailor']
w = t['windows'][0]
w['deals'] = []
w['notes'] = ('Happy hour as listed by Nashville Guru, confirmed 2026-10-21, in the Living Room; it names no prices '
    '(full bar, rotating seasonal bar snacks). Deals not posted. Check with the venue.')
w['research_notes'] += (' fix30 empty-deals pass: Guru lists "Full bar and rotating seasonal bar snacks" with no prices and '
    'no end time; the venue home page mentions the Living Room (specialty cocktails, snacks) but no happy hour or '
    'discount. The two non-price items were removed from deals.')

json.dump(out, open(os.path.join(H, '..', 'research-north.json'), 'w'), indent=1, ensure_ascii=False)
print('\n'.join(log))
print('added %d, not added %d' % (len(out['added']), len(out['not_added'])))
print('no hours:', [v['name'] for v in out['added'] if not v['hours']])
print('empty-deal HH windows:', [(v['name'], ','.join(x['days'])) for v in out['added'] for x in v['windows'] if x['kind'] == 'happy_hour' and not x['deals']])
