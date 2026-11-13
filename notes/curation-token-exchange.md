# Signing in for community curation: the token exchange, and enrolling a repository

The community curation of `community-curation-design.md` posts each note to GitHub Discussions as the person who wrote
it, signed in through GitHub. This note covers what that needs, how to set it up once, and what each repository wanting
curation needs.

## 1. Why a token exchange is needed

Signing in to GitHub ends with GitHub handing the site a one-time code. GitHub gives the user's token only in exchange
for that code together with the app's **client secret**, and its token endpoint refuses requests from browsers. A static
site can't keep a secret, so one small service must do this one step. giscus does the same through giscus.app, which
runs giscus's own app. Its comment box is an iframe on giscus.app, so its token never reaches the page hosting it, and
can't be used to post anything but what is typed into that box.

The service here, `src/curation/oauthWorker.mjs`, does no more than that one step:

* It keeps no state and no data. The sign-in's `state` and the `session` it returns to the page are sealed with AES-GCM
  under its `SESSION_KEY`, so they can be read by no one else, and altered by no one. They expire after 10 and 5
  minutes.
* It serves only the sites named in `ALLOWED_ORIGINS`: it returns only to their pages, and answers only their requests
  for the token.
* The page keeps the token in the browser's local storage, as giscus keeps its session. Signing out forgets it.

One service, and one GitHub App, serve any number of sites and repositories.

Why tokens expire after 8 hours, what refresh tokens would and wouldn't buy, and when the service would need storage,
are in `curation-token-lifetime.md`.

## 2. Requirements

* A **GitHub App**, owned by the IMERSS organisation, which people authorise to post on their behalf. A GitHub App is
  used rather than an OAuth App, as giscus does, since its access is limited to the repositories it is installed on,
  and to the permission it asks for, Discussions.
* A host for the service. The service is written as a **Cloudflare Worker**, for which the free plan is ample: it
  handles a few requests each time someone signs in. Any host running JavaScript with `fetch` and Web Crypto could run
  it with small changes, e.g. Deno Deploy or a Vercel or Netlify function.
* For each repository enrolled, Discussions enabled, a category for the threads - General, by default - the App
  installed, and the site's `static/curation/config.json` filled in - see §5.

## 3. Setting up the Cloudflare Worker, once

The token exchange runs as a Cloudflare Worker named `bioreportr-curation`, from `src/curation/oauthWorker.mjs`, as
configured by `src/curation/wrangler.toml`. One Worker serves every site, so this is done once, from either project.
The Worker and the GitHub App of §4 each need something of the other - the App needs the Worker's URL as its Callback
URL, and the Worker needs the App's Client ID and client secret. So the two are set up in an interleaved order:

1. Prepare Cloudflare and wrangler (§3.1), and read the Worker's settings (§3.2).
2. Deploy the Worker without the App's credentials, to learn its URL (step 1 of §3.3).
3. Create the GitHub App with that URL, which gives the Client ID and client secret (§4.1, step 2 of §3.3).
4. Give the Worker the App's credentials, and deploy it again (step 3 of §3.3).
5. Check it (§3.4).

So §4.1 is carried out in the middle of §3.3, which says when.

### 3.1 The Cloudflare account and wrangler

1. **Create a Cloudflare account**, at `https://dash.cloudflare.com/sign-up`, for preference one belonging to IMERSS
   rather than to a person, so that the service outlives any one maintainer. The free plan suffices - it allows
   100,000 requests a day, and a sign-in makes three.
