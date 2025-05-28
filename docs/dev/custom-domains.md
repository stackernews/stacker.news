# The Hitchhiker's Guide to Custom Domains
Lets territory owners attach a domain to their territories.
TODO: change the title

Index:
TODO

# Middleware
Every time we hit a custom domain, middleware checks if it's allowed via a cached list of `ACTIVE` domains, coupled with their `subName`.
If it's allowed, we redirect and rewrite to give custom domains a seamless territory-centered SN experience.
##### Main middleware
Referral cookies and security headers gets applied the same way as before on SN, with the exception of being their own functions, so that now we can apply them also to the customDomainMiddleware resulting response.
##### customDomainMiddleware
A `x-stacker-news-subname` header with the `subName` is injected into the request headers to give the SN code awareness of the territory attached to a custom domain.

Since SN has several paths that depends on the `sub` parameter or the `~subName/` paths, it manipulates the URL to always stay on the right territory:
- It forces the `sub` parameter to match the custom domain's `subName`
- Rewrites `/` to `~subName/`
- Redirects paths that uses `~subName` to `/`

The territory paths are the following:
`['/~', '/recent', '/random', '/top', '/post', '/edit']`

Rewriting `~subName` to `/` gives custom domains an **independent-like look**, so that things like `/~subName/post` can now look like `/post`, etc.
# Domain Verification
Domain Verification is a pgboss Job that checks correct DNS values and handles AWS external requests.

On domain creation, we schedule a job that starts in 30 seconds sending also the domain ID, and a `singletonKey` that protects this job from being ran from other workers, avoiding concurrency issues.

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
It uses the `Resolver` class from `node:dns/promises` to resolve CNAME records on a domain.

If the CNAME record is correct, it logs a `DomainVerificationAttempt` tied with the `DomainVerificationRecord`, having status `VERIFIED`. This resulting status is shared with the connected `DomainVerificationRecord` thanks to a trigger.
##### dnsmasq
In local, **dnsmasq** is used as a DNS server to mock records for the domain verification job.
To have a dedicated IP for the `node:dns` Resolver, the `worker` container is part of a dedicated docker network that gives dnsmasq the `172.30.0.2` IP address.

You can also set your machine's DNS configuration to point to 127.0.0.1:5353 and access custom rules that you might've set. For example, if you have a CNAME record www.pizza.com pointing to `local.sndev`, you can access www.pizza.com from your browser.

For more information on how to add/remove records, take a look at `README.md` on the `Custom domains` section.
### AWS management
The domain verification job also handles critical AWS operations, such as:
- certificate issuance
- certificate validation values
- certificate polling
- certificate attachment to ELB

##### Certificate issuance
After DNS checks, if we don't have a certificate already, we request ACM a new certificate for the domain.
ACM will return a `certificateArn`, which is the unique ID of an ACM certificate, that is immediately used to check its status. These informations are then stored in the `DomainCertificate` table.

If we couldn't request a certificate, check its status or store it in the DB, it throws an error so that pgboss can retry the job.

##### Certificate validation values
ACM needs to verify domain ownership in order to validate the certificate, in this case we use the DNS method.

We ask ACM for the DNS records so that we can store them as a `DomainVerificationRecord` and present them to the user. Finally, we re-schedule the job so that the user can adjust their DNS configuration.

If we couldn't get validation values or store them in the DB, it throws an error so that pgboss can retry the job.

##### Certificate validation polling
We asked ACM for a certificate, got its validation values and presented them to the user. Now we need to poll ACM to know if the verification was successful.

Since we're directly checking the certificate status, we also update DomainCertificate on our DB with the new status.

AWS timings are unpredictable, if the verification returns a negative result, we re-schedule the job to repeat this step.
And If we couldn't contact ACM, it throws an error so that pgboss can retry the job.

##### Certificate attachment to the ALB listener
This is the last step regarding AWS in our domain verification job, it attaches a completely verified ACM certificate to our load balancer listener.

The ALB listener is the gatekeeper of the application load balancer (ALB), it determines how incoming requests should be routed to the target server.

In the case of Stacker News, the domain points directly at the load balancer listener, this means that we can both direct the user to point their `CNAME` record to `stacker.news` and that we can serve their ACM certificate directly from the load balancer.

### End of the job
When we finish a step in the domain verification job, and the resulting status is still `PENDING`, we re-schedule a job using `sendDebounced` by pgboss.

Since we use a `singletonKey` to avoid same-domain concurrent jobs, and you can't schedule another job if one is already running, `sendDebounced` will try to schedule a job when it can, e.g. when the job finishes or after 30 seconds.

### Error handling
If something throws an error, we catch it to log the attempt and then re-throw it to let pgboss retry up to 3 times.
Using the `jobId` that we pass with each job, we can know if we're reaching 3 retries using pgboss' `getJobById`. And if we did reach 3 retries, we put the domain on `HOLD`, stopping and deleting future jobs tied to this domain.

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

