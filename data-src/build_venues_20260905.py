#!/usr/bin/env python3
"""Consolidate research batches + inKind recon into venues.json (v1, 35 inKind venues).
Core-thread review corrections are applied here, in code, so the rebuild is reproducible.
Run: python3 build_venues_20260905.py  (from the hh-radar dir)"""
import json, glob, re, datetime, pathlib

HERE = pathlib.Path(__file__).parent
TODAY = "2026-09-05"
DAYS = ["MON","TUE","WED","THU","FRI","SAT","SUN"]
recon = json.load(open(HERE/"inkind-recon-20260905.json"))
ik = {v["id"]: v for v in recon["hh"]}

research = {}
for f in sorted(glob.glob(str(HERE/"research"/"batch*.json"))):
    for v in json.load(open(f))["venues"]:
        research[v["id"]] = v

NEIGHBORHOOD = {7491:"Germantown",13114:"Belle Meade / West Nashville",12961:"East Nashville",5822:"Downtown (Fifth + Broadway)",
 9475:"Downtown",13452:"Franklin (Cool Springs)",14558:"The Gulch",3389:"SoBro / Pie Town",9590:"Berry Hill",12498:"East Nashville",
 15988:"Franklin (Cool Springs)",8588:"Downtown (Fifth + Broadway)",8589:"Franklin (McEwen)",18627:"Bellevue",11135:"Marathon Village",
 14442:"12 South",15614:"The Gulch",13100:"The Gulch",14947:"Murfreesboro",12246:"East Nashville",9316:"The Gulch",15771:"Midtown",
 10507:"Wedgewood-Houston",12065:"Charlotte / Sylvan Park",17961:"Sylvan Park",10968:"East Nashville",16089:"SoBro",4949:"The Gulch / 8th Ave S",
 17673:"East Nashville",13246:"Germantown",13244:"Brentwood",13245:"Sylvan Park",11237:"Midtown",11236:"Midtown",13745:"Franklin (Cool Springs)"}

def hours_from_ik(v):
    out = {}
    for line in v["hours"]:
        d, rng = line.split(" ",1)
        out[d] = [r.split("-") for r in rng.split(",")]
    return out

def W(days, start, end, deals, sources, last_verified, corroborated, confidence, notes="", area=None, kind="happy_hour"):
    return {"days":days,"start":start,"end":end,"area":area,"kind":kind,"deals":deals,"sources":sources,
            "last_verified":last_verified,"corroborated":corroborated,"confidence":confidence,"notes":notes}
def D(t,desc,price=None): return {"type":t,"desc":desc,"price":price}

# ---- Core-thread corrections (evidence opened by the reviewing thread on 2026-09-05) ----
OVERRIDE = {}

# Cajun Steamer: agent used stale Yelp; the venue's own bar-menu PDF (linked from its site, file dated 2025-06) read in-browser.
CS_PDF = "https://csbarandgrill.wpenginepowered.com/wp-content/uploads/2025/06/CS-Bar-Menu.pdf"
OVERRIDE[13452] = dict(windows=[
  W(["MON","WED","THU","FRI"],"15:00","18:00",
    [D("drink","$1 off all beer and wine"),D("food","Fried pickles","$7"),D("food","Tuna dip","$7"),D("food","Spinach dip","$9"),D("food","Sliders","$9")],
    [CS_PDF,"https://cajunsteamer.com/location/franklin-tn/"],TODAY,False,"med",
    "Venue bar-menu PDF: 'HAPPY HOUR 3PM-6PM MON-FRI, ALL DAY ON TUESDAYS'. PDF file is dated 2025-06 but is what the live site links today. Also all-day every day: $7 house marg, $9 frozen drinks, $5 wells, $7 N/A daiquiris."),
  W(["TUE"],"11:00","close",
    [D("drink","$1 off all beer and wine"),D("food","Fried pickles","$7"),D("food","Tuna dip","$7"),D("food","Spinach dip","$9"),D("food","Sliders","$9")],
    [CS_PDF],TODAY,False,"med","'Fat Tuesday — happy hour all day' per the same PDF."),
  W(["WED"],"11:00","21:00",[D("drink","Whiskey Wednesday: $2 off Maker's Mule & NOLA Fashioned, $5 Jack Daniel's")],
    [CS_PDF,"https://cajunsteamer.com/location/franklin-tn/"],TODAY,True,"med","Daily specials run 11am-9pm per PDF; corroborated by an Instagram post embedded on the location page.",kind="special"),
  W(["MON"],"11:00","21:00",[D("drink","Margarita Monday: $2 off all margaritas (house, skinny, frozen)")],[CS_PDF],TODAY,False,"med","",kind="special"),
  W(["THU"],"11:00","21:00",[D("drink","Tito's Thursday: $2 off Bayou Bellini & Bourbon St. Bloody Mary, $5 Tito's")],[CS_PDF],TODAY,False,"med","",kind="special"),
  W(["FRI"],"11:00","21:00",[D("drink","French Quarter Friday: $2 off Hurricane & CS French 75")],[CS_PDF],TODAY,False,"med","",kind="special"),
], disagreements=["Yelp summary claims 'happy hour every day 3-6pm, $3.50 margaritas, $5 apps'; the venue's own bar-menu PDF says Mon-Fri 3-6 + all day Tuesday with different items. PDF used."])

