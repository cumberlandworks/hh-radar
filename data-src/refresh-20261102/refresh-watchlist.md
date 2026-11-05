# Refresh watchlist (hh-radar v2)

Started 2026-11-04 in fix31 (BLOCK-hh-radar-fix31, from the fix30 notes). The monthly refresh checks these
windows FIRST: each comes from a week-specific post or a pre-2026 menu (brief step 14), so it is
`confidence: "low"` (week posts: `posted_week`, since fix35) and goes stale on its own. Each zone run appends its new ones (none from South, fix31; West, fix32: answer.'s 2020 menu, plus the new
"Hours mismatch" section).
When a refresh re-checks one, update its row (or remove it if the source is no longer dated) and say so in the
CHANGELOG.

## Week-specific posts

| Venue | Zone | id | Window # | Days / times | Dated by |
|---|---|---|---|---|---|
| Noble's Kitchen & Beer Hall (East) | east | nv-nobles-kitchen-and-beer-hall-east-974 | 0 | MON,TUE,FRI 11:00–18:00 | As posted for the week of Nov 3-9; the schedule can change weekly |
| Noble's Kitchen & Beer Hall (East) | east | nv-nobles-kitchen-and-beer-hall-east-974 | 1 | WED 11:00–close | All day, as posted for the week of Nov 3-9; the schedule can change weekly |
| Noble's Kitchen & Beer Hall (East) | east | nv-nobles-kitchen-and-beer-hall-east-974 | 2 | MON 18:00–close | As posted for the week of Nov 3-9 |
| Noble's Kitchen & Beer Hall (East) | east | nv-nobles-kitchen-and-beer-hall-east-974 | 3 | TUE 18:00–close | As posted for the week of Nov 3-9 |
| Noble's Kitchen & Beer Hall (East) | east | nv-nobles-kitchen-and-beer-hall-east-974 | 4 | THU 18:00–close | As posted for the week of Nov 3-9 |
| Noble's Kitchen & Beer Hall (East) | east | nv-nobles-kitchen-and-beer-hall-east-974 | 5 | SAT 11:00–close | As posted for the week of Nov 3-9 |
| Noble's Kitchen & Beer Hall (East) | east | nv-nobles-kitchen-and-beer-hall-east-974 | 6 | SUN 11:00–18:00 | As posted for the week of Nov 3-9 |
| Noble's Kitchen & Beer Hall (East) | east | nv-nobles-kitchen-and-beer-hall-east-974 | 7 | SUN 11:00–close | As posted for the week of Nov 3-9 |
| Germantown Pub | north | nv-germantown-pub-708 | 0 | MON,TUE,WED 15:00–18:00 | Schedule as posted for the week of Nov 3-9 |
| Germantown Pub | north | nv-germantown-pub-708 | 1 | FRI 14:00–18:00 | Schedule as posted for the week of Nov 3-9 |
| Streetcar Taps and Garden (Germantown) | north | nv-streetcar-taps-and-garden-germantown-1325 | 0 | MON,TUE,WED,THU,FRI 15:00–18:00 | Specials page lists happy hour only for dated days (Nov 3-6 and Nov 9) |

Posted week: Noble's and Germantown Pub, Nov 3–9, 2026; Streetcar, dated days Nov 3–6 and Nov 9, 2026
(all seen 2026-11-03).

fix35 (TJ: "Drop badge for this week"): these windows now carry `posted_week` (2026-11-03 to 2026-11-09) at
`confidence: "med"`. No badge inside that week; after Nov 9 the badge returns with "Posted schedule was for Nov 3–9",
and they stay on this list. On re-check, update `posted_week` to the week then posted.

## Pre-2026 menus

| Venue | Zone | id | Window # | Days / times | Dated by |
|---|---|---|---|---|---|
| Lyra | east | nv-lyra-935 | 0 | MON,TUE,WED,THU,FRI,SAT 17:00–18:00 | Prices from the venue's Spring 2025 happy hour menu, which its site still links |

Menu date: Lyra, the Spring 2025 happy-hour PDF (`Happy-Hour-Spring-2025.pdf`), still linked from its site
(re-checked 2026-11-03).

## Pre-2026 menus (fix32, West)

| Venue | Zone | id | Window # | Days / times | Dated by |
|---|---|---|---|---|---|
| answer. | west | nv-answer-132 | 0 | MON,TUE,WED,THU,FRI,SAT 16:15–18:00 | Deals from the venue's "HH Menu 2020 to Print" PDF (modified 2025-03-04), still linked from its site |

## Hours mismatch (fix32, TJ 2026-11-04)

A happy hour that starts before the venue's posted opening, or that runs from the opening to close every open day.
These keep their happy hours (they post real happy-hour times; TJ's all-day rule applies only where the venue
itself calls an everyday menu "all day"). Re-check the opening time and the happy-hour times together.

| Venue | Zone | id | Window # | Happy hour | Posted hours |
|---|---|---|---|---|---|
| Prime + Proper | gulch | nv-prime-proper-1000 | 0 | daily 16:00–close (Nashville Guru, confirmed 2026-10-27) | Sun–Thu 17:00–22:00, Fri–Sat 16:30–23:00: the happy hour covers every open hour |
| Tailor | north | nv-tailor-620 | 0 | THU–SUN 16:30–close (Nashville Guru, confirmed 2026-10-21) | THU–SUN 16:30–22:00: the happy hour covers every open hour |
| answer. | west | nv-answer-132 | 0 | MON–SAT 16:15–18:00, bar top | MON–SAT 16:30–22:00 (dinner hours) |
| Miel Restaurant | west | nv-miel-restaurant-343 | 0 | TUE–FRI 16:30–18:00 | TUE–THU 17:30–21:00, FRI–SAT 17:30–22:00 |

## Near misses (not low, but worth a look)

- Grandpa Bar (North, inKind, `ik-11135`): its menus page shows the happy hour only as an image; days, times and
  prices were carried over from the 2026-09-05 pass (image + Nashville Lifestyles 2025-07). Confidence med.

## Temporarily closed (fix33, Franklin & Brentwood)
Not added: the Google listing says "Temporarily closed" (TJ's rule, 2026-11-04: not added, on this list with the date seen). Re-check at the next refresh; research the happy hour if one reopens.
- Kokomo Trading Company, 158 Front St #100, Franklin (seen 2026-11-04): the venue's site and Facebook say "temporarily closed" (undated); Google "Temporarily closed".
- Granite City Food & Brewery, 1864 W McEwen Dr, Franklin (seen 2026-11-04): fire July 5, 2025 (Williamson Source); gcfb.com and Google "Temporarily closed".
- Curio Brewing Company, 216 Noah Dr #140, Franklin (seen 2026-11-04): closed the Noah Drive taproom July 29, 2026 and promises a new location (no address yet); Google still says "Temporarily closed". Research the new address when it is posted.

## Near misses (fix33, Franklin & Brentwood)
- Mojo's Tacos (The Factory, `nv-mojos-tacos-230`): the home page's "Happy Hour Monday-Friday 3-6" doesn't name a location (Mojo's also has East Nashville); med.
- Sportsman's Grille (Brentwood): the home page's "Happy Hour (2-6 PM daily)" sits under "Locations in Brentwood & Nashville"; the Brentwood menu PDF (May 2025) has no happy-hour page, the Belle Meade one does. Med.
