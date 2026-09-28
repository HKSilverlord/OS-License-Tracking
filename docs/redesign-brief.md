# Redesign brief

The brief the 2026 redesign worked to, and the principles to keep when changing the
interface. The colours did not change: blue for the product and for actuals, slate for
structure, orange for "this month", red and green only for below and above plan.

## The brief

Redesign every screen of the app, from sign-in to the last table, for the people who use
it every week: the admins who enter hours and prices, and the viewers who read the
figures. It should look finished and calm, in the way Apple software does, without
anything added to look impressive. Everything on screen has to be there for a reason.
The app is used on desktop browsers first, and it must also work on a phone.

"Onboarding" here means three things: signing in, the first run on an empty database, and
every state that is empty or has failed. There is no mascot and no illustration: the app's
mark is a vector icon (`components/ui/AppIcon.tsx`, `public/favicon.svg`).

## Principles

1. **Numbers first.** A page opens on its answer: the figure, the table or the chart. The
   title names the page, one line says what it answers, and the controls sit beside the
   title. Nothing sits between the reader and the numbers.
2. **Everything earns its place.** A card, label, border or colour that does not help
   someone read or change a figure is removed. Headings are plain text, not badges.
3. **Colour means something.** Blue marks what can be clicked and the actual figures,
   orange marks this month, and red and green mean below and above plan. Colour is never
   decoration, and never the only signal: arrows, signs and words carry the same meaning.
4. **One way to do each thing.** One year control per page, in the page header. One
   export menu per card. One save for the tracking table, with `Ctrl S`.
5. **Friendly empty and error states.** Every empty state says what is missing and offers
   the next step. Every error says what happened in plain words, keeps what the user
   entered, and offers "Try again".
6. **Edits are protected.** Unsaved hours prompt before leaving the page, changing the
   year or signing out. Destructive actions ask first in the app's own dialog, never
   `window.confirm`. Editing is only offered to admins; the database enforces it anyway.
7. **Three languages, two themes.** Every string is in Japanese, English and Vietnamese
   (`npm run check:locales`), and numbers follow the interface language, not the browser.
   Every screen works in light and dark.
8. **From 360 px to a wide monitor.** Tables keep their key columns frozen and scroll
   sideways on narrow screens; they are never squeezed until unreadable. The sidebar
   becomes a drawer on a phone.
9. **Quiet motion.** Short fades and slides that show where something came from, and
   none at all when the system asks for reduced motion.
10. **Exports look finished.** A copied or downloaded chart or table carries its title,
    year and key, so it can go straight into a slide.

## Checking a change

- `npm run verify`: types, lint, locales and a production build.
- Look at the change in light and dark, in all three languages, at phone and desktop
  width. Japanese labels are the shortest and Vietnamese the longest; a column that fits
  one may not fit the other.
