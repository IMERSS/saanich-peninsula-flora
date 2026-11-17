/*
 * The token exchange of bioReportR's community curation - see notes/curation-token-exchange.md and
 * notes/community-curation-design.md. A static site can't hold the client secret which GitHub requires to exchange
 * the code of a sign-in for the user's token, and GitHub's token endpoint refuses requests from browsers. This small
 * service does that one step, as giscus.app does for giscus. It is a Cloudflare Worker, and serves any number of sites,
 * named by ALLOWED_ORIGINS. It keeps no state: what it hands out is sealed with AES-GCM under SESSION_KEY.
 *
 * People may instead sign in with iNaturalist - see §7 of notes/curation-token-exchange.md. An iNat token can't post
 * to GitHub, so for them the service posts as the GitHub App itself, naming them in the comment. It then hands the
 * page no token, only a sealed session naming the person, which the page presents with each note.
 *
 *   GET  /authorize?redirect_uri=<page>[&provider=github|inat]  - redirects to GitHub or iNat to sign in, if the page's
 *                                                                  origin is allowed. The provider defaults to github
 *   GET  /callback?code=...&state=...      - GitHub returns here; exchanges the code for the user's token, and returns
 *                                            to the page with ?curation_session=<the token, sealed>
 *   GET  /callback/inat?code=...&state=... - iNat returns here; learns who the person is, discards their token, and
 *                                            returns to the page with ?curation_session=<their identity, sealed>
 *   POST /token  {"session": "..."}        - the page exchanges the session for the GitHub token, as
 *                                            {provider: "github", token}, or for an iNat identity, as
 *                                            {provider: "inat", viewer: {login, avatarUrl, url}, session}, the session
 *                                            being one lasting the day, to present with each note
 *   POST /post   {"session": "...", ...}   - posts a note for a person signed in with iNat - see postNote
 *
 * Its settings, as the Worker's variables and secrets:
 *   CLIENT_ID          - the client id of the GitHub App
 *   CLIENT_SECRET      - its client secret, as a secret
 *   APP_ID             - the GitHub App's App ID, for posting as the App
 *   APP_PRIVATE_KEY    - a private key of the App, in PKCS#8 PEM, as a secret - converted from the PKCS#1 key GitHub
 *                        issues with `openssl pkcs8 -topk8 -nocrypt -in key.pem`
 *   INAT_CLIENT_ID     - the App ID of the iNaturalist application
 *   INAT_CLIENT_SECRET - its secret, as a secret
 *   SESSION_KEY        - any long random string, as a secret, e.g. from `openssl rand -base64 32`
 *   ALLOWED_ORIGINS    - the origins of the sites using it, separated by commas, e.g.
 *                        "https://imerss.github.io,http://localhost:1313"
 *   POST_LIMITER       - optionally, a Workers rate limiting binding, limiting the notes posted for each iNat user
 */

const sessionLifetime = 5 * 60 * 1000;
const stateLifetime = 10 * 60 * 1000;
// How long a person signed in with iNat may post before signing in again
const identityLifetime = 24 * 60 * 60 * 1000;
// The longest note accepted for posting, in characters
const maxBodyLength = 20000;

const encoder = new TextEncoder();

const base64url = {
    encode: bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    decode: text => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0))
};

/**
 * Derive the AES-GCM key sealing states and sessions from SESSION_KEY.
 * @param {String} secret - The value of SESSION_KEY
 * @return {Promise<CryptoKey>} The key
 */
const sealingKey = async function (secret) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
};

/**
 * Seal a record, so that only this service can read it, and none can alter it.
 * @param {String} secret - The value of SESSION_KEY
 * @param {Object} record - The record
 * @return {Promise<String>} The sealed record, safe to place in a URL
 */
export const seal = async function (secret, record) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt({name: "AES-GCM", iv}, await sealingKey(secret), encoder.encode(JSON.stringify(record)));
    return base64url.encode(iv) + "." + base64url.encode(new Uint8Array(sealed));
};

/**
 * Open a record sealed by `seal`, checking that it has not expired.
 * @param {String} secret - The value of SESSION_KEY
 * @param {String} text - The sealed record
 * @return {Promise<Object|null>} The record, or null if it is not one sealed by this service, or has expired
 */
export const open = async function (secret, text) {
    let record = null;
    try {
        const [iv, sealed] = String(text).split(".");
        const opened = await crypto.subtle.decrypt({name: "AES-GCM", iv: base64url.decode(iv)}, await sealingKey(secret), base64url.decode(sealed));
        record = JSON.parse(new TextDecoder().decode(opened));
    } catch (error) {
        record = null;
    }
    return record && record.expires > Date.now() ? record : null;
};

