# Help coverage map

Generated 2026-10-15 16:10 from `C:/Users/bplimon/AppData/Local/Temp/claude/--oitras-oit-ncsu-edu-c--inetpub-wwwroot-sponsor-migration-penumbra/0040370a-2b26-457e-806c-b46200acb3fe/scratchpad/helpv2/stage` (code read from the stage, falling back to `//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra`).
A listed item is something the code exposes that the help does not name where a reader would look. Heuristic: confirm before acting.

## C1 Snippet functions (42 in PENUMBRA_SNIPPET_FN_NAMES)

One row per function missing from any of the three documentation surfaces.

| function | Custom Code h4 | hover module | AI prompt |
| --- | --- | --- | --- |
| avg | yes | yes | NO |

## C2 action() types (search, trigger, infobox, toast, prompt, feedback)

_nothing missing_

## C3 URL parameters (14 read by the code)

Parameters the Power Features topic does not name.

| parameter | read by | documented |
| --- | --- | --- |
| calc | index.php | elsewhere in the help |
| dsearch | index.php | NOT in the help |
| embed | index.php | elsewhere in the help |
| eview | index.php | NOT in the help |

## C4 Single-key shortcuts (17 in PNB_SINGLE_KEYS)

_nothing missing_

## C5 View Options controls (20 labelled controls in #view-options-tab)

| control id | label | finding |
| --- | --- | --- |
| viewOptionExport | export/download | label text not found in the View Options topic |

## C6 Scheduler form labels (17 labelled fields)

| field id | label | finding |
| --- | --- | --- |
| schedSubject | subject line:  | label text not found in the scheduler topics |
| schedBodyPreamble | body preamble:  | label text not found in the scheduler topics |
| schedDropSftpKey | private key (pem) | label text not found in the scheduler topics |
| schedDropCustomHeader | header line (optional; becomes line 1, leave empty for no header) | label text not found in the scheduler topics |
| schedDbDumpOverrideReason | reason for override  | label text not found in the scheduler topics |

## C7 Chart types (18 in #vizTypeSelector)

_nothing missing_

## C8 Pivot aggregation types (30 in the label map)

Only rows the Pivot topic itself does not name.

| key | label | Pivot topic | Custom Code (trigger table) | AI prompt |
| --- | --- | --- | --- | --- |
| pct_row_total | % Row | NO | yes | yes |
| pct_col_total | % Col | NO | yes | yes |
| pct_parent_row | % Parent Row | NO | yes | yes |
| pct_parent_col | % Parent Col | NO | yes | yes |
| pct_grand_total | % Grand | NO | yes | yes |

## C9 Prompt builder tips (37 keys in builder-tips-storage) vs the Query Prompts section

| tip key | finding |
| --- | --- |
| edit-existing | tip exists; the Query Prompts section never uses this word |
| autofill-table | tip exists; the Query Prompts section never uses this word |
| autofill-column | tip exists; the Query Prompts section never uses this word |
| autofill-valuecolumn | tip exists; the Query Prompts section never uses this word |
| autofill-condition | tip exists; the Query Prompts section never uses this word |
| multi-minmax | tip exists; the Query Prompts section never uses this word |
| boolean-buttons | tip exists; the Query Prompts section never uses this word |
| number-range | tip exists; the Query Prompts section never uses this word |
| preview | tip exists; the Query Prompts section never uses this word |
| sq-edit-existing | tip exists; the Query Prompts section never uses this word |
| sq-db | tip exists; the Query Prompts section never uses this word |
| sq-type | tip exists; the Query Prompts section never uses this word |
| sq-transport | tip exists; the Query Prompts section never uses this word |
| sq-sql | tip exists; the Query Prompts section never uses this word |
| sq-preview | tip exists; the Query Prompts section never uses this word |

## C10 Hover-tip keys (128 defined, 116 consumed statically)

| key | where | finding |
| --- | --- | --- |
| viz-series-label | viz-tips-storage | defined, no static consumer |
| viz-series-col | viz-tips-storage | defined, no static consumer |
| viz-series-type | viz-tips-storage | defined, no static consumer |
| viz-series-stack | viz-tips-storage | defined, no static consumer |
| viz-series-agg | viz-tips-storage | defined, no static consumer |
| viz-series-fexpr | viz-tips-storage | defined, no static consumer |
| viz-series-values | viz-tips-storage | defined, no static consumer |
| viz-series-color | viz-tips-storage | defined, no static consumer |
| pivot-value-options | pivot-tips-storage | defined, no static consumer |
| pivot-presets | pivot-tips-storage | defined, no static consumer |
| pivot-preset-onload | pivot-tips-storage | defined, no static consumer |
| us-tip-colopts | settings-tips-storage | defined, no static consumer |

## C11 Topics without a "?" entry point in index.php

Reachable only through the Help Center TOC, search, F1 or a #help= link.

| topic | title | audience |
| --- | --- | --- |
| searchHelpLightbox | Advanced Search | viewer |
| columnSummariesHelpLightbox | Column Summaries | viewer |
| powerFeaturesHelpLightbox | Power Features & URL Parameters | viewer |
| dashboardsHelpLightbox | Dashboards | viewer |
| promptsHelpLightbox | Query Prompts | writer |
| importsHelpLightbox | Importing External Files | writer |
| subqueriesHelpLightbox | Cross-Database Subqueries | writer |
| repositoryHelpLightbox | Report Repository & Manage Mode | admin |

## Summary

| probe | result |
| --- | --- |
| C1 snippet functions | 42 functions, 1 with a gap |
| C2 action types | 6 types, 0 with a gap |
| C3 URL parameters | 14 read, 4 not in Power Features |
| C4 single keys | 17 keys, 0 never shown in <kbd> |
| C5 view options | 20 labels, 1 not found in the topic |
| C6 scheduler labels | 17 labels, 5 not found |
| C7 chart types | 18 types, 0 with a gap |
| C8 pivot aggregations | 30 types, 5 not in the Pivot topic |
| C9 prompt attributes | 37 tip keys, 15 words absent from the Query Prompts section |
| C10 hover tips | 128 defined / 116 consumed, 12 mismatches |
| C11 entry points | 8 topics have no ? icon |

