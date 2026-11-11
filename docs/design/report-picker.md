# Report picker (#260)

Roadmap step 4 starts with this picker; mobile report summaries (#258) follow in separate work.

## Proposed interaction

- Reports opens on the selected report, its existing period/comparison/group controls and results.
- One “Choose report” button opens a searchable, grouped chooser. Recommend the same chooser on phone and desktop;
  the owner has been asked whether desktop should instead retain the visible catalogue.
- Each report has a short description. Search matches its title, group and description. No matches offers Clear search.
- The current report is marked. Group labels remain visible. Household parts keep their existing availability rules.
- Pinned shortcuts remain on the report page and in the chooser. Their saved frames and ordering are unchanged.
  Recent choices are session-only shortcuts inside the chooser; they do not change the saved-data schema.
- The chooser is a native dialog using the existing dialog styling and history mechanism: search receives focus,
  Tab stays inside, Escape/Back closes it, and selection returns focus to “Choose report” after drawing the report.
- Changing the ordinary report retains the current frame as today; choosing a pin restores that pin's frame.
  Calculations, CSV and print remain unchanged.

## Verification

Use CI's pinned Playwright 1.56.0. Verify search, descriptions, keyboard selection/cancellation, Back, pin restore
and frame preservation. Measure the report title and first meaningful result at 320/390/768/1280px in both themes.
The 390×844 demo must show meaningful report content in the initial viewport. Reuse the smoke view inventory;
update its report navigation to open the chooser rather than clicking an always-visible catalogue.

Check the report builders, static checks, relevant journeys, smoke and accessibility once on the final implementation,
then verify the actual PR checks. Retain complete CSV/print output and do not alter report table layouts in this PR.