const allowedOrigins = env => (env.ALLOWED_ORIGINS || "").split(",").map(origin => origin.trim()).filter(origin => origin);

/**
 * Determine whether a URL is that of a page of a site using the service.
 * @param {Object} env - The Worker's settings
 * @param {String} url - The URL
 * @return {Boolean} `true` if its origin is allowed
 */
const isAllowed = function (env, url) {
    let origin = null;
    try {
        origin = new URL(url).origin;
    } catch (error) {
        origin = null;
    }
    return !!origin && allowedOrigins(env).includes(origin);
};

const reply = (status, body, headers = {}) => new Response(typeof body === "string" ? body : JSON.stringify(body),
    {status, headers: {"Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json", ...headers}});

const corsHeaders = (env, request) => {
    const origin = request.headers.get("Origin");
    return origin && allowedOrigins(env).includes(origin) ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin"
    } : null;
};

/**
 * Read the JSON body of a request, as an empty object if it has none or it is not JSON.
 * @param {Request} request - The request
 * @return {Promise<Object>} Its body
 */
const readBody = async function (request) {
    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        body = {};
    }
    return body && typeof body === "object" ? body : {};
};

/*
 * The services people may sign in with. Each names its authorization and token endpoints, its credentials among the
 * Worker's settings, the path it returns to, and how its token is turned into what is sealed into the session.
 */
const providers = {
    github: {
        authorizeUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        clientId: env => env.CLIENT_ID,
        clientSecret: env => env.CLIENT_SECRET,
        // Unchanged since GitHub sign-in alone was offered, so that the App's Callback URL still holds
        callbackPath: "/callback",
        // GitHub's token is handed to the page, which posts as the person themselves
        sessionRecord: async token => ({provider: "github", token})
    },
    inat: {
        authorizeUrl: "https://www.inaturalist.org/oauth/authorize",
        tokenUrl: "https://www.inaturalist.org/oauth/token",
        clientId: env => env.INAT_CLIENT_ID,
        clientSecret: env => env.INAT_CLIENT_SECRET,
        callbackPath: "/callback/inat",
        // iNat's token grants write access to the person's iNat data, so is used only to learn who they are, and dropped
        sessionRecord: async token => ({provider: "inat", identity: await inatIdentity(token)})
    }
};

/**
 * Exchange the code of a sign-in for the person's token, at a provider's token endpoint.
 * @param {Object} provider - The provider, from `providers`
 * @param {Object} env - The Worker's settings
 * @param {String} code - The code the provider returned
 * @param {String} redirectUri - The callback URL the sign-in began with
 * @return {Promise<Object>} The provider's reply, holding `access_token` if the exchange succeeded
 */
const exchangeCode = async function (provider, env, code, redirectUri) {
    const response = await fetch(provider.tokenUrl, {
        method: "POST",
        // Form-encoded, as both GitHub and iNat accept - iNat's documentation shows only this
        headers: {"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({client_id: provider.clientId(env), client_secret: provider.clientSecret(env), code,
            redirect_uri: redirectUri, grant_type: "authorization_code"})
    });
    let result = {};
    try {
        result = await response.json();
    } catch (error) {
        result = {error: response.status + " " + response.statusText};
    }
    return result;
};

/**
 * Learn who holds an iNat token, from iNat's own record of the signed-in user.
 * @param {String} token - The person's iNat access token
 * @return {Promise<Object|null>} Their identity, as {id, login, avatarUrl, url}, or null if iNat did not say
 */
const inatIdentity = async function (token) {
    const response = await fetch("https://www.inaturalist.org/users/edit.json", {
        headers: {"Accept": "application/json", "Authorization": "Bearer " + token}
    });
    let user = null;
    if (response.ok) {
        user = await response.json();
    }
    return user && user.id && user.login ? {
        id: user.id,
        login: user.login,
        avatarUrl: user.icon_url ?? user.medium_user_icon_url ?? null,
        url: "https://www.inaturalist.org/people/" + encodeURIComponent(user.login)
    } : null;
};

/**
 * Turn a PEM private key into the bytes of its DER encoding.
 * @param {String} pem - The key in PEM, of a PKCS#8 "PRIVATE KEY"
 * @return {Uint8Array} Its DER encoding
 */
const pemToDer = pem => Uint8Array.from(atob(String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), char => char.charCodeAt(0));