2. **Choose the account's `workers.dev` subdomain.** Every Worker of an account is served at
   `https://<worker name>.<subdomain>.workers.dev`, so with the subdomain `imerss` this Worker is served at
   `https://bioreportr-curation.imerss.workers.dev`.
   * **Where:** in the dashboard at `https://dash.cloudflare.com`, choose the account, then open **Compute** in the
     sidebar and choose **Workers & Pages** beneath it. On a narrow window the sidebar may be collapsed behind its menu
     button. The account's subdomain is shown on the Workers & Pages overview page, under
     *Your subdomain* or in the account details, with a *Change* link. Cloudflare may offer the subdomain when Workers &
     Pages is first opened, or assign one from the account's name or email. An assigned subdomain is worth replacing,
     since it appears in every sign-in's URL and can expose a person's address. If none is set, `npx wrangler deploy`
     asks for one.
   * **What is allowed:** lowercase letters, digits and hyphens, not starting or ending with a hyphen. The subdomain must
     be unique across all of Cloudflare, so a short name may already be taken.
   * **What to choose:** the organisation's name, e.g. `imerss`, or `imerss-bioinfo` if that is taken. People see it on
     the way to GitHub's authorisation page, so it should be recognisably IMERSS's. Avoid personal names, and anything
     tied to one project, since one Worker serves every site.
   * **Changing it later:** the subdomain can be changed on the same page, but this changes the URL of every Worker in
     the account. The old URLs stop working, and a new subdomain may take a few minutes to start working. After a
     change, update the App's Callback URL (§4.1) and each site's `oauthEndpoint` (§5), then rebuild and publish the
     sites. Until then, signing in fails. So choose a subdomain once, before the App is created.
   * **Instead of a subdomain:** if IMERSS's DNS is managed by Cloudflare, the Worker can be served from IMERSS's own
     domain instead, as in §3.5. This keeps the URL stable whatever happens to the account's subdomain.
3. **Sign wrangler in.** wrangler, Cloudflare's command line tool, needs Node.js and is run through `npx`, so needs no
   installation and is not a dependency of the build. From the project's `src/curation` directory:

   ```sh
   npx wrangler login     # opens the browser to authorise wrangler on the Cloudflare account
   npx wrangler whoami    # checks which account it is signed in to
   ```

   `npx wrangler login` starts a small web server on the machine running it, and opens a browser on that machine at
   Cloudflare's consent page. Once you approve, Cloudflare returns to that local server, and wrangler keeps the
   credential in your home directory, so later `wrangler` commands are signed in.

   This fails if the command runs where no browser can reach it, such as over SSH or in a container. The browser may
   not open, or Cloudflare's return to `localhost` may not reach wrangler. In that case, don't use `wrangler login`.
   Give wrangler an API token instead:

   1. In a browser on any machine, signed in to the dashboard, open your profile from the menu at the top right, then
      choose **API Tokens** > **Create Token**. Use the **Edit Cloudflare Workers** template, choosing the IMERSS
      account under *Account Resources*.
   2. Copy the token, which is shown only once.
   3. On the machine running wrangler, export it before running the `npx wrangler` commands of §3.3 and §3.5:

      ```sh
      export CLOUDFLARE_API_TOKEN=<the token>
      npx wrangler whoami    # should now name the account
      ```

   wrangler uses the token in place of `wrangler login`, for every command run in that shell.

### 3.2 Its settings

| Setting | Kind | Where it is set | Value |
|---|---|---|---|
| `CLIENT_ID` | variable | `[vars]` of `wrangler.toml` | the GitHub App's Client ID, e.g. `Iv23li...`, which GitHub shows once the App is created in §4.1 - left empty until then. Not secret, since it appears in every sign-in's URL |
| `ALLOWED_ORIGINS` | variable | `[vars]` of `wrangler.toml` | the origins of the sites, separated by commas, e.g. `"https://imerss.github.io,http://localhost:1313"` |
| `CLIENT_SECRET` | secret | `npx wrangler secret put CLIENT_SECRET` | the GitHub App's client secret, generated once the App is created in §4.1 - not set until then |
| `SESSION_KEY` | secret | `npx wrangler secret put SESSION_KEY` | any long random string, e.g. the output of `openssl rand -base64 32` |

* An origin is the scheme, host and port of a site, with no path or trailing slash. The Saanich and Howe Sound sites
  share the origin `https://imerss.github.io`, since GitHub Pages serves both from it. A site served from a custom
  domain - one with a `CNAME` - is named by that domain instead, e.g. `https://flora.example.org`.
* Keep `http://localhost:1313` only while sites are being tested locally with `hugo server`. Remove it from a
  production deployment if it is not wanted - any page served from a person's own machine at that port could then
  start a sign-in.
* Secrets are typed in at the prompt, so they never appear in the shell's history or in the repository. Never write
  them into `wrangler.toml`, which is checked in. `npx wrangler secret list` lists the names of those set, though never
  their values.
* `SESSION_KEY` needs to be kept by no one: it is used only by the Worker, to seal records lasting minutes. Generate it,
  set it, and discard it.

### 3.3 Deploying it

