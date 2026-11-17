# A 404 on signing in to community curation in Safari but not Chrome

Written 2026-11-17, on chlorophilia's report that one collaborator gets a 404 message when trying to sign in to GitHub
for community curation in Safari, but not in Chrome, while the project's maintainers have no problems in Chrome. This is
a diagnosis to be tested - nothing has been changed.

My leading suspect isn't really Safari. It's which GitHub account the collaborator is signed into in Safari, combined
with our GitHub App being private. Below are the reasoning, the less likely browser-specific causes, and how to tell
them apart from the collaborator's 404 page.

## The flow

The "Sign in" button sends the whole page to our Worker's `/authorize` (`src/curation/oauthWorker.mjs`). That
redirects to GitHub's authorisation page for the App `imerss-community-curation`. GitHub returns to the Worker's
`/callback`, which sends the person back to the page with a sealed session. The page swaps that session for a token
with a `POST /token` and keeps the token in local storage - see `bioreportr.curation.takeSession` and the GitHub
backend's `signIn` and `exchangeSession` in `bioreportr-curation.vue`.

The only 404 our own code produces is the Worker's plain-text "Not found", for a path it doesn't serve. Everything else
(expired state, a refused token) gives a 400, 401 or 502 with a sentence. So the 404 most likely comes from GitHub, or
from GitHub Pages on the way back.

## Most likely: the App is private, and Safari is signed into a different GitHub account

- The setup notes, `curation-token-exchange.md`, chose "Only on this account" for where the App can be installed. That
  makes it a private GitHub App. GitHub's public API confirms it: `api.github.com/apps/imerss-community-curation`
  answers 404 to anyone not signed in, whereas a public App's details are visible to anyone.
- As I understand GitHub's behaviour, a private App is invisible to accounts outside the account that owns it. Its
  authorisation page then answers such accounts with GitHub's 404 page instead of "Authorize". I haven't verified this
  against GitHub's documentation.
- This fits exactly. The maintainers are presumably members of IMERSS, so never see it. The collaborator's Chrome may be
  signed into an account inside IMERSS, and their Safari into a personal one, or one outside the organisation.

### To test it

1. Ask what the 404 page looks like:
   - GitHub's Octocat page, with a URL on `github.com/login/oauth/authorize…`, points here;
   - a plain "Not found" on `…workers.dev` would be our Worker;
   - "File not found" on `imerss.github.io` would be the return to the site.
2. Have them check which GitHub account Safari is signed into, at github.com.
3. Have them open `https://github.com/apps/imerss-community-curation` in each browser. If Safari shows a 404 and Chrome
   shows the App, that's this cause.

### The fix if confirmed

Make the App public, under the App's settings, Advanced, "Make public". Public only means any GitHub account can see and
authorise it. Installing it on a repository still needs that repository's admin, and the Worker still only serves the
origins in `ALLOWED_ORIGINS`. `curation-token-exchange.md` should then recommend public, since anyone in the community
has to be able to sign in.

## Less likely, but genuinely browser-dependent

- **The page URL, hash included, travels through the whole flow.** The sign-in starts from the full
  `window.location.href`, including the hash with the page's state, such as the selected taxon and filters. It's carried
  in the sealed `state` on GitHub's URL and returned afterwards. A long hash, e.g. a drawn polygon, makes that URL very
  long. Characters like "SḰŦÁMEN" may also be escaped differently by Safari and Chrome. Either could fail differently in
  each browser, though I'd expect a 400 or 414 rather than a 404.
- **On an iPhone or iPad,** the GitHub app can take over `github.com` links, and would show its own "not found" for an
  OAuth page it doesn't handle. That normally happens on tapped links rather than redirects like ours, so it's a long
  shot.
- **Safari's privacy features** (tracking prevention, Private Relay, content blockers, private browsing) usually break
  such flows by losing storage or blocking requests, not with a 404. A collaborator in private browsing would lose the
  token on closing the window, but wouldn't see a 404.
