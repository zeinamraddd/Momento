# MOMENTO - Security Audit and Verification

**Project:** MOMENTO, a collaborative scrapbook application  
**Stack:** React + Vite, Node.js + Express, MongoDB Atlas  
**Reference:** USJ Web Development, Session 21 - *Security & Best Practices*  
**Prepared:** 19 November 2026  
**Status:** Local manual evidence collected and 42 automated backend tests passed;
manual non-member denial screenshot and production checks remain pending

> This document describes the implementation visible in the MOMENTO source
> snapshot reviewed on 19 November 2026. It distinguishes **source-code
> inspection**, **automated test coverage**, **observed local manual results**,
> and **tests still pending**. Screenshots substantiate only the responses and
> visible behavior they show; they do not by themselves prove a full security
> assessment or production readiness.

## 1. Security decisions and threat model

MOMENTO stores personal memories, photographs, shared group content, and user
accounts. The main risks are unauthorized data access, account compromise,
malicious input, unwanted cross-origin requests, and exposed credentials.

**Authentication:** MOMENTO uses `express-session` and a MongoDB-backed session
store. The professor has confirmed that Express sessions are acceptable in
place of the JWT example shown in the lecture. Browser session cookies are
`HttpOnly`, use `SameSite=Lax` in the standard deployment, and are marked
`Secure` when running in production. Authentication is checked server-side.

**Collaboration rules:** Members can access shared resources only within
spaces they belong to. Members are deliberately allowed to edit or delete
other members' Lore Cards within their own shared space; this is an approved
collaboration rule, not an ownership defect. Outsiders must never be allowed
to access another space's data. Any group member may rename the space, with the
rename UI available on the Home page.

**Scope:** All testing described here is for the team's own local development
server and throwaway test accounts/spaces. Do not run attack simulations
against classmates' accounts or production services without authorization.

## 2. Lecture 21 control checklist

| Topic | MOMENTO's implementation | Verification state |
| --- | --- | --- |
| XSS | React JSX escapes displayed strings; user names interpolated into welcome emails are HTML-escaped. | Literal attack string visibly rendered on Lore page; no alert shown in screenshot; wider tests pending |
| NoSQL injection | Zod validates auth/account/space inputs; `mongoose.set('sanitizeFilter', true)` is enabled. Other routes validate fields explicitly. | Local operator-object login rejected with HTTP 400 |
| CSRF | `requireTrustedOrigin` checks write-request origins; session cookies use `SameSite` protections. | Automated coverage plus local malicious-Origin request rejected with HTTP 403 |
| Validate / sanitize | Zod `safeParse` returns HTTP 400 and strips undeclared fields; other API routes enforce length/type limits. | Wrong-type login rejected; account mass-assignment probe did not change protected fields in API response; broader coverage pending |
| Authorization / IDOR | `requireAuth` checks sessions; space-aware routes verify membership and scope database queries by `spaceId`. | Automated non-member denial tests passed for Albums, Scrapbooks, and Lore; a separate manual non-member Postman screenshot is **not yet captured** |
| HTTPS | Production requires HTTPS `CLIENT_ORIGIN`; session cookies are secure in production. | Production deployment not yet tested |
| Security headers | Helmet is loaded before API routes; `X-Powered-By` disabled. | Local health response inspected: CSP, `nosniff`, `SAMEORIGIN` present; no `X-Powered-By` visible |
| Secrets | `.env` is ignored; `.env.example` files are provided; startup validates `MONGODB_URI` and `SESSION_SECRET`. | Working-tree ignore rules and named-path Git history checked; no matching tracked/history entries shown |
| Rate limits | General `/api`: 300 requests/15 minutes; login, signup, forgot/reset password: 5 attempts/15 minutes. | Local login endpoint returned HTTP 429 with retry message |
| Request limits | Standard JSON: 10 KB; scrapbook JSON: 256 KB; photo upload: 8 MB and image-content validation. | Source reviewed and scrapbook payload-value validation tested; HTTP body-size/upload boundary tests pending |
| Passwords | `bcrypt` hashes passwords; password reset uses single-use, hashed, expiring tokens and invalidates old sessions. | Automated password-reset tests passed |

**Notable implementation files**

- `server/server.js` - middleware order, security headers, CORS, body limits,
  sessions, rate limits, database connection.