1. **Deploy the Worker the first time**, with `CLIENT_ID` still empty, to learn its URL:

   ```sh
   npx wrangler secret put SESSION_KEY
   # It then prompts you to enter SESSION_KEY
   # Creating the secret for the Worker "bioreportr-curation"
   # Response: ? There doesn't seem to be a Worker called "bioreportr-curation". Do you want to create a new Worker with that name and add secrets to it?
   npx wrangler deploy
   ```

   `wrangler deploy` prints the Worker's URL, e.g. `https://bioreportr-curation.imerss.workers.dev`. This is each
   site's `oauthEndpoint` (§5), and its `/callback`, e.g. `https://bioreportr-curation.imerss.workers.dev/callback`,
   is the App's Callback URL (§4.1). If `wrangler deploy` asks to register a `workers.dev` subdomain, step 2 of §3.1
   has not been done.
2. **Now create the GitHub App**, following §4.1, giving it that Callback URL, then return here. Once it is created,
   GitHub shows the App's settings page (later found at `https://github.com/organizations/IMERSS/settings/apps`, choosing
   the App's **Edit**). Choose **Credentials** in the sidebar at the left of the App's settings. The
   **Client ID** is shown there. Under client secrets, choose **New secret**, and copy the secret straight away, since
   GitHub shows it only once. Don't generate a private key, which may also be offered among the credentials. A private
   key lets the App act as itself, which this design never needs.
3. **Give the Worker the App's credentials**: write the Client ID as `CLIENT_ID` in `wrangler.toml`, then run the
   following, pasting the client secret when `wrangler secret put` asks for it:

   ```sh
   npx wrangler secret put CLIENT_SECRET
   npx wrangler deploy
   ```

   A secret takes effect as soon as it is put, without a deploy, but a change to `wrangler.toml` needs one.

### 3.4 Checking it

Set `ENDPOINT` to the Worker's URL, as `wrangler deploy` printed it, with no path and no trailing slash. This is
the same URL as each site's `oauthEndpoint`. Each check below adds its own path, `/token` or `/authorize`:

```sh
ENDPOINT=https://bioreportr-curation.imerss.workers.dev
# An allowed origin is answered with 204 and Access-Control-Allow-Origin naming it - as src/curation/enrol.mjs checks
curl -i -X OPTIONS -H "Origin: https://imerss.github.io" $ENDPOINT/token
# Signing in from an allowed page redirects (302) to github.com/login/oauth/authorize, with the App's client_id
curl -i "$ENDPOINT/authorize?redirect_uri=https://imerss.github.io/saanich-peninsula-flora/story/"
# A page of another site is refused with 400
curl -i "$ENDPOINT/authorize?redirect_uri=https://example.com/"
```

Then sign in from a site's Community Curation pane, once its repository is enrolled (§5). If something fails,
`npx wrangler tail` shows the Worker's requests and errors as they happen, as does the Worker's *Logs* tab in the
dashboard. The common faults are:

| Symptom | Cause |
|---|---|
| GitHub says *The redirect_uri is not associated with this application* | the App's Callback URL is not exactly the Worker's `/callback` |
| GitHub shows a 404 for the authorisation page | `CLIENT_ID` is empty or wrong, or `wrangler.toml` was not redeployed after setting it |
| The page returns with no session, or the Worker reports the exchange failed | `CLIENT_SECRET` is missing or wrong, or the secret was regenerated in the App |
| *The page to return to is not one of a site using this service* | the site's origin is missing from `ALLOWED_ORIGINS` |
| The browser's console reports a CORS error for `/token` | likewise, `ALLOWED_ORIGINS` |

### 3.5 Looking after it

* **Adding a site**: add its origin to `ALLOWED_ORIGINS` in `wrangler.toml`, and `npx wrangler deploy` again. A site at
  an origin already listed, such as another repository's GitHub Pages site under `https://imerss.github.io`, needs no
  change.
* **Rotating the client secret**: generate a new one in the App's settings, `npx wrangler secret put CLIENT_SECRET`,
  then delete the old one in the App. Rotating `SESSION_KEY` at any time is harmless - at worst, someone midway
  through signing in starts again. Neither revokes tokens already handed out - see §3 of `curation-token-lifetime.md`.
* **Updating the code**: after a change to `oauthWorker.mjs`, which reaches each project through
  `copyFrameworkOut.sh`, deploy it from one project only. `npx wrangler deployments list` shows what is deployed, and
  `npx wrangler rollback` restores the previous version.
