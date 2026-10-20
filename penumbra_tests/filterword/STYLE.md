# Filter, Find, Search: the wording rename (2026-10-19)

The report page's box above the table (`#tableSearch`) is renamed, in USER-FACING WORDS ONLY,
from "search box" / "search bar" to **filter box**. Its biggest benefit is that its filter flows on:
the box keeps only the matching rows, and totals, snippets, charts, calculations, exports and email
follow. Three words, each with one meaning:

| Word   | Means | Examples |
|--------|-------|----------|
| FILTER | the box above the table and what it does: keep only the rows that match | "the filter box", "your filter", "the rows your filter keeps", "Visual Filter Builder" |
| FIND   | Ctrl+F: highlights matches, hides nothing | leave Find's own text as it is |
| SEARCH | finding something to GO TO: help topics, fields, reports, people | the Help Center search, "Search fields...", the repository search, the home screen's report search, the directory search, the auditor's own box, Ask |

## New names (use exactly these)

| Was | Now |
|-----|-----|
| search box, search bar, the report search bar, the main search bar, the table search bar, the front-end search bar | **filter box** (the report's filter box, the main filter box) |
| Search Bar (the View Options checkbox) | **Filter Bar** |
| Visual Search Builder (any case) | **Visual Filter Builder** |
| Advanced Search (the title of help topic searchHelpLightbox) | **Filtering the Table** |
| Search Filter (the Scheduler form's field) | **Apply Filter** as the field's name (the user, 10-19), matching its label "Apply Filter:"; "the task's filter" in running text |
| Search Filter (scheduler) (the h3 of searchFilterHelpLightbox) | **Apply Filter (scheduler)** |

The scheduler's and the dashboard's OWN filter boxes keep their other words (the user, 10-19: they
"may not follow the same wording and dont need correcting"): the scheduler box's run / clear
titles, the dashboard's "report search syntax", Search help button and panel, default-filter hint
and the embedded tile's Search filter field. Where they name the builder, they say Visual Filter
Builder (one shared dialog).
| search filter (the filter text applied to a view: "the active search filter", "Include current search filter") | filter ("the active filter", "Include current filter") |
| search syntax, search grammar, the search bar's syntax | filter syntax, the filter box's syntax |
| your search / the current search / the active search / a search (meaning the text in the box) | your filter / the current filter / the active filter / a filter |
| saved searches, Saved Searches (presets of the box) | saved filters, Saved Filters |
| Save current search... / Share current search... | Save current filter... / Share current filter... |
| search links (cells or snippet links that apply a filter: `data-search` links, `action(search, ...)` links) | filter links |
| Search Modifiers / Search Modifier | Filter Modifiers / Filter Modifier |
| Search source rows (the builder's checkbox) | Filter source rows |
| Keys in the search box / Smart Double-Click in the Search Bar | Keys in the filter box / Smart Double-Click in the Filter Box |
| verbs: "as you search", "search them", "can be searched", "Searching recomputes" | "as you filter", "filter on them", "can be filtered on", "Filtering recomputes" |

Write natural English; a sentence may need a small rewording, not just a word swap
("Hidden columns are searchable" -> "Hidden columns can be filtered on").
In searchHelpLightbox's opening paragraph keep ONE sentence saying the box used to be called the search box.

## KEEP (never change)

- Code, API and saved names: `search`, `&search=`, `?search=`, `search=`, `dsearch`, `data(search)`,
  `action(search, ...)`, `search|`, `filter|`, `unfilter|`, `data-search`, `__SRC` / `__ALL` / `__ROW`,
  every id, class, `data-*` attribute, `data-jump-to` / `data-canonical*` value and heading `id`
  (`search-syntax`, `search-builder`, `schedFilter-top`, `grh-search`, `jn-notes-search`, ...).
  Inside `<code>` keep the code as it is.
- Real searches (the SEARCH row above), e.g. the pivot builder's field search ("Use the search box to
  filter by name" about the pivot field list is a REAL search: keep), the repository dialog's search
  box and "recent searches", the Help Center's search, "searches the campus directory", the auditor's
  left-sidebar search box, "the home-screen report search".
- Find's own wording (Ctrl+F).
- Prompt examples such as `message=Search By` or `message=Search term` (they are sample code).
- Generic English that is not about the box ("a Google search" URL, "searchable history" of the
  audit log report).

## Rules

- NO em-dashes in new text (no `&mdash;`, no U+2014). Use a colon, a comma, or " - ". In help/tips
  files use " -- " as they already do.
- Lint L16 limits words: a `<p>` 80, an `<li>` 50, a table cell 70. Keep each passage about the length
  it was; never lengthen a long one.
- Change TEXT only: markup, attributes, ids, classes and links stay byte-identical.
- Edit with the Edit tool only (it keeps each file's line endings: topics LF, tips CRLF). No sed,
  no PowerShell Set-Content, no Python rewrites.
- Edit ONLY the files you were given, in the STAGE folder
  `\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\filterword\stage\...`.
  Never touch the live webroot (`\\oitras.oit.ncsu.edu\c$\inetpub\...`) or `orig\`.
- When unsure whether a "search" means the filter box, read the surrounding paragraph: if it is
  about narrowing the report's rows, it is the filter; if it is about finding a thing to open, keep.
