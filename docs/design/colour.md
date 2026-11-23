# Colour

More colour, and every colour means one thing (November 2026, from the app assessment). Four families, each with one
job; the tokens are in `src/styles/base.css`.

| Family | What it says | Where it shows | Tokens |
| --- | --- | --- | --- |
| Tabs | Where you are | The tab's icon and nav mark, the page's period chip, its tabs' underline, its one hero card | `--tab-{today,money,accounts,plan,more}-{1,2,wash,ink,icon}`; the page's own as `--tab-*` (set on `<body>` in `shell.css`), a nav entry's as `--own-*` |
| Categories | What kind of spending | A category's icon, bar, chart segment and chip, on every page | `calc/categorylook.js` → `cat-c-*` (`lib/caticons.js`) |
| People and budget groups | Whose money; which part of the budget | A person's avatar and lines; Essentials, Lifestyle and Set aside on every bar that splits the plan | `--grp-{essential,lifestyle,setaside,loan,left}` |
| Meaning | Whether it needs you | Good, needs a look, problem | `--good-ink`, `--warn-ink`, `--bad-ink` (never for a plain count) |

Today indigo, Money teal, Accounts violet, Plan sky blue, More slate.

Rules:
- **One gradient per page:** its hero card, `linear-gradient(135deg, var(--tab-1), var(--tab-2))`. Everything else is
  white, tints and dots.
- **White text only on the deep pair** (`-1`, `-2`): 5:1 or better at both ends. Tints carry dark text (`-ink`).
- **Never colour alone:** each colour has a word, a sign or an icon beside it.
- **Red is a problem,** never a count of things to do.
- **Dark mode keeps the hues:** the same families, lighter inks and icons on a navy page.
