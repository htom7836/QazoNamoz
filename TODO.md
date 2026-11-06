# Qazo Namoz — TODO

## App shell, identity, and navigation — complete
- Build a modern, fully functional, mobile-first application called Qazo Namoz to help Muslims track, organize, calculate, and gradually make up missed (Qazo) prayers.
- Use a premium Islamic-inspired minimalist UI with dark emerald green, white, cream, and subtle gold; subtle Islamic geometric patterns; rounded cards; smooth motion; elegant typography; responsive mobile, tablet, and desktop layouts; and light/dark mode. All interface text is in Uzbek (Latin alphabet).
- Use Uzbek Islamic terminology, helpful instructions, FAQ, privacy-conscious data controls, accessibility support, and offline functionality where possible. The production service worker caches the public app shell and static assets only; private API/OAuth/storage paths are bypassed.
- Provide five main navigation sections: Bosh sahifa, Qazo hisoblash, Qayd etish, Statistika, Profil. Navigation and controls work responsively.

## Dashboard and prayer totals — complete
- Dashboard (Bosh sahifa) displays “Assalomu alaykum!”, total missed prayers, completed Qazo prayers, remaining Qazo prayers, overall completion percentage, progress bar, today’s completed Qazo prayers, and quick-action “Qazo namozini qayd etish”.
- Display five separate prayer categories Bomdod, Peshin, Asr, Shom, Xufton. Each shows total missed prayers, completed prayers, remaining prayers, and progress percentage.

## Initial Qazo calculator — complete
- Provide a first-time setup wizard asking date of birth; age regular praying began; estimated date or age when missed prayers began; which prayers were missed; whether there were periods of regular prayer; and approximately how many days of missed prayers should be counted.
- Allow exact numbers entered manually instead of relying only on automatic calculations. An exact per-prayer entry overrides the day-based estimate for that selected prayer.
- Do not assume every day since a selected age was missed. Allow exclusion of periods when the user prayed regularly. Clearly explain that the calculator provides an estimate. Provide selectable saved jurisprudential guidance, label it in the result, and describe that the arithmetic counts only the selected five daily farz prayers using the entered days and exact values; do not present it as a madhhab-specific religious ruling. Do not automatically count prayers that are not obligatory.

## Record completions and history — complete
- Let users record each completed prayer separately: Qazo Bomdod, Qazo Peshin, Qazo Asr, Qazo Shom, Qazo Xufton. Each “Bajarildi” action updates the relevant counter.
- Provide individual completion buttons, undo functionality, completion date and time, a history of completed prayers, and a way to correct accidentally recorded entries. Never allow the remaining count to become negative. At the documented 20,000-record safety ceiling, prevent further additions and ask the user to back up instead of allowing invalid data to be silently lost.
- Calendar shows days Qazo prayers were completed, number completed each day, whether the daily target active on that historical date was achieved, and historical records. Selecting a date shows that date's activity.

## Personalized plan — complete
- Let users choose daily targets: 1 Qazo prayer per day, 5 Qazo prayers per day, 10 Qazo prayers per day, one complete set of five prayers per day, or a custom daily target; allow changing the target at any time. Effective-dated plan history keeps prior calendar results accurate.
- Show the daily target, daily completed amount, weekly progress, and estimated time to complete remaining prayers.

## Statistics — complete
- Provide total completed prayers, total remaining prayers, daily progress, weekly progress, monthly progress, completion percentage, and individual statistics for each prayer, using charts and progress indicators.

## Notifications and reminders — complete with an explicit browser limitation
- Reminders are optional and customizable: daily reminder, custom reminder time, reminder to complete daily Qazo target, and weekly progress notification.
- Implement a working daily notification/reminder function. Users can enable/disable it and choose a reminder time; persist the setting and send a daily notification when enabled. Explain when device/browser notification permission is required. In this first web implementation, disclose that browser notification delivery needs permission and the app page to remain open; do not claim reliable delivery after the browser closes or the device is off. The same limitation is disclosed for the optional weekly reminder; no background push service is configured.

## Account, persistence, and privacy — complete with platform providers
- Provide account sign up/login, a personal profile, cloud synchronization, secure per-user database storage, data export and backup, and reset tracking data after confirmation. Manus OAuth is the initialized default login provider; this project does not have Google OAuth or Supabase configured, so it uses the managed MySQL database already provisioned by the project.
- Keep user data after refresh. Validate forms and handle errors. Local-only use is identified as device-local; signed-in data is scoped to the authenticated account, and transitions between accounts/logout cannot reuse another account's state. Offer an explicit confirmation before transferring guest progress into an otherwise empty account. Never let remaining prayers be negative.

## Technical quality — complete
- Build a real working application, not just a visual prototype. Use the initialized React/Vite/Express/tRPC/Drizzle stack and installed charting dependencies; keep code maintainable and the chart bundle lazy-loaded for Statistics.
- All buttons work, counters update correctly, data persists after refreshing, form validation is implemented, navigation is responsive, and errors are handled appropriately. Account state is schema-validated and saved through authenticated owner-scoped procedures; the 5 MB save cap is enforced by UTF-8 byte size.
- Prioritize accuracy, privacy, ease of use, and a peaceful Islamic visual identity. The final source passes TypeScript checking, all eight automated tests, and the production build; the route manifest, health endpoint, service worker, and favicon return successfully in the running app.
