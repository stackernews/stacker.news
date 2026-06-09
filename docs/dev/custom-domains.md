Lets territory owners attach a domain to their territories.
TODO: change the title

Index:
TODO

# Middleware
Every time we hit a custom domain, our middleware:
- Looks up a cached map of `ACTIVE` custom domains and their `subName`
- Redirects and rewrites URLs to provide a seamless territory-specific SN experience.
##### Main middleware
Referral cookies and security headers are applied as usual ensuring that the same Stacker News functionality are applied to responses returned by `customDomainMiddleware`
##### Custom Domain Middleware
Injects a `x-stacker-news-subname` header into the request, so that we can avoid checking the cached map of domains again on other parts of the code.

Since SN has several paths that depends on the `sub` parameter or the `~subName/` paths, it manipulates the URL to always stay on the right territory:
- Forces the `sub` parameter to match the custom domain's `subName`
- Internally rewrites `/` to `/~subName/`
- Redirects paths that uses `~subName` to `/`

The territory paths are the following:
`['/new', '/top', '/post', '/edit', '/rss']`

Rewriting `~subName` to `/` gives custom domains an **independent-like look**, so that things like `/~subName/post` can now look like `/post`, etc.
# Domain Verification
We use a pgboss job called `domainVerification`, to verify domains, manage AWS integrations and update domain status.
A new job is scheduled 30 seconds after domain creation or `domainVerification` resulting in `PENDING`, including a `singletonKey` to prevent concurrency from other workers.

The Domain Verification Flow is structured this way:
```
domain is PENDING
  0. check if it's PENDING since 48 hours
	  OK: delete the certificate;
	      put the domain on HOLD.
	  KO: proceed

  1. verify DNS CNAME record
      KO: schedule job
      OK: proceed

  IMPLICIT: DNS is OK
  2. Certificate Management
	  KO: critical AWS error, schedule up to 3 retries
          every step can throw an error

        CONDITION: certificate is not issued
        2a. issue certificate
		  OK: proceed

        CONDITION: SSL records are not present
        2b. get SSL validation values
		  OK: schedule job, the user will add the records

        IMPLICIT: certificate is issued, SSL records are present
        2c. check certificate status
		  KO: schedule job
		  OK: update certificate status, proceed

		IMPLICIT: certificate is verified by ACM
		2d. attach certificate to the load balancer listener
		  KO: throw critical AWS error
		  OK: proceed

  IMPLICIT: DNS is OK, certificate is VERIFIED and ATTACHED to the ALB
  3. update domain status to VERIFIED 🎉
```

### DNS Verification
It uses `Resolver` from `node:dns/promises` to fetch CNAME records.

A successful CNAME lookup logs a `DomainVerificationAttempt` with status `VERIFIED`, triggering an update to the corresponding `DomainVerificationRecord` via database triggers.
##### local testing with dnsmasq
In local, **dnsmasq** is used as a DNS server to mock records for the domain verification job.
To have a dedicated IP for the `node:dns` Resolver, the `worker` container is part of a dedicated docker network that gives dnsmasq the `172.30.0.2` IP address.

You can also set your machine's DNS configuration to point to 127.0.0.1:5353 and access custom rules that you might've set. For example, if you have a CNAME record www.pizza.com pointing to `local.sndev`, you can access www.pizza.com from your browser.

For more information on how to add/remove records, take a look at `README.md` on the `Custom domains` section.
### AWS management
AWS operations are handled within the verification job. Each steps logs attempts and allows up to 3 pgboss job retries on critical thrown errors.

- certificate issuance
- certificate validation values
- certificate polling
- certificate attachment to ELB

##### Certificate issuance
After DNS checks, if we don't have a certificate already, we request ACM a new certificate for the domain.
ACM will return a `certificateArn`, which is the unique ID of an ACM certificate, that is immediately used to check its status. These informations are then stored in the `DomainCertificate` table.

note: we provide an `IdempotencyToken` to AWS ACM in order to avoid creating new certificates for the same domain within 1 hour.

##### Certificate validation values
ACM needs to verify domain ownership in order to validate the certificate, in this case we use the DNS method.

We ask ACM for the DNS records so that we can store them as a `DomainVerificationRecord` and present them to the user. Finally, we re-schedule the job so that the user can adjust their DNS configuration.

##### Certificate validation and status polling
We asked ACM for a certificate, got its validation values and presented them to the user. Now we need to poll ACM to know if the verification was successful.

Since we're directly checking the certificate status, we also update `DomainCertificate` on our DB with the new status.

AWS validation timings are unpredictable, if the verification returns a negative result, we re-schedule the job to repeat this step.