* **A custom domain**: a Worker can instead be served from a domain whose DNS Cloudflare manages, under the Worker's
  Settings > Domains & Routes. Its URL then replaces the `workers.dev` one as each site's `oauthEndpoint` and in the
  App's Callback URL.
* **Access to the account**: invite the other maintainers to the Cloudflare account, under Manage Account > Members,
  rather than sharing a password.

## 4. Setting up the GitHub App, once

### 4.1 Create the GitHub App

This is step 2 of §3.3: the Worker must already be deployed, since the App needs its URL.

Open the form for a new App directly, at `https://github.com/organizations/IMERSS/settings/apps/new`. You need to be an
owner of the organisation, or have its *App manager* role.

To find it in the organisation's settings instead, open **Developer settings** at the foot of the settings' sidebar,
then **GitHub Apps**, then **New GitHub App**. Don't confuse this with **Third-party Access > GitHub Apps** higher in the
sidebar. That page lists Apps installed on the organisation and has no control for creating one. If Developer settings
doesn't appear, you aren't an owner of the organisation.

Fill in the form as follows:

| Setting | Value |
|---|---|
| GitHub App name | e.g. `IMERSS community curation` - shown to people as they authorise it |
| Homepage URL | e.g. `https://imerss.org` |
| Redirect URI, under *Identifying and authorizing users* | the Worker's `/callback`, from §3.3, e.g. `https://bioreportr-curation.<account>.workers.dev/callback` |
| Expire user authorization tokens | on - a token lasts 8 hours, after which the site asks the person to sign in again |
| Request user authorization (OAuth) during installation | off |
| Enable Device Flow | off |
| Webhook | inactive - untick Active |
| Repository permissions | **Discussions: Read and write** - Metadata: Read-only is added by GitHub |
| Organization and account permissions | none |
| Where can this GitHub App be installed? | Only on this account, unless repositories of other accounts are to be enrolled |

Then, under **Credentials** in the sidebar of the App's settings, note its **Client ID**, and choose **New secret** to
generate a **client secret**, which GitHub shows only once. No private key is needed -
the App never acts as itself.

### 4.2 Give the Worker its credentials

Return to step 3 of §3.3, which writes the Client ID into `wrangler.toml`, puts the client secret, and deploys the
Worker again.

## 5. Enrolling a repository

For each repository whose site is to take curation notes:

1. **Enable Discussions**, under the repository's Settings > General > Features.
2. **Choose the category** holding the threads. By default this is **General**, one of the categories GitHub creates
   when Discussions are enabled, so there is nothing to do. Curation threads, titled `taxon:<id> <name>`, then sit
   beside any other discussions there, which the consolidation ignores. A repository wanting them apart can create a
   category of its own under Discussions > Categories - GitHub's API can't create one - with the *Open-ended
   discussion* format. Not *Announcement*, under which only maintainers may start a thread, since a person's first
   note on a taxon starts its thread.
3. **Install the App** on the repository. Installing takes two pages:
   1. Open `https://github.com/apps/<app-slug>/installations/new`, where `<app-slug>` is `imerss-community-curation`.
      The first page asks *Choose an account to install IMERSS community curation on*. Choose **IMERSS**.
   2. The next page asks which repositories the App may reach. Choose **Only select repositories**, pick the
      repository from the list, and choose **Install**. It confirms the App's single permission, Discussions: read and
      write.

   Once the App is installed on IMERSS, the same link leads to the installation's settings instead. To enrol another
   repository, add it there under *Repository access* > *Only select repositories*, and choose **Save**. The
   installation can also be found under the organisation's Settings > Third-party Access > GitHub Apps, choosing
   **Configure** beside the App.
4. **Allow the site's origin** in the Worker's `ALLOWED_ORIGINS`, if it is not already there. This is the line
   `ALLOWED_ORIGINS = "..."` under `[vars]` in `src/curation/wrangler.toml`, a list of origins separated by commas -
   see §3.2. A site on GitHub Pages under IMERSS has the origin `https://imerss.github.io`, which is already listed, so
   needs nothing. Only a site with a custom domain needs adding, e.g.
   `ALLOWED_ORIGINS = "https://imerss.github.io,https://flora.example.org"`, after which run `npx wrangler deploy` from
   `src/curation`, as in §3.5. The check in §3.4 confirms that an origin is allowed.