- `server/middleware/security.js` - origin checks and startup secret validation.
- `server/middleware/validate.js` - request-body schemas using Zod.
- `server/middleware/requireAuth.js` - active-session and user validation.
- `server/routes/authRoutes.js` - login, logout, registration, password reset.
- `server/routes/spaceRoutes.js` - space membership, group ownership, rename.
- `server/routes/albumRoutes.js` and `server/routes/scrapbookRoutes.js` -
  space/album/photo access checks.
- `server/routes/loreRoutes.js` - authenticated, space-scoped collaborative Lore.

## 3. Security lab: attack / expected defense / evidence

For each case, see the **actual** response or remaining evidence gap in Section 4. Requests should
be sent with Postman to `http://localhost:3000` while the React app and Express
server are running locally. Use separate, consenting test users **Alice**
(inside the group) and **Bob** (outside the group), except where noted.
Authenticate normally to obtain the test users' session cookies. Do not save
real passwords, full session cookies, password-reset tokens, or SMTP keys in
this document or screenshots.

### Test A - Cross-space access (IDOR / authorization)

**Attempt:** Sign in as Bob, who has not joined Alice's group, and request:

```http
GET /api/spaces/<alice-space-id>/albums HTTP/1.1
Host: localhost:3000
Cookie: momento.sid=<BOB_TEST_SESSION_REDACTED>
```

**Expected defense:** `404 Not Found` (or equivalent access-denied response)
without disclosing Alice's album data. For a request without a valid session,
expect `401 Unauthorized`.

**Why:** The route authenticates the requester and checks space membership,
not just a user-supplied space ID. The corresponding automated Album route
test verifies that non-members cannot list, create, change, delete, or
download another group's albums.

### Test B - Mass assignment and input validation

**Attempt:** As Alice, create a test space while trying to forge ownership:

```http
POST /api/spaces HTTP/1.1
Origin: http://localhost:5173
Content-Type: application/json
Cookie: momento.sid=<ALICE_TEST_SESSION_REDACTED>

{
  "name": "Security Test Space",
  "ownerId": "someone-else",
  "role": "admin"
}
```

**Expected defense:** The request may succeed with `201 Created`, but the
created space's owner must be the signed-in Alice; `ownerId` and `role` from
the request must not be accepted. A blank name or non-string name should
return `400 Bad Request`.

**Why:** Zod removes undeclared fields and the server assigns the owner from
`req.user._id`. Delete the throwaway space through the app if desired.

**Variation actually captured:** A signed-in user sent `PATCH /api/account`
with an attempted email change and undeclared `role: "admin"` and
`isAdmin: true` fields. The response returned `200 OK` and the previously
registered email; a follow-up `GET /api/account` also retained that email.
Neither privilege field was returned. This documents rejection/ignoring of
these attempted account fields, **not** completion of the separate space-owner
forgery case above.

### Test C - NoSQL operator injection

**Attempt:** Send an object instead of an email string to the login endpoint:

```http
POST /api/auth/login HTTP/1.1
Origin: http://localhost:5173
Content-Type: application/json

{ "email": { "$ne": null }, "password": "incorrect" }
```

**Expected defense:** `400 Bad Request`; the input should fail Zod validation
before a database query is made. The server also has Mongoose query-filter
sanitization as a backstop.

### Test D - Cross-site request forgery (CSRF)

**Attempt:** Simulate a write coming from an unrelated website:

```http
POST /api/spaces HTTP/1.1
Origin: https://evil.example
Content-Type: application/json
Cookie: momento.sid=<TEST_SESSION_REDACTED>

{ "name": "Unwanted Space" }
```

**Expected defense:** `403 Forbidden`, with the message
`Cross-site request blocked`. The request should be rejected before it
modifies data. Do not send the attack to any real `evil.example` service;
it is simply a fictional Origin header in a local Postman request.

### Test E - Cross-site scripting (XSS)

