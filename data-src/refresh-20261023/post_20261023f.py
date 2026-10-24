#!/usr/bin/env python3
"""fix12 post-step 2 (TJ, 2026-10-23 19:07 CDT: "The lunch options on some of these aren't clear.").
Rewrites the four lunch windows' deal text and notes for a reader: condensed, nothing added (papadum and orange
slices dropped for length); the research wording moves to `research_notes` on the window. Input venues-20261023e.json -> output venues-20261023f.json."""
import json
FIX = {
 ('ik-20959', 0): dict(area='dine-in only',
   deals=[{'type':'food','desc':'Veg thali: 3 veg entrees, lentils, appetizer, rice, naan, dessert','price':'$16'},
          {'type':'food','desc':'Non-veg thali: 2 meat entrees, 1 veg entree, tandoori chicken, lentils, rice, naan, dessert','price':'$18'}],
   notes='Set-price lunch plates.'),
 ('ik-9130', 1): dict(area=None,
   deals=[{'type':'food','desc':'3-course lunch: soup or salad, entree, dessert','price':'$32'}],
   notes='Weekday lunch prix fixe, per person.'),
 ('ik-12065', 1): dict(area=None,
   deals=[{'type':'food','desc':"Bento box lunch: chef's choice entree, sushi roll, salad, edamame",'price':None}],
   notes='Changes daily. Price not posted.'),
 ('ik-18632', 0): dict(area='dine-in only',
   deals=[{'type':'food','desc':'Lunch plate with fries: pulled pork, burger, tenders, slaw dog or bologna','price':'$6.99'}],
   notes='Their social posts also advertise a "$10 lunch" Tue-Fri.'),
}
d = json.load(open('venues-20261023e.json'))
done = set()
for v in d['venues']:
    for i, w in enumerate(v['windows']):
        k = (v['id'], i)
        if k in FIX:
            assert w['kind'] == 'lunch', k
            w['research_notes'] = w['notes']
            w.update(FIX[k]); done.add(k)
assert done == set(FIX), set(FIX) - done
json.dump(d, open('venues-20261023f.json', 'w'), indent=1, ensure_ascii=False)
print('lunch windows rewritten:', len(done))
