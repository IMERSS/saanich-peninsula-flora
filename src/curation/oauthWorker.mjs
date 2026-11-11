/*
 * The token exchange of bioReportR's community curation - see notes/curation-token-exchange.md and
 * notes/community-curation-design.md. A static site can't hold the client secret which GitHub requires to exchange
 * the code of a sign-in for the user's token, and GitHub's token endpoint refuses requests from browsers. This small
 * service does that one step, as giscus.app does for giscus. It is a Cloudflare Worker, and serves any number of sites,
 * named by ALLOWED_ORIGINS. It keeps no state: what it hands out is sealed with AES-GCM under SESSION_KEY.
 *
 *   GET  /authorize?redirect_uri=<page>  - redirects to GitHub to sign in, if the page's origin is allowed
 *   GET  /callback?code=...&state=...    - GitHub returns here; exchanges the code for the user's token, and returns
 *                                          to the page with ?curation_session=<the token, sealed>
 *   POST /token  {"session": "..."}      - the page exchanges the session for the token itself
 *
 * Its settings, as the Worker's variables and secrets:
 *   CLIENT_ID       - the client id of the GitHub App
 *   CLIENT_SECRET   - its client secret, as a secret
 *   SESSION_KEY     - any long random string, as a secret, e.g. from `openssl rand -base64 32`
 *   ALLOWED_ORIGINS - the origins of the sites using it, separated by commas, e.g.
 *                     "https://imerss.github.io,http://localhost:1313"
 */

const sessionLifetime = 5 * 60 * 1000;
const stateLifetime = 10 * 60 * 1000;

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

const handlers = {
    "GET /authorize": async function (request, env, url) {
        const redirect = url.searchParams.get("redirect_uri");
        let togo;
        if (!redirect || !isAllowed(env, redirect)) {
            togo = reply(400, "The page to return to is not one of a site using this service");
        } else {
            const state = await seal(env.SESSION_KEY, {redirect, expires: Date.now() + stateLifetime});
            const github = new URL("https://github.com/login/oauth/authorize");
            github.searchParams.set("client_id", env.CLIENT_ID);
            github.searchParams.set("redirect_uri", url.origin + "/callback");
            github.searchParams.set("state", state);
            togo = Response.redirect(github.toString(), 302);
        }
        return togo;
    },
    "GET /callback": async function (request, env, url) {
        const state = await open(env.SESSION_KEY, url.searchParams.get("state"));
        const code = url.searchParams.get("code");
        let togo;
        if (!state || !code || !isAllowed(env, state.redirect)) {
            togo = reply(400, "Signing in has expired or was not begun here - please return to the site and sign in again");
        } else {
            const response = await fetch("https://github.com/login/oauth/access_token", {
                method: "POST",
                headers: {"Accept": "application/json", "Content-Type": "application/json"},
                body: JSON.stringify({client_id: env.CLIENT_ID, client_secret: env.CLIENT_SECRET, code, redirect_uri: url.origin + "/callback"})
            });
            const result = await response.json();
            if (!result.access_token) {
                togo = reply(502, "GitHub did not grant a token: " + (result.error_description || result.error || response.status));
            } else {
                const session = await seal(env.SESSION_KEY, {token: result.access_token, expires: Date.now() + sessionLifetime});
                // The session joins the page's query, ahead of its hash, which holds the page's own state
                const page = new URL(state.redirect);
                page.searchParams.set("curation_session", session);
                togo = Response.redirect(page.toString(), 302);
            }
        }
        return togo;
    },
    "OPTIONS /token": async function (request, env) {
        const cors = corsHeaders(env, request);
        return cors ? new Response(null, {status: 204, headers: cors}) : reply(403, "Origin not allowed");
    },
    "POST /token": async function (request, env) {
        const cors = corsHeaders(env, request);
        let togo;
        if (!cors) {
            togo = reply(403, {error: "Origin not allowed"});
        } else {
            let body = {};
            try {
                body = await request.json();
            } catch (error) {
                body = {};
            }
            const session = await open(env.SESSION_KEY, body.session);
            togo = session ? reply(200, {token: session.token}, cors) : reply(401, {error: "The session has expired - please sign in again"}, cors);
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