# Tantisimo: 'hora feliz' PDF read directly (static1.squarespace.com …/Bev9.26.pdf): 'daily from 4pm-6pm'. Closed Mondays.
TT_PDF = "https://static1.squarespace.com/static/6508ca797db40562b8b4ddee/t/6a97325f1c91876b08f08131/1788293727865/Bev9.26.pdf"
OVERRIDE[17961] = dict(windows=[
  W(["TUE","WED","THU","FRI","SAT","SUN"],"16:00","18:00",
    [D("food","Chips y salsa (lard-fried tortilla chips, salsa mesa)","$8"),D("food","Churrasco skewers (picanha, charred onion glaze)","$7"),
     D("food","Empanadas de pollo","$10"),D("food","Dos tacos (daily selection)","$10"),
     D("drink","House white / red wine","$7"),D("drink","Barena or Quilmes lager","$3"),D("drink","Margaret / Rested Pomelo / Much Fashioned cocktails","$10"),
     D("drink","Pitchers: Margaret $30, Margarita del día $38"),D("drink","Grilled piña colada (HH only; N/A $7)","$8")],
    [TT_PDF,"https://www.tantisimo.com/menus"],TODAY,True,"high",
    "PDF header 'daily from 4pm-6pm' (menu file named Bev9.26 = Sept 2026 revision); menus page label 'HAPPY HOUR 4PM-6PM'. Restaurant closed Mondays. The 5-6pm aggregator claim is refuted by the venue PDF.")],
  disagreements=[])

# Grandpa Bar: happy-hour image on grandpabar.com/menus (file 'Grandpa Bar Happy Hour 3.20.24.jpg') read in-browser: 3-6PM, no days stated.
OVERRIDE[11135] = dict(windows=[
  W(["WED","THU","FRI","SAT","SUN"],"15:00","18:00",
    [D("drink","Cocktails: The Candy Dish (espresso martini), Boozy Berry, Plastic Furniture Cover (marg), Socks & Sandals (highball)","$9 each"),
     D("drink","Wine — red, white, rosé or bubbles","$8"),D("drink","Coors Banquet 'Stubbies'","$4")],
    ["https://www.grandpabar.com/menus","https://nashvillelifestyles.com/dining/food-and-drink/15-happy-hour-s-in-town/"],TODAY,True,"med",
    "Venue image gives 3-6PM but no days; days from Nashville Lifestyles (Wed-Sun, 2025-07). Bar is open Wed-Sun per inKind hours, so Wed-Sun is the only possible set. Bar, not a restaurant — no food program.")],
  disagreements=[])

# Verna / Backbar: vernanashville.com footer (live 09-05): 'Verna Happy Hour Thu-Mon 3pm-6pm'; Bar Verna evening menu 'Happy Hour Daily 5-7pm';
# Backbar page 'DAILY HAPPY HOUR 5-7PM' + 'MONDAYS: All-Day Happy Hour'. Guru (confirmed 08/07/26) has Verna 3-6 with itemized deals.
VERNA = "https://www.vernanashville.com/"
OVERRIDE[11236] = dict(windows=[
  W(["THU","FRI","SAT","SUN","MON"],"15:00","18:00",
    [D("drink","Tiny Tinis (classic, dirty, espresso)","$5"),D("drink","Cocktails: espresso old-fashioned, negroni frappe, spritzes","$8"),
     D("drink","Wine by the glass","$7"),D("drink","Montucky Cold Snack","$3"),D("food","Select food options","$8")],
    [VERNA,"https://nashvilleguru.com/businesses/verna-cafe-bar"],"2026-08-07",True,"high",
    "Café happy hour. Site footer: 'Happy Hour Thu-Mon 3pm-6pm'; Guru itemization confirmed 08/07/26. Verna is closed evenings Tue-Wed.",area="café/bar"),
  W(["THU","FRI","SAT","SUN","MON"],"17:00","19:00",
    [D("drink","Classic cocktails","$10"),D("drink","N/A cocktails","$7"),D("drink","Montucky Cold Snack","$3")],
    ["https://www.vernanashville.com/evening-menu"],TODAY,False,"med",
    "'Bar Verna' evening menu: 'Happy Hour Daily 5-7pm' — evening bar runs Thu-Mon 5pm-12am, so 'daily' = Thu-Mon. Overlaps the 3-6 café window 5-6pm; TJ to confirm which applies where.",area="evening bar")],
  disagreements=["Site footer says Verna HH Thu-Mon 3-6pm; the evening-menu page says 'Happy Hour Daily 5-7pm' with different prices. Both recorded as separate windows (café vs evening bar)."])