# plpgSQL functions and triggers
### Clear Long Held Domains
Every midnight, the `clearLongHeldDomains` job gets executed to remove domains that have been on `HOLD` for more than 30 days.

A domain removal also means the certificate removal, which triggers **Ask ACM to delete certificate**.

### Update `DomainVerificationRecord` status
The `DomainVerification` job logs every step into `DomainVerificationAttempt`, when it comes to steps that involves DNS records like the `CNAME` record or ACM validation records, a connection between `DomainVerificationAttempt` and `DomainVerificationRecord` gets established.

If the result of a DNS verification on the `CNAME` record is `VERIFIED`, it triggers a field `status` update to the related `DomainVerificationRecord`, keeping the record **statuses** in sync with the `DomainVerification` job results.


### HOLD domain on territory STOP
Let's say the territory owner doesn't renew their territory, and they have a custom domain attached to it. We can't let the custom domain access Stacker News as the domain can be transferred or out of original owner's control.

A territory stop triggers a function that puts the custom domain on `HOLD`, effectively stopping the custom domain functionality.

If the territory owner comes back and renews, they have to repeat the Domain Verification process just to make sure that everything is alright. The verification values will be the same and the certificate hasn't been deleted, so it should just take 30 seconds.

### Clear domain on territory takeover
If a new territory owner comes up, we delete every trace of the custom domain. This also deletes its certificates, verification attempts, DNS records and customizations.

The main reason is safety: as we don't delete this stuff when a territory gets stopped, in hope that the original territory owner renews it, it's best to delete everything - above all, validation values. This will also trigger **Ask ACM to delete certificate**.

### Ask ACM to delete certificate
Whenever a domain or domain certificate gets deleted, we run a job called `deleteCertificateExternal`.
It detaches the ACM certificate from our ALB listener and then deletes the ACM certificate from ACM.

It's a necessary step to ensure that we don't waste AWS resources and also provide safety regarding the custom domain access to Stacker News.

# Neat stuff

### Let's go HTTPS with a reverse proxy

To set custom domains correctly we need to have a domain and SSL certificates.

We'll cover a basic **NGINX** configuration with **Let's Encrypt/certbot** on Linux-based systems, but you have the freedom to experiment with other methods and platforms.

#### Prerequisites
- a domain or a public hostname
- install [nginx](https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/)
- install [certbot](https://certbot.eff.org/instructions?ws=nginx&os=pip)
- possibility to add `CNAME` and `TXT` records
- domain with an `A` record at your nginx host


### Step 1: Create a nginx site for your SN instance

Start creating a new site by editing `/etc/nginx/sites-available/your-domain.tld` with your editor of choice.

<details><summary>A sample nginx site configuration to prepare for certbot</summary>
Edit this configuration to match your configuration, you can have more domains.

```
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.tld (sub.your-domain.tld, another.your-domain.tld);

    # for Let's Encrypt SSL issuance
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        try_files $uri =404;
    }
}
```
</details>

after editing, send `sudo systemctl restart nginx`

### Step 2: Get a certificate for your domains
We can now get a certificate for your domain from Let's Encrypt/certbot.

Edit the `-d` section to match your configuration. Every domain, sub-domain needs to have its own certificate.

```
sudo certbot certonly \
  --webroot -w /var/www/letsencrypt \
  -d your-domain.tld (-d sub.your-domain.tld -d another.your-domain.tld) \
  --email your@email.com \
  --agree-tos --no-eff-email \
  --deploy-hook "systemctl reload nginx"
```

If everything went smooth, we should now have a domain with a valid SSL certificate.

### Step 3: Proxy everything to sndev!

Let's go back to `/etc/nginx/sites-available/your-domain.tld` to add a SSL proxy for our sndev instance

<details><summary>A sample nginx reverse proxy config</summary>
Edit this configuration to match your configuration, you can have more domains.

```
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.tld (sub.your-domain.tld, another.your-domain.tld);

    # for Let's Encrypt SSL issuance
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        try_files $uri =404;
    }

    # 301 to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.tld (sub.your-domain.tld, another.your-domain.tld);

    ssl_certificate     /etc/letsencrypt/live/your-domain.tld/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.tld/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # proxy everything to sndev
    location / {
        proxy_pass http://sndev-instance-ip:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # optional security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "no-referrer-when-downgrade";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
}
```
</details>

### Step 4: Start sndev
Make sure to change your environment variables such as `.env.local` from something like `http://localhost:3000` to `https://your-domain.tld`

Start sndev with `./sndev start` and then navigate to your domain, you should see **Stacker News**!

If not, go back and make sure that everything is correct, you can encounter any kind of errors and **Internet can be of help**.
