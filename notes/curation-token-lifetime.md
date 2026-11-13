# How long a person stays signed in: token lifetime, refresh tokens and storage

This note follows `curation-token-exchange.md`, which sets up signing in for the community curation of
`community-curation-design.md`. It records why tokens expire after 8 hours, what refresh tokens would and wouldn't
buy, and when the token exchange would need storage. In short: keep the 8-hour expiry, and no refresh tokens, so the
service stays stateless.

## 1. What a token can do

The token is a GitHub App user token. It can do only what both the App and the person may do - read and write
Discussions in the repositories the App is installed on, and read their basic metadata. It can't reach code, other
repositories or the person's account.

* An ordinary contributor's token can post, edit or delete their notes and comments, and start threads in their name.
* A **maintainer's** token is the real exposure. Maintainers may delete or edit anyone's discussions and comments, so a
  stolen maintainer token could wipe or deface every curation thread, and the consolidation job would faithfully
  publish the damage.

## 2. How a token could be stolen

The page keeps the token in the browser's local storage, which any script running on the site can read, not only the
site's own:

* The story page loads third-party code - plotly, the iNaturalist panels, the vendored libraries, and an icon
  stylesheet from a CDN. A compromised dependency, or any script injected into the page, could read the token.
* Someone using a shared or public computer after the person.
* Malware with access to the browser's profile.

The token's lifetime is how long anyone who obtains it can act as that person.

## 3. Expiring tokens more slowly, or not at all

| Setting of the App | Exposure if a token is stolen |
|---|---|
| **Expire user authorization tokens: on** (as set up) | At most 8 hours |
| Off | Until the person revokes the App in their GitHub settings, or GitHub retires the token after a year without use. Most people never revoke anything, so a stolen token stays useful indefinitely, and the person may never notice |

With expiry on, the cost to people is small. Once someone has authorised the App, signing in again is a redirect to
GitHub and back, with no consent screen.

Rotating the token exchange's `SESSION_KEY` or the App's client secret doesn't invalidate tokens already handed out.
The only lever over them is **Revoke all user tokens** in the App's settings, which signs out every honest person too.

## 4. Refresh tokens

### 4.1 How GitHub's refresh tokens work

With expiry on, GitHub's exchange of a sign-in's code returns both an **access token**, valid for 8 hours, and a
**refresh token**, valid for about 6 months. To get a fresh access token, a server posts to
`https://github.com/login/oauth/access_token` with `client_id`, `client_secret`, `grant_type=refresh_token` and the
refresh token. GitHub returns a new access token and a new refresh token, and the old refresh token is spent - each
works once. Since each refresh needs the client secret, in this design every refresh would go through the token
exchange.

The token exchange, `src/curation/oauthWorker.mjs`, currently discards the refresh token, so nothing longer-lived than
the 8-hour access token ever reaches the browser.

### 4.2 Operating them

1. At sign-in, the token exchange seals the refresh token with `SESSION_KEY`, as it seals the session, and hands it to
   the page with the access token.
2. The page keeps both. When GitHub rejects the access token, or it nears its 8 hours, the page posts the sealed
   refresh token to a new `/refresh` endpoint.
3. `/refresh` unseals it, calls GitHub with the client secret, and returns the new access token and a newly sealed
   refresh token, which the page keeps in place of the old.
4. Signing out forgets both.

That is perhaps 40 lines in the token exchange and 20 in `static/bioreportr/sfc/bioreportr-curation.vue`, and the token exchange
stays stateless.

### 4.3 What they buy - less than it seems

Sealing stops a thief from using the refresh token directly against GitHub, since they don't hold the client secret.
But they don't need it: they can replay the sealed refresh token to `/refresh`, and obtain fresh tokens for six
months.

* The token exchange's check of the requesting origin only stops other websites running in a browser. A script on a
  server can send any `Origin` it likes.
* Rotation doesn't expose a theft. If the thief refreshes first, the person's next refresh simply fails, and they
  sign in again.

In practice, a stolen refresh token grants about what an access token that never expires does. Refresh tokens pay off
for a client which can keep a secret, which a static page can't.

### 4.4 Making long sessions safer, if they are wanted

* **Cap their lifetime.** Seal the time of sign-in into the refresh token, and have `/refresh` refuse past, say, 14 or
  30 days, however long GitHub would allow.
* **Keep the refresh tokens in the token exchange's own storage** (§5), with the page holding only an opaque session
  id. The token exchange could then revoke a session, limit how often it is refreshed, and expire one left idle. The id
  could still be stolen from local storage, but there would be a way to cut it off. The cost is giving up
  statelessness, and keeping a store of people's tokens.
* Combine either with the measures of §6.

## 5. Storage for the token exchange

**Without refresh tokens, the token exchange needs no storage.** It handles only two short-lived, self-contained
records:

* the sign-in's `state`, carrying the page to return to - sealed, handed to GitHub, returned on the callback, and
  expiring after 10 minutes
* the `session`, carrying the access token - exchanged by the page for the token as soon as it returns from GitHub,
  and expiring after 5 minutes

Each is sealed with AES-GCM under `SESSION_KEY`, so is both secret and proof against alteration, and the token
exchange can trust what it reads without remembering anything. `src/curation/wrangler.toml` binds no storage, and there
is nothing to provision beyond the two secrets, `CLIENT_SECRET` and `SESSION_KEY`.

The price of statelessness is that the token exchange has no list of who is signed in, so it can't sign out an
individual. Revocation stays with GitHub: a person can revoke the App in their GitHub settings, and the App's settings
can revoke every token. With 8-hour tokens, this is an acceptable gap.

Even refresh tokens wouldn't require storage, since the sealed, capped version of §4.4 stays stateless. Storage would
be wanted only to keep refresh tokens in the token exchange, so that sessions could be revoked.

### 5.1 Cloudflare Workers KV, should storage be wanted

Workers KV is still part of Cloudflare's free Workers plan. Its
[limits page](https://developers.cloudflare.com/kv/platform/limits) gives, for the free plan, 100,000 reads a day,
1,000 writes a day to different keys and 1 a second to the same key, and 1 GB of storage per account and per namespace.
These would comfortably cover stored refresh tokens, since each sign-in and each refresh writes one key - a busy day of
curation is a few dozen writes.

* KV is **eventually consistent**: a write can take up to about a minute to be seen everywhere. Since refresh tokens
  are single-use, one rotated in one place and read stale in another could fail a refresh. Cloudflare's Durable
  Objects, which are consistent, avoid this.
* The limits change over time - Cloudflare's [2020 launch post](https://blog.cloudflare.com/workers-kv-free-tier/)
  described them differently - so check the limits page before relying on them.

## 6. Recommendation

1. **Keep the 8-hour expiry, without refresh tokens.** For notes made now and then, this is the right trade, and it
   keeps the token exchange stateless.
2. **Consider keeping the token in session storage** instead of local storage, so that signing in lasts until the tab
   is closed, cutting the risk of a shared computer, at the cost of signing in more often.
3. **Add a Content Security Policy** to the site's pages, limiting which scripts may run. This is the main defence
   against a script reading the token, whatever its lifetime.
4. **Advise maintainers** to add notes from a separate, ordinary GitHub account, so that the most powerful tokens never
   pass through the site.

If people find signing in every 8 hours a nuisance in practice, the sealed, capped refresh tokens of §4.2 and §4.4 are
the trade to make, after 2 and 3.
