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