5. **Fill in `static/curation/config.json`** with the repository's node id, the category's node id, and the service's
   URL:

   ```json
   {
       "backend": "github",
       "repository": "IMERSS/saanich-peninsula-flora",
       "repositoryId": "R_kgDO...",
       "category": "General",
       "categoryId": "DIC_kwDO...",
       "oauthEndpoint": "https://bioreportr-curation.<account>.workers.dev"
   }
   ```

   There are three ways to find the two ids, all of which need Discussions enabled (step 1):

   * `src/curation/enrol.mjs` finds them and writes the file (§6).
   * giscus's configuration page, `https://giscus.app`, reports them. Enter the repository and choose the category,
     and the snippet it shows holds them as `data-repo-id` and `data-category-id`.
   * The GitHub CLI, `gh` (§5.1), asks GitHub for them:

     ```sh
     gh api graphql -f query='query { repository(owner: "IMERSS", name: "saanich-peninsula-flora") {
         id discussionCategories(first: 50) { nodes { id name } } } }'
     ```

     `data.repository.id` is `repositoryId`, and the `id` beside `"name": "General"`, or the category chosen, is
     `categoryId`.
6. **Build and publish** the site. The consolidation workflow, `.github/workflows/curation.yml`, comes with the
   framework. It grants itself the permission it needs, to write the repository's contents and read its discussions,
   unless an organisation policy forbids workflows write access, in which case allow it under Settings > Actions >
   General > Workflow permissions.

### 5.1 Installing the GitHub CLI

The query of step 5, and `src/curation/enrol.mjs` (§6), use the GitHub CLI, `gh`, signed in as someone who
administers the repository.

On Ubuntu, including Ubuntu under WSL, install it from GitHub's own package repository, which keeps it up to date. This
is the method given at `https://github.com/cli/cli/blob/trunk/docs/install_linux.md`:

```sh
(type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
    && sudo mkdir -p -m 755 /etc/apt/keyrings \
    && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    && cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && sudo apt update && sudo apt install gh -y
```

Ubuntu's own `sudo apt install gh` also works, but may give an older version. On other systems, see
`https://github.com/cli/cli#installation`, e.g. `brew install gh` with Homebrew, or `winget install --id GitHub.cli` on
Windows.

Then sign it in, and check it:

```sh
gh auth login     # choose GitHub.com and HTTPS, and sign in with a web browser - it gives a one-time code to enter
gh auth status    # names the account signed in
```

Under WSL, if no browser opens, open the address `gh auth login` prints in a Windows browser, and enter the code
there. Later, `sudo apt upgrade` keeps `gh` up to date.

## 6. Automating enrolment

`src/curation/enrol.mjs` does what can be automated, using the GitHub CLI, `gh`, signed in as someone who administers
the repository, installed and signed in as in §5.1. Then, from the project's root:

```sh
node src/curation/enrol.mjs --repo IMERSS/saanich-peninsula-flora --endpoint https://bioreportr-curation.<account>.workers.dev \
    --app <app-slug> [--category <name, by default General>] [--dry-run]
```

| Step | Automated? |
|---|---|
| 1. Enable Discussions | **Yes** - through the REST API's `has_discussions` |
| 2. Choose the category | **Yes**, for General - the script finds it once Discussions are enabled. GitHub documents creating its standard categories when Discussions are enabled in the repository's settings - if enabling them through the API were ever to leave General missing, or another category is named which doesn't exist, the script gives the page on which to create it, since GitHub's API has no way to create a category |
| 3. Install the App | **No** - installing an App on a repository takes the owner's consent in the browser. The script gives the page for it |
| 4. Allow the site's origin | **Checked** - the script finds the site's origin from the repository's GitHub Pages settings, and asks the service whether it allows it, reporting what to add to `ALLOWED_ORIGINS` if not |
| 5. Fill in config.json | **Yes** - the script looks up the repository's and category's ids, and writes `static/curation/config.json` of the project in which it is run |
| 6. Build and publish | No - left to the usual build |

So enrolling a repository comes down to running the script, installing the App when it asks, and committing the
configuration it writes. The only step needing a person in the browser is the App's installation.

The steps the script can't do could be automated only by something holding the App's own credentials - a private key,
with which the App can act for itself - and even then only for repositories it is already installed on. Neither is
worth the risk of keeping such a key for steps done once per repository.