##### Certificate attachment to the ALB listener
This is the last step regarding AWS in our domain verification job, it attaches a completely verified ACM certificate to our load balancer listener.

The ALB listener is the gatekeeper of the application load balancer (ALB), it determines how incoming requests should be routed to the target server.

In the case of Stacker News, the domain points directly to the load balancer listener, this means that we can both direct the user to point their `CNAME` record to `stacker.news` and we can serve their ACM certificate directly from the load balancer.

### Error handling
Every AWS or DNS step is wrapped in try/catch:
If something throws an error, we catch it to log the attempt and then re-throw it to let pgboss retry up to 3 times.

Using the `jobId` that we pass with each job, we can know if we're reaching 3 retries using pgboss' `getJobById`. And if we did reach 3 retries, we put the domain on `HOLD`, stopping and deleting future jobs tied to this domain.

### End of the job
When we finish a step in the domain verification job, and the resulting status is still `PENDING`, we re-schedule a job using `sendDebounced` by pgboss.

Since we use a `singletonKey` to avoid same-domain concurrent jobs, and you can't schedule another job if one is already running, `sendDebounced` will try to schedule a job when it can, e.g. when the job finishes or after 30 seconds.

### Domain Verification logger
We need to be able to track where, when and what went wrong during domain verification. To do this, every step of the job calls `logAttempt`
##### logAttempt
This is a simple function that logs a message returned by a domain verification step in the DB.
Some steps, like DNS and SSL verification, calls `logAttempt` by also passing the interested record in `DomainVerificationRecord`, triggering a synchronization of `status` by the result of a step.

# AWS
### ACM certificates
We don't expect territory owners to set up their own SSL certificates but we expect their custom domain to have SSL to reach Stacker News.
With ACM we can request a certificate for a domain and serve it via the Application Load Balancer, effectively giving the custom domain a SSL certificate.

The implemented functions are non-destructive to the original Stacker News configuration:
- Request Certificate
- Describe Certificate
- Get Certificate Status
- Delete Certificate

We request a certificate intentionally asking for DNS validation as it's the most reliable method of verification, and also fits nicely with the CNAME record we ask the user to insert in their DNS configuration.

Describe Certificate is crucial to get SSL validation values that the user needs to put in their domain's DNS configuration; also to get the **status** of a certificate.

We can only delete a certificate if we have the `certificateArn` (unique ID). In fact, when a domain gets deleted, we trigger a job that takes the `certificateArn` as parameter before we lose it forever, trying up to 3 times if ACM gives an error.

In local, Localstack provides bare-minimum ACM operations and OK responses.

### AWS Application Load Balancer
The Application Load Balancer distributes the incoming requests across Stacker News servers. We can attach up to **25** ACM certificates (per default quota).

After creating and verifying an ACM certificate, the next step is to attach this certificate to our ALB Listener, so that the load balancer can serve the right certificate for the right domain.

Since in local we don't have the possibility to use Localstack to mock the ALB, there's a new class called `MockELBv2`: it provides bare minimum response mocks for attach/detach operations.

As the ALB is really important to reach stacker.news, we only implemented Attach/Detach certificate functions that takes a specific `certificateArn` (unique ID). This way we can't possibly mess with the default ALB configuration.

# Triggers, cleanup and maintenance
### Clear Long Held Domains
Every midnight, the `clearLongHeldDomains` job gets executed to remove domains that have been on `HOLD` for more than 30 days.

A domain removal also means the certificate removal, which triggers **Ask ACM to delete certificate**.

### Active Domain DNS Drift Check
A pgboss cron `checkActiveDomainsDNS` runs every 5 minutes (`*/5 * * * *`) and, for each `ACTIVE` domain:
- re-resolves the stored `CNAME` `DomainVerificationRecord` against live DNS via the same `verifyDNSRecord` helper used during initial verification
- on a **conclusive drift** (record present but pointing elsewhere, wrong record count, or `ENOTFOUND` / `ENODATA` from the resolver), flips the domain to `HOLD`
- on an **inconclusive result** (timeout, `ESERVFAIL`, network error, unknown error code, …), logs and skips. a real persistent drift will surface as a conclusive answer on the next tick