/**
 * Sign the short-lived JWT with which the GitHub App authenticates as itself.
 * @param {Object} env - The Worker's settings
 * @return {Promise<String>} The JWT
 */
const appJwt = async function (env) {
    const now = Math.floor(Date.now() / 1000);
    // Backdated a minute against clock drift, and lasting under GitHub's limit of 10 minutes
    const claims = {iat: now - 60, exp: now + 9 * 60, iss: String(env.APP_ID)};
    const encode = object => base64url.encode(encoder.encode(JSON.stringify(object)));
    const unsigned = encode({alg: "RS256", typ: "JWT"}) + "." + encode(claims);
    const key = await crypto.subtle.importKey("pkcs8", pemToDer(env.APP_PRIVATE_KEY), {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, false, ["sign"]);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
    return unsigned + "." + base64url.encode(new Uint8Array(signature));
};

/**
 * Make a request of GitHub's REST API.
 * @param {String} path - The path, e.g. "/repos/IMERSS/saanich-peninsula-flora/installation"
 * @param {String} credential - The value of the Authorization header
 * @param {Object} [options] - Further options to `fetch`, e.g. its method and body
 * @return {Promise<Object>} The reply, as {ok, status, data}
 */
const githubRest = async function (path, credential, options = {}) {
    const response = await fetch("https://api.github.com" + path, {
        ...options,
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": credential,
            "User-Agent": "bioreportr-curation",
            "X-GitHub-Api-Version": "2022-11-28",
            ...(options.body ? {"Content-Type": "application/json"} : {})
        }
    });
    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }
    return {ok: response.ok, status: response.status, data};
};

/**
 * Obtain a token with which the GitHub App may write to one repository's Discussions, through its installation there.
 * It is granted only that permission, on only that repository.
 * @param {Object} env - The Worker's settings
 * @param {String} repository - The repository, as "owner/name"
 * @return {Promise<String|null>} The installation token, or null if the App is not installed on the repository
 */
const installationToken = async function (env, repository) {
    const jwt = "Bearer " + await appJwt(env);
    const [owner, name] = repository.split("/");
    const installation = await githubRest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) + "/installation", jwt);
    let token = null;
    if (installation.ok && installation.data?.id) {
        const granted = await githubRest("/app/installations/" + installation.data.id + "/access_tokens", jwt, {
            method: "POST",
            body: JSON.stringify({repositories: [name], permissions: {discussions: "write"}})
        });
        token = granted.ok ? granted.data?.token ?? null : null;
    }
    return token;
};

/**
 * Make a request of GitHub's GraphQL API, throwing if it fails.
 * @param {String} token - The installation token
 * @param {String} query - The query
 * @param {Object} variables - Its variables
 * @return {Promise<Object>} The reply's data
 */
const graphql = async function (token, query, variables) {
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {"Authorization": "bearer " + token, "Content-Type": "application/json", "User-Agent": "bioreportr-curation"},
        body: JSON.stringify({query, variables})
    });
    const result = await response.json();
    if (!response.ok || result.errors) {
        throw new Error(result.errors ? result.errors.map(error => error.message).join("; ") : response.status + " " + response.statusText);
    }
    return result.data;
};

/*
 * Every comment posted for an iNat user ends with this marker, naming them and the note's subject, so that a later
 * note of theirs on the same subject can displace it, as a GitHub user's does - see `submit` of the github backend in
 * bioreportr-curation.vue. Since all such comments are the App's, `viewerDidAuthor` can't tell whose they are.
 */
const posterMarker = "curation-poster";

const markerLine = (identity, subject) => "<!-- " + posterMarker + " " + JSON.stringify({inat: identity.id, subject}) + " -->";

/**
 * Read the marker of a comment posted for an iNat user.
 * @param {String} body - The comment's body
 * @return {Object|null} The marker, as {inat, subject}, or null if the comment has none
 */
const readMarker = function (body) {
    const match = String(body || "").match(new RegExp("<!-- " + posterMarker + " (\\{.*\\}) -->\\s*$"));
    let marker = null;
    if (match) {
        try {
            marker = JSON.parse(match[1]);
        } catch (error) {
            marker = null;
        }
    }
    return marker;
};

/**
 * Compose the body of a comment posted for an iNat user: their note, a line naming them, and the marker. Any marker
 * within the note itself is removed, so that one person's note can't pass for another's.
 * @param {Object} identity - The person, as {id, login, url}
 * @param {String} body - Their note
 * @param {String} subject - The note's subject, as `bioreportr.curation.subjectKey` gives it
 * @return {String} The comment's body
 */