OVERRIDE[11237] = dict(name_note="inKind still lists 'Connie's Upscale Dive'; the operator now brands this room 'The Backbar at Verna' (same address, vernanashville.com/backbar).",
  windows=[
  W(["THU","FRI","SAT","SUN","MON"],"17:00","19:00",
    [D("drink","Classic cocktails","$10"),D("drink","Wine by the glass","$9"),D("drink","Montucky Cold Snack","$3")],
    ["https://www.vernanashville.com/backbar"],TODAY,False,"med","'DAILY HAPPY HOUR 5-7PM'; Backbar open Thu-Mon 5pm-12am. Kitchen (late-night food) open til 11:30pm but no HH food deal listed.",area="bar"),
  W(["MON"],"17:00","close",
    [D("drink","Classic cocktails","$10"),D("drink","Wine by the glass","$9"),D("drink","Montucky Cold Snack","$3")],
    ["https://www.vernanashville.com/backbar"],TODAY,False,"med","'MONDAYS: Adult Coloring Night & All-Day Happy Hour'.",area="bar")],
  disagreements=["Whether inKind credit on the 'Connie's Upscale Dive' row is honored at The Backbar at Verna — same operator/address, rename not reflected on inKind. TJ to confirm at first visit."])

# Moto: official event page says Mon/Wed/Thu/Fri 5-6pm, but the venue is CLOSED Sun-Mon (same page footer + inKind hours Tue-Sat). Monday dropped.
OVERRIDE[9316] = dict(windows=[
  W(["WED","THU","FRI"],"17:00","18:00",
    [D("drink","Select wines","$9"),D("drink","Select cocktails","$9"),D("drink","40% off all bottles under $100")],
    ["https://www.motonashville.com/events/happy-hour","https://nashvilleguru.com/businesses/moto"],TODAY,True,"med",
    "Official page lists Mon/Wed/Thu/Fri, but Moto is closed Sun-Mon (same page's hours + inKind hours Tue-Sat) — Monday is impossible and Tuesday is oddly absent. No food deals.")],
  disagreements=["Official page lists Monday HH while the restaurant is closed Mondays; Tuesday not listed. Recorded Wed-Fri; TJ may want to ask whether Tuesday counts."])

# Amsterdamian: live menu page (in-browser 09-05) header reads '★ HAPPY HOUR Mo-Fri 5pm-7pm' with priced items; agent's fetch read 'Tuesday - Friday'.
OVERRIDE[10968] = dict(windows=[
  W(["MON","TUE","WED","THU","FRI"],"17:00","19:00",
    [D("drink","Espresso Martini / Old Fashioned / Margarita","$8"),D("drink","Cabernet or Sauvignon Blanc","$7"),D("drink","Heineken","$4"),
     D("food","Ham & cheese toastie","$8"),D("food","Apricot, goat cheese & thyme toastie","$8")],
    ["https://theamsterdamian.com/menu"],TODAY,False,"med",
    "Menu header 'Mo-Fri 5pm-7pm' (live 09-05). An earlier read of the same page showed 'Tuesday - Friday'; Monday is within posted hours (Mon-Sat 5pm-12am). Lounge/bar; toasties are the food.",area="bar")],
  disagreements=["Same official menu page rendered 'Tuesday - Friday' in one fetch and 'Mo-Fri' in another on 09-05 — Monday HH uncertain."])

# Dog Haus Franklin: location page tags 'Happy Hour Specials' but publishes no times; chain deals identical; times ASSUMED from the East Nashville sister page.
OVERRIDE[15988] = dict(windows=[
  W(["MON","TUE","WED","THU","FRI","SAT"],"15:00","19:00",
    [D("food","$1 off any 3-pack of sliders"),D("drink","$2 off draft beer & wine"),D("food","$2 off shareables"),D("drink","$3 off Haus cocktails"),D("food","$3 off wings")],
    ["https://locations.doghaus.com/locations/tn/franklin/755-crescent-centre-dr-ste-104","https://doghaus.com/happy-hour/"],TODAY,False,"low",
    "TIMES UNVERIFIED for Franklin: location page only tags 'Happy Hour Specials'; window copied from the East Nashville location (Mon-Sat 3-7, Sun 12-7). Deals are the chain-wide list. Verify on first visit."),
  W(["SUN"],"12:00","19:00",
    [D("food","$1 off any 3-pack of sliders"),D("drink","$2 off draft beer & wine"),D("food","$2 off shareables"),D("drink","$3 off Haus cocktails"),D("food","$3 off wings")],
    ["https://locations.doghaus.com/locations/tn/franklin/755-crescent-centre-dr-ste-104","https://doghaus.com/happy-hour/"],TODAY,False,"low","Assumed from sister location — see weekday note.")],
  disagreements=["Franklin HH times not published anywhere found; assumed = East Nashville's. TJ to confirm."])