Switching to `HOLD` cascades into:
1. **Bump token version**, a db trigger on `Domain` increments `tokenVersion` whenever the domain switches from or to `ACTIVE`. [see token revocation via `tokenVersion`](#token-revocation-via-tokenversion).
2. **Delete cert + verification records**
3. **Ask ACM to delete certificate**, chained from the cert deletion

The territory owner can re-verify and the domain returns to `ACTIVE`, but with a higher `tokenVersion` than any token issued before the drift.

### Update `DomainVerificationRecord` status
The `DomainVerification` job logs every step into `DomainVerificationAttempt`, when it comes to steps that involves DNS records like the `CNAME` record or ACM validation records, a connection between `DomainVerificationAttempt` and `DomainVerificationRecord` gets established.

If the result of a DNS verification on the `CNAME` record is `VERIFIED`, it triggers a field `status` update to the related `DomainVerificationRecord`, keeping the record **statuses** in sync with the `DomainVerification` job results.

### HOLD domain on territory STOP
When a domain enters `HOLD` the `delete_certificate_and_verification_records_on_domain_hold` trigger deletes the associated `DomainCertificate` (which cascades into `ask_acm_to_delete_certificate` and removes the cert from ACM + ALB) and all `DomainVerificationRecord` rows tied to that domain.

If the territory owner comes back and renews, they have to repeat the Domain Verification process from scratch: a new ACM certificate is issued, new SSL validation values are generated and presented to the user, and the user must publish a fresh SSL `CNAME` before ACM can validate. Only the `subName` binding and the user's own `CNAME` to `stacker.news` (which lives in the user's DNS, not in our DB) survive across the HOLD.

### Clear domain on territory takeover
If a new territory owner comes up, we delete every trace of the custom domain. This also deletes its certificates, verification attempts, DNS records and customizations.

The main reason is safety: as we don't delete this stuff when a territory gets stopped, in hope that the original territory owner renews it, it's best to delete everything - above all, validation values. This will also trigger **Ask ACM to delete certificate**.

### Ask ACM to delete certificate
Whenever a domain or domain certificate gets deleted, we run a job called `deleteCertificateExternal`.
It detaches the ACM certificate from our ALB listener and then deletes the ACM certificate from ACM.

It's a necessary step to ensure that we don't waste AWS resources and also provide safety regarding the custom domain access to Stacker News.

# Auth Sync

Cross-domain JWT authentication is a browser boundary problem: the main SN session cookie cannot be read or set by an `ACTIVE` custom domain. The flow uses a short-lived verifier/challenge pair, a one-time DB code, and a domain-bound JWT.

### Custom domain login flow

1. The user opens `/login` or `/signup` on an `ACTIVE` custom domain.
2. `proxy.js` mints a 32-byte hex verifier, stores it in the httpOnly `domains_auth_verifier` cookie on the custom domain, derives `challenge = sha256(verifier)`, then redirects to `/api/auth/domains/begin` on the custom domain with `domain`, `challenge`, `callbackUrl`, and optional `multiAuth`.
3. `begin.js` checks the domain is active, checks the challenge matches the custom-domain verifier cookie, normalizes the final redirect to a safe path, then redirects to main-domain `/login` or `/signup`. The main-domain `callbackUrl` becomes `/api/auth/domains/code?domain=...&challenge=...&redirectUri=...`.
4. After main-domain auth succeeds, NextAuth calls `/api/auth/domains/code` on the main domain. `code.js` requires an active domain and a main-domain session, creates a random one-time `DomainAuthRequest` code tied to `{ userId, domainId, challenge }`, expiring after 5 minutes, then redirects back to the custom domain `/api/auth/domains/verify`.
5. `verify.js` runs on the custom domain, reads the verifier cookie, posts `{ code, domainName, verifier }` to main-domain `/api/auth/domains/token`, then sets the returned JWT as the custom-domain session cookie. It also mirrors multi-auth cookies with the domain-bound JWT.
6. `token.js` derives the challenge from the verifier, locks the `Domain` row, requires the domain to still be `ACTIVE`, checks the code, challenge, domain, and expiry, deletes the code, then returns a JWT carrying `domainName`, `domainId`, and `tokenVersion`.

### Attack scenario: leaked code replay

An attacker gets a `/api/auth/domains/verify?code=...` URL from browser history, logs, or a copied redirect. They POST that code to `/api/auth/domains/token` from their own client. The exchange fails unless they also have the custom-domain httpOnly verifier cookie whose hash matches the stored challenge. Even with the verifier, the code is single-use, expires after 5 minutes, and is bound to the original active `Domain` row.

### Redirect callback allowlist

NextAuth still owns the final `callbackUrl` redirect after login. [pages/api/auth/[...nextauth].js](../../pages/api/auth/[...nextauth].js)'s `redirect` callback allows:

- relative paths like `/settings` resolve against `baseUrl`, which is the main SN origin for the login flow
- absolute same-origin URLs are allowed unchanged
- absolute URLs on an `ACTIVE` custom domain are allowed unchanged after the host is parsed with `parseSafeHost` and checked with `getDomainMapping`