const composeBody = (identity, body, subject) => body.replaceAll(posterMarker, "curation_poster").trimEnd() +
    "\n\n*Posted for iNaturalist user [@" + identity.login + "](" + identity.url + ")*\n\n" + markerLine(identity, subject);

/**
 * Post a note to a taxon's thread for a person signed in with iNat, as the GitHub App, doing as `submit` of the github
 * backend in bioreportr-curation.vue does for a person signed in with GitHub: it finds the taxon's thread, or starts
 * it, removes the person's earlier notes on the same subject, and adds the note.
 * @param {Object} env - The Worker's settings
 * @param {Object} identity - The person, as {id, login, url}
 * @param {Object} request - The note, as {repository, repositoryId, categoryId, taxonId, title, threadBody, subject,
 *     body} - `title` and `threadBody` being those of the taxon's thread, if it must be started
 * @return {Promise<Object>} The comment posted, as {id, url}
 */
const postNote = async function (env, identity, request) {
    const token = await installationToken(env, request.repository);
    if (!token) {
        throw new Error("The curation App is not installed on " + request.repository);
    }
    const query = `repo:${request.repository} in:title "taxon:${request.taxonId}"`;
    const found = await graphql(token, `query($query: String!) {
        search(type: DISCUSSION, query: $query, first: 20) { nodes { ... on Discussion { id title category { id } } } }
    }`, {query});
    let thread = found.search.nodes.find(node => node.category?.id === request.categoryId && node.title.split(" ")[0] === "taxon:" + request.taxonId);
    if (!thread) {
        const created = await graphql(token, `mutation($input: CreateDiscussionInput!) {
            createDiscussion(input: $input) { discussion { id } }
        }`, {input: {repositoryId: request.repositoryId, categoryId: request.categoryId, title: request.title, body: request.threadBody}});
        thread = created.createDiscussion.discussion;
    } else {
        const data = await graphql(token, `query($id: ID!) {
            node(id: $id) { ... on Discussion { comments(first: 100) { nodes { id viewerDidAuthor body } } } }
        }`, {id: thread.id});
        const earlier = data.node.comments.nodes.filter(comment => {
            const marker = comment.viewerDidAuthor ? readMarker(comment.body) : null;
            return !!marker && marker.inat === identity.id && marker.subject === request.subject;
        });
        for (const comment of earlier) {
            await graphql(token, "mutation($id: ID!) { deleteDiscussionComment(input: {id: $id}) { comment { id } } }", {id: comment.id});
        }
    }
    const added = await graphql(token, `mutation($id: ID!, $body: String!) {
        addDiscussionComment(input: {discussionId: $id, body: $body}) { comment { id url } }
    }`, {id: thread.id, body: composeBody(identity, request.body, request.subject)});
    return added.addDiscussionComment.comment;
};

/**
 * Check that a request to post a note is complete and within limits.
 * @param {Object} body - The request's body
 * @return {String|null} What is wrong with it, or null if nothing
 */
const checkNote = function (body) {
    const strings = ["repository", "repositoryId", "categoryId", "taxonId", "title", "threadBody", "subject", "body"];
    const missing = strings.filter(key => typeof body[key] !== "string" || !body[key]);
    let problem = null;
    if (missing.length) {
        problem = "The note lacks " + missing.join(", ");
    } else if (!/^[\w.-]+\/[\w.-]+$/.test(body.repository)) {
        problem = "The repository is not of the form owner/name";
    } else if (!/^[\w.:|-]+$/.test(body.taxonId) || !body.title.startsWith("taxon:" + body.taxonId + " ")) {
        problem = "The thread's title does not name the taxon";
    } else if (body.body.length > maxBodyLength || body.threadBody.length > maxBodyLength || body.title.length > 256) {
        problem = "The note is too long";
    }
    return problem;
};

/**
 * Begin a sign-in with a provider.
 * @param {Object} env - The Worker's settings
 * @param {URL} url - The URL of the request
 * @return {Promise<Response>} A redirect to the provider, or a refusal
 */
const authorize = async function (env, url) {
    const redirect = url.searchParams.get("redirect_uri");
    const providerName = url.searchParams.get("provider") || "github";
    const provider = providers[providerName];
    let togo;
    if (!provider) {
        togo = reply(400, "Signing in with " + providerName + " is not offered");
    } else if (!redirect || !isAllowed(env, redirect)) {
        togo = reply(400, "The page to return to is not one of a site using this service");
    } else {
        const state = await seal(env.SESSION_KEY, {provider: providerName, redirect, expires: Date.now() + stateLifetime});
        const target = new URL(provider.authorizeUrl);
        target.searchParams.set("client_id", provider.clientId(env));
        target.searchParams.set("redirect_uri", url.origin + provider.callbackPath);
        target.searchParams.set("response_type", "code");
        target.searchParams.set("state", state);
        togo = Response.redirect(target.toString(), 302);
    }
    return togo;
};

