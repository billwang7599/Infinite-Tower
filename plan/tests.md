# Tests: what's not covered

Status: **later**.

- **The Postgres stores and migrations**: they'd need a throwaway database per test run. Open: worth the setup, or
  are the fakes enough?
- **React screens**: would need jsdom and Testing Library; today they're tried in a browser.
- **Blocking a red merge**: GitHub enforces a required check only on a public repo or with Pro, so a red PR can still
  be merged by hand.