Everything else falls back to `baseUrl`.

### Token revocation via `domainId` + `tokenVersion`

JWTs are stateless, so once a session cookie has been set on `pizza.com` we cannot un-issue it: the cookie remains valid in every browser that ever signed in until it expires (30 days by default). That is a problem the moment we suspect the domain itself is no longer trustworthy.

Every custom-domain JWT carries two claims that together make it revocable without abandoning the JWT model:

- **`domainId`**, the primary key of the `Domain` row the token was minted against. Pins the JWT to a specific *row lifetime*. If the row is deleted and recreated (owner removes and re-adds the domain, takeover, etc.), the replacement row has a fresh autoincrement `id` that no pre-existing JWT can reference.
- **`tokenVersion`**, this is the value of `Domain.tokenVersion` when the JWT was created. If the domain leaves and later returns to `ACTIVE`, `tokenVersion` increases. Old JWTs with a different version become invalid.

A `BEFORE UPDATE` trigger on `Domain` (`bump_domain_token_version`) increments `tokenVersion` on **any transition to/from `ACTIVE`**. The trigger alone can't help across row lifetimes, which is exactly why `domainId` exists.

##### Where `domainId` and `tokenVersion` are read

Two sides read these, with different consistency requirements:

- **Mint side**, `consumeVerificationCode` and `createSessionToken` in [pages/api/auth/domains/token.js](../../pages/api/auth/domains/token.js) read and lock the `Domain` row **directly from the DB** before snapshotting both `id` and `tokenVersion` into the JWT. Since the minted cookie lives for up to 30 days, any staleness here could mint a token against an outdated row identity or revoked reign.
- **Verify side**, the next-auth `jwt` callback reads through `getDomainMapping`, which goes through `domainsMappingsCache` (same cache the proxy uses). This runs on every custom-domain request, so hitting the DB here would be expensive. Bounded staleness is acceptable because the mint side already guarantees that no *new* tokens can be minted with the old identity, the stale window only delays the rejection of pre-existing tokens.

##### Enforcement

The check happens once per request, in [pages/api/auth/[...nextauth].js](../../pages/api/auth/[...nextauth].js)'s `jwt` callback, after the existing same-domain check:

```js
if (token?.domainName) {
  // ... same-domain check ...

  const mapping = await getDomainMapping(token.domainName)
  if (!mapping) return null                                      // domain is not ACTIVE right now
  if (mapping.id !== token.domainId) return null                 // row was deleted and recreated
  if (mapping.tokenVersion !== token.tokenVersion) return null  // ACTIVE reign has changed
}
```

`getDomainMapping` reads from `domainsMappingsCache` (the same cache the proxy uses). Both SSR (`getServerSession`) and `/api/graphql` go through `getAuthOptions` -> this callback.

##### Why all three checks?

They cover different failure modes:
- `!mapping`, the domain is not `ACTIVE` **right now** (on HOLD, deleted, unknown).
- `mapping.id !== token.domainId`, the row was deleted and recreated since the token was minted. A fresh row always has a strictly greater autoincrement `id`, so old tokens can never match the new row regardless of what `tokenVersion` happens to land on.
- `mapping.tokenVersion !== token.tokenVersion`, the domain has crossed the `ACTIVE` boundary at least once since the token was minted, within the same row lifetime.

##### an attack scenario, prevented

Two variants worth walking through, since they exercise different parts of the defense.

**Variant A, DNS drift within a single row lifetime** (caught by `tokenVersion`):

1. `pizza.com` is `ACTIVE` with `tokenVersion=3`. Alice signs in and gets a JWT carrying `{ domainName: 'pizza.com', domainId: 42, tokenVersion: 3 }`.
2. The attacker hijacks DNS for `pizza.com` and exfiltrates her cookie.
3. Within ~5 minutes, `checkActiveDomainsDNS` notices the CNAME no longer matches and switches the domain to `HOLD`. The `ACTIVE -> HOLD` trigger bumps `tokenVersion` to `4`, and the on-HOLD trigger deletes the certificate and verification records.
4. Next request from Alice's browser **or** the attacker's stolen cookie, once the verifier's cache refreshes past the bump: `!mapping` is true -> the request is rejected and the user is `anon`.
5. The territory owner notices, fixes DNS, re-verifies. The domain goes back through `PENDING` and the `PENDING -> ACTIVE` trigger bumps `tokenVersion` again, to `5`.
6. The domain is `ACTIVE` again, so `!mapping` passes and `domainId` still matches (the row was updated, not recreated). **But** the cached `tokenVersion` is `5` while the JWT snapshots `3`, so the version check rejects them: `5 !== 3` -> both have to sign in again.