**Attempt:** Create a Lore Card in a test space with this harmless, visibly
recognizable string as the title (or as a version's content):

```text
<img src=x onerror=alert(1)>
```

**Expected defense:** The text appears as ordinary characters in the React
page; no alert should run and no HTML image element should be created from
the user data. Check the browser console and remove the test card afterward.

**Why:** React JSX interpolates strings as text, not as executable HTML.

### Test F - Brute-force login protection

**Attempt:** From one local test IP, send more than five failed login requests
within 15 minutes, using a throwaway account. Run this test **last**, because
rate limiting may temporarily block normal login tests from that IP.

**Expected defense:** Later attempts receive `429 Too Many Requests` rather
than unlimited password guesses. This is an IP-based guard; it does not by
itself prove full account-lockout protection.

### Test G - Security response headers

**Attempt:** In PowerShell, request headers from the local API:

```powershell
curl.exe -I http://localhost:3000/api/health
```

**Expected defense:** Look for `Content-Security-Policy` and
`X-Content-Type-Options: nosniff`; there should be no `X-Powered-By` header.
Check `Strict-Transport-Security` only once the app is deployed behind HTTPS,
not as a required result on localhost.

### Test H - Secrets and Git hygiene

**Attempt:** From the MOMENTO repository root in PowerShell, check which
environment files are tracked and whether Git ignores your current `.env`:

```powershell
git ls-files -- .env server/.env client/.env
git check-ignore -v -- .env server/.env client/.env
git log --all --oneline -- .env server/.env client/.env
```

**Expected defense:** The first command prints no tracked secret files;
the second points to `.gitignore` rules; the third finds no commits touching
those named paths. This is only a named-file history check, not a full
credential scan. **Never paste actual secret values into reports or chats.** If an
actual credential was committed at any point, rotate it immediately.

## 4. Evidence register - observed local results (19 November 2026)

The user supplied the named screenshots from Postman, the React website, and
PowerShell. The filenames below identify the original captures **for private
review only**; raw screenshots are deliberately **not embedded** in this
document or committed to the repository because some contain account emails,
database IDs, or portions of session/device cookies. Redact/crop those details
before sharing the images with classmates, instructors, or on GitHub.

| Test | Date and environment | Actual status / observed behavior | Screenshot / test reference | Result |
| --- | --- | --- | --- | --- |
| A - Cross-space IDOR | Local Postman, 19 Nov | An authenticated `GET /api/spaces/<id>` returned **200** and an album list. No screenshot establishes that a *non-member* received `404`/`403`. Separate automated Album, Scrapbook, and Lore tests reject non-members. | `test 5.png`; `server/tests/{albumRoutes,scrapbookRoutes,loreRoutes}.test.js` | **Automated checks passed; manual negative case incomplete** |
| B - Mass assignment | Local Postman, 19 Nov | `PATCH /api/account` with attempted email, `role`, and `isAdmin` changes returned **200**; response and follow-up **200** account fetch retained the original email, with no role/isAdmin fields in returned user. Space-owner variant not captured. | `test 4(1).png` (payload + response); `test 4 2(1).png`; `test 4 3.png` | **Passed for account-field attempt;** space-owner variant pending |
| C - NoSQL injection | Local Postman, 19 Nov | Login `email: {"$ne": null}` returned **400 Bad Request**, `Invalid input: expected string, received object`. | `test1.png` | **Passed** |
| D - CSRF | Local Postman, 19 Nov | `POST /api/spaces` with `Origin: https://evil.example` returned **403 Forbidden**, `Cross-site request blocked`. | `test2 2.png` (Origin header); `test2.png` (response) | **Passed** |
| E - XSS | Local browser, 19 Nov | Lore Card displayed `<img src=x onerror=alert(1)>` as literal text. No alert box appears in the captured browser view; DOM/console inspection was not captured. | `test 6.png` | **Passed visible rendering check;** deeper XSS checks pending |
| F - Brute-force throttling | Local Postman, 19 Nov | Login endpoint returned **429 Too Many Requests**, `Too many attempts. Try again in 15 minutes.` The number and order of preceding attempts were not captured. | `test 9.png` | **Passed threshold-response check** |
| G - Security headers | Local PowerShell, 19 Nov | `curl.exe -I /api/health` returned **200** with CSP, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`; `X-Powered-By` is absent from the shown output. | `test 7.png` | **Passed local header check** |
| H - Secrets / Git hygiene | Local PowerShell, 19 Nov | `git ls-files` on the three `.env` paths and `git log --all --oneline --` those paths showed no entries; `git check-ignore -v` linked each to `.gitignore`. Not a scan of every possible secret or file. | `test 8.png` | **Passed named-file checks** |

**Supporting authentication evidence:** `test3.png` shows a successful
`POST /api/auth/login` (**200**), and `test 3 2.png` shows an authenticated
`GET /api/auth/me` (**200**). These establish that an authenticated session
worked during testing, but do not independently prove session fixation,
cookie-flag configuration, logout invalidation, or non-member authorization.

**Manual evidence still needed for Test A:** Authenticate as a different test user
who is *not* a member of the chosen space. Request that space's ID, or
`GET /api/spaces/<space-id>/albums` if that route is available in the checked
version. Capture the endpoint, authenticated test-user context (without
exposing credentials), denial status, and response without album data. A
`200` response from a legitimate member is the positive control, not the
negative authorization test. The automated non-member denials provide
independent regression coverage but do not replace the requested Postman capture.

### Lecture lab's before / fix / after comparison

The hardening work already exists in the current snapshot. **Historic
"before" attack responses were not captured here and must not be fabricated.**
If the instructor requires demonstrations of holes that previously existed,
recover the earlier implementation from Git history, inspect the diff, and
work only with isolated dummy data in a disposable local environment.

| Issue | Before-hardening evidence | Implemented fix | After-hardening evidence |
| --- | --- | --- | --- |
| Forged cross-origin write | Historical result not recorded | `requireTrustedOrigin` and SameSite session cookies | **403** observed (`test2.png`) |
| Wrong-type / injection input | Historical result not recorded | Zod schema validation plus Mongoose `sanitizeFilter` | **400** observed (`test1.png`) |
| Excessive login attempts | Historical result not recorded | `express-rate-limit` on authentication routes | **429** observed (`test 9.png`) |
| Cross-space IDOR | Historical result not recorded | Authentication and space-membership query scoping | Automated non-member denials **passed**; manual negative-response screenshot **not yet captured** |

## 5. Automated regression testing

**Verified result (19 November 2026):** `npm test` completed **42 tests passed,
0 failed, 0 skipped** in the backend test snapshot. These include the 21
Phase 3 Album, Scrapbook, and Lore route tests that were previously planned.

The repository contains Node test suites under `server/tests`:

- `security.test.js` - cross-origin write rejection and startup secret checks.
- `passwordReset.test.js` - request validation, token consumption, session invalidation.
- `authNotifications.test.js` - welcome/login notifications and remembered browsers.
- `accountRoutes.test.js` - profile and avatar privacy.
- `spaceRoutes.test.js` - memberships, invitation codes, group rename permissions.
- `albumRoutes.test.js` - six tests for authentication, non-member access,
  album creation and editing, input validation, and cross-space ID handling.
- `scrapbookRoutes.test.js` - seven tests for membership and photo ownership,
  transformed page persistence, invalid sticker/tape inputs, and `409`
  revision-conflict protection.
- `loreRoutes.test.js` - eight tests for membership, input validation,
  cross-space card denial, group-member editing, author-only alternate
  versions, and reaction behavior.

Run from the MOMENTO root:

```powershell
cd server
npm test
```

Frontend scrapbook transformation math also has standalone tests:

```powershell
cd client
node --test src/utils/scrapbookGeometry.test.js
npm run build
```

**Coverage interpretation:** The automated suite tests cross-space boundaries,
malformed route payloads, and the intended Lore collaboration rules. The
observed `429` rate-limit response is separately documented in Section 4;
there is not yet a dedicated automated login-throttling threshold test in the
listed suite. Production smoke checks and certain request-size boundaries
remain pending.

## 6. Production release checklist

- [ ] Use HTTPS for the public frontend and backend URLs.
- [ ] Configure a strong random `SESSION_SECRET` through the host's settings.
- [ ] Set `MONGODB_URI`, `CLIENT_ORIGIN`, and SMTP credentials on the host;
      never commit actual values.
- [ ] Review cross-site cookie settings if frontend and backend use separate
      sites; verify that origin checks still admit only the real frontend.
- [ ] Verify Helmet headers, session cookies, and logout in the deployed app.
- [ ] Confirm non-members cannot read private images, albums, or Lore Cards.
- [ ] Ensure all automated tests pass after deployment configuration changes.
- [ ] Prepare shareable, redacted screenshots for at least three lecture-style
      attack cases. The evidence register above already records the results,
      but the original captures contain private account/session details.

---

**Summary:** MOMENTO implements the core security concepts in Session 21 with
an Express-session design approved by the professor. Local screenshot evidence
now supports the NoSQL-input, cross-origin write, account-field, XSS-rendering,
login-throttling, header, and named `.env` checks described above. All 42
automated backend tests passed, including non-member checks for Albums,
Scrapbooks, and Lore. A *manual* negative cross-space authorization screenshot,
some boundary testing, and production deployment checks remain **unverified**.
This report does not claim that all attack simulations or security requirements
have passed.