/**
 * Complete a sign-in, when a provider returns to the service.
 * @param {String} providerName - The name of the provider returning, as in `providers`
 * @param {Object} env - The Worker's settings
 * @param {URL} url - The URL of the request
 * @return {Promise<Response>} A redirect to the page the sign-in began from, with its session, or a refusal
 */
const callback = async function (providerName, env, url) {
    const provider = providers[providerName];
    const state = await open(env.SESSION_KEY, url.searchParams.get("state"));
    const code = url.searchParams.get("code");
    let togo;
    if (!state || !code || state.provider !== providerName || !isAllowed(env, state.redirect)) {
        togo = reply(400, "Signing in has expired or was not begun here - please return to the site and sign in again");
    } else {
        const result = await exchangeCode(provider, env, code, url.origin + provider.callbackPath);
        const record = result.access_token ? await provider.sessionRecord(result.access_token) : null;
        if (!result.access_token) {
            togo = reply(502, providerName + " did not grant a token: " + (result.error_description || result.error || "no reason given"));
        } else if (providerName === "inat" && !record.identity) {
            togo = reply(502, "iNaturalist did not say who is signed in");
        } else {
            const session = await seal(env.SESSION_KEY, {...record, expires: Date.now() + sessionLifetime});
            // The session joins the page's query, ahead of its hash, which holds the page's own state
            const page = new URL(state.redirect);
            page.searchParams.set("curation_session", session);
            togo = Response.redirect(page.toString(), 302);
        }
    }
    return togo;
};

const preflight = async function (request, env) {
    const cors = corsHeaders(env, request);
    return cors ? new Response(null, {status: 204, headers: cors}) : reply(403, "Origin not allowed");
};

const handlers = {
    "GET /authorize": (request, env, url) => authorize(env, url),
    "GET /callback": (request, env, url) => callback("github", env, url),
    "GET /callback/inat": (request, env, url) => callback("inat", env, url),
    "OPTIONS /token": preflight,
    "POST /token": async function (request, env) {
        const cors = corsHeaders(env, request);
        let togo;
        if (!cors) {
            togo = reply(403, {error: "Origin not allowed"});
        } else {
            const body = await readBody(request);
            const session = await open(env.SESSION_KEY, body.session);
            if (!session) {
                togo = reply(401, {error: "The session has expired - please sign in again"}, cors);
            } else if (session.provider === "inat") {
                // Exchanged for a session lasting the day, which the page keeps in place of a token
                const identity = session.identity;
                const lasting = await seal(env.SESSION_KEY, {provider: "inat", identity, expires: Date.now() + identityLifetime});
                togo = reply(200, {provider: "inat", viewer: {login: identity.login, avatarUrl: identity.avatarUrl, url: identity.url}, session: lasting}, cors);
            } else {
                // Sessions sealed before iNat sign-in was offered have no provider, and are GitHub's
                togo = reply(200, {provider: "github", token: session.token}, cors);
            }
        }
        return togo;
    },
    "OPTIONS /post": preflight,
    "POST /post": async function (request, env) {
        const cors = corsHeaders(env, request);
        let togo;
        if (!cors) {
            togo = reply(403, {error: "Origin not allowed"});
        } else {
            const body = await readBody(request);
            const session = await open(env.SESSION_KEY, body.session);
            const problem = checkNote(body);
            if (!session || session.provider !== "inat" || !session.identity) {
                togo = reply(401, {error: "The session has expired - please sign in again"}, cors);
            } else if (problem) {
                togo = reply(400, {error: problem}, cors);
            } else {
                const limited = env.POST_LIMITER ? !(await env.POST_LIMITER.limit({key: "inat:" + session.identity.id})).success : false;
                if (limited) {
                    togo = reply(429, {error: "Too many notes in a short time - please wait a minute and try again"}, cors);
                } else {
                    try {
                        togo = reply(200, {comment: await postNote(env, session.identity, body)}, cors);
                    } catch (error) {
                        togo = reply(502, {error: "GitHub refused the note: " + error.message}, cors);
                    }
                }
            }
        }
        return togo;
    }
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const handler = handlers[request.method + " " + url.pathname];
        return handler ? handler(request, env, url) : reply(404, "Not found");
    }
};