**Variant B, owner removes and re-adds the domain** (caught by `domainId`):

1. `pizza.com` is `ACTIVE`, row `id=42`, `tokenVersion=1`. Alice signs in and gets a JWT carrying `{ domainName: 'pizza.com', domainId: 42, tokenVersion: 1 }`. The attacker steals her cookie and keeps it warm (actively replaying so it gets re-encoded with the default 30-day session maxAge).
2. The owner calls `setDomain(subName, null)`, which hard-deletes row `id=42` (cascading into cert cleanup). Alice's and the attacker's cookies start failing the `!mapping` check.
3. Weeks later, the owner re-adds `pizza.com`. A fresh row is created, `id=43`, `tokenVersion` defaulted to `0`.
4. Verification succeeds, the `PENDING -> ACTIVE` trigger bumps `tokenVersion` to `1`.
5. The attacker tries their stolen cookie again. The domain is `ACTIVE` (so `!mapping` passes) and the new `tokenVersion=1` happens to collide with the stolen JWT's `tokenVersion=1`. Without `domainId`, **this would resurrect the stolen token**. With `domainId` in place: `mapping.id` is `43`, the JWT claims `42`, `43 !== 42` -> rejected.

# Local dev: end-to-end HTTPS

Custom domains in production sit behind the AWS ALB, which terminates HTTPS
using ACM-issued certs and forwards plain HTTP to the app. The dev environment
mirrors that with a `caddy` container in the `domains-caddy` compose profile that
reverse-proxies `:80` and `:443` on the host into `app:3000`.

This matters for QA because browsers only treat HTTPS (and `localhost`) as
[secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).
On a plain-HTTP custom-domain origin like `http://www.foo.sndev`, anything
that depends on `window.crypto.subtle` (the wallet vault key derivation) or on
`Secure` cookies will silently degrade or break in dev — but work fine in prod
behind the ALB. Running through Caddy closes that gap.

`domains` and `domains-caddy` are separate profiles: keep `domains` enabled for
dnsmasq and custom-domain worker jobs, and enable `domains-caddy` only when you
want the bundled local HTTPS proxy. If your dev environment already sits behind
another TLS-terminating load balancer (for example one that enforces mTLS), omit
`domains-caddy` and have that load balancer forward `X-Forwarded-Proto: https`
to the app so dev `Secure` cookies follow the browser-facing protocol.

#### Setup

1. Make sure nothing else is using host ports 80 and 443 (a local nginx /
   Apache / Caddy will conflict). Stop them before starting the dev env.
2. Start the env with the `domains` and `domains-caddy` profiles enabled (both
   are already part of the default `COMPOSE_PROFILES` if you've been working
   on custom domains):
   ```sh
   ./sndev start
   ```
3. Resolve your test domain to `127.0.0.1`. Either:
   - add it to `/etc/hosts`, e.g. `127.0.0.1 www.foo.sndev`, or
   - use the dnsmasq flow: `./sndev domains dns add cname www.foo.sndev sn.sndev`
     (`*.sndev` already resolves to `127.0.0.1` via dnsmasq).
4. **One-time:** install Caddy's local root CA into the host trust store so
   browsers trust the auto-generated certs:
   ```sh
   ./sndev domains trust
   ```
   This shells out to `security add-trusted-cert` on macOS or
   `update-ca-certificates` on Linux (both require sudo). Restart Chrome /
   Safari to pick up the new root. Firefox uses its own NSS trust store —
   import the cert manually via Settings if you use Firefox.
5. Open `https://www.foo.sndev` (or whatever domain you set up). Real
   green-padlock HTTPS, `crypto.subtle` defined, HMR over `wss://`, secure
   cookies, the works.

`./sndev domains trust` is idempotent and persists in the `caddy_data` named
volume across container restarts; you don't need to re-run it after
`./sndev restart` or `./sndev stop`.

#### Caveats

- The Caddy local CA is **only** trusted on the machine that ran
  `./sndev domains trust`. Other devices on your network won't trust it.
- `./sndev delete` (which wipes volumes) destroys the Caddy CA. The next
  `./sndev domains trust` will install a fresh one; you'll want to remove the
  old one from your trust store first to avoid clutter.
- The `customDomainSchema` requires ≥3 labels (`www.foo.sndev`), so 2-label
  test names like `aaa.test` won't pass `setDomain` validation — use
  `www.aaa.test` or similar.
