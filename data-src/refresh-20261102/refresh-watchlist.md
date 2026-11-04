# Refresh watchlist (hh-radar v2)

Started 2026-11-04 in fix31 (BLOCK-hh-radar-fix31, from the fix30 notes). The monthly refresh checks these
windows FIRST: each comes from a week-specific post or a pre-2026 menu (brief step 14), so it is
`confidence: "low"` and goes stale on its own. Each zone run appends its new ones (none from South, fix31).
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

## Pre-2026 menus

| Venue | Zone | id | Window # | Days / times | Dated by |
|---|---|---|---|---|---|
| Lyra | east | nv-lyra-935 | 0 | MON,TUE,WED,THU,FRI,SAT 17:00–18:00 | Prices from the venue's Spring 2025 happy hour menu, which its site still links |

Menu date: Lyra, the Spring 2025 happy-hour PDF (`Happy-Hour-Spring-2025.pdf`), still linked from its site
(re-checked 2026-11-03).

## Near misses (not low, but worth a look)

- Grandpa Bar (North, inKind, `ik-11135`): its menus page shows the happy hour only as an image; days, times and
  prices were carried over from the 2026-09-05 pass (image + Nashville Lifestyles 2025-07). Confidence med.