# Present Tense: site hours block 'Happy Hour 4-530 / Dinner Thu-Sat 5-11 / Sun 5-9' — no deals published; site footer is © 2023.
OVERRIDE[10507] = dict(windows=[
  W(["THU","FRI","SAT","SUN"],"16:00","17:30",[],
    ["https://www.liveinthepresenttense.com/eat"],TODAY,False,"low",
    "Window published, deals not. Site copyright 2023 — may be stale; inKind lists Wed hours too (Wed 17-21) which the site does not. Ask on arrival.")],
  disagreements=["inKind hours include Wednesday; venue site lists Thu-Sun only."])

# Two Ten Jack: the only source actually opened (do615) says Mon-Thu; 'Mon-Fri' came from an unfetchable aggregator. Record what was read.
def fix_ttj(v):
    ws = []
    for w in v["windows"]:
        w = dict(w); w["days"] = ["MON","TUE","WED","THU"]
        w["notes"] = "do615 listing: 'Happy Hour Monday - Thursday 4:00pm - 6:00pm'. Deal list from checkle.com (not directly fetchable). Official site's happy-hour page is an ordering page with no times. Friday unconfirmed."
        ws.append(w)
    return ws

# 312 Pizza: keep HH + the two recurring 'Every …' food specials; drop the one-off dated Sunday entry.
def fix_312(v):
    keep = []
    for w in v["windows"]:
        if w["days"] == ["SUN"]: continue  # 'Sunday September 6th' — dated one-off, not recurring
        w = dict(w)
        if w["days"] in (["MON"],["THU"]) and any(d["type"]=="food" for d in w["deals"]):
            w["kind"] = "special"
        keep.append(w)
    return keep

# ---- Build ----
venues = []
questions = []
for vid, r in ik.items():
    res = research.get(vid)
    ov = OVERRIDE.get(vid, {})
    if "windows" in ov: windows = ov["windows"]
    elif vid == 7491: windows = fix_312(res)
    elif vid == 17673: windows = fix_ttj(res)
    else: windows = res["windows"]
    if windows is None: windows = []  # should not happen after overrides
    norm = []
    for w in windows:
        w = dict(w)
        w.setdefault("kind","happy_hour"); w.setdefault("area",None); w.setdefault("notes","")
        assert w["start"] and w["end"], (vid, w)
        assert all(d in DAYS for d in w["days"]), (vid, w["days"])
        w["days"] = sorted(set(w["days"]), key=DAYS.index)
        norm.append(w)
    disagreements = ov.get("disagreements", res.get("disagreements", []))
    note = (ov.get("name_note","") + " " + (res.get("notes") or "")).strip()
    venues.append({
        "id": f"ik-{vid}", "inkind_id": vid, "name": r["name"], "city": r["city"], "neighborhood": NEIGHBORHOOD[vid],
        "address": r["addr"], "zip": r["zip"], "lat": r["lat"], "lon": r["lon"], "tz": "America/Chicago",
        "inkind": True, "inkind_url": r["url"], "official_site": res.get("official_site"), "status": "open",
        "hours": hours_from_ik(r), "hours_source": "inKind map API 2026-09-05",
        "windows": norm, "verified_no_hh": bool(res.get("verified_no_hh")) and not norm,
        "checked": TODAY, "disagreements": disagreements, "notes": note,
    })
    for d in disagreements: questions.append((r["name"], d))

venues.sort(key=lambda v: v["name"].lower())
out = {"schema_version": 1, "generated": TODAY, "generator": "build_venues_20260905.py (core thread, from research/batch*.json + inkind-recon)",
       "coverage": "v1: the 35 inKind partners in the Nashville metro with happy_hour=true on 2026-09-05",
       "venues": venues}
json.dump(out, open(HERE/"venues.json","w"), indent=1, ensure_ascii=False)
json.dump(questions, open(HERE/"tj-questions-raw.json","w"), indent=1, ensure_ascii=False)
nw = sum(len(v["windows"]) for v in venues)
food = sum(1 for v in venues if any(d["type"]=="food" for w in v["windows"] for d in w["deals"]))
print(f"venues={len(venues)} windows={nw} with_food={food} no_hh={sum(v['verified_no_hh'] for v in venues)} questions={len(questions)}")
