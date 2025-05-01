# Custom Domains
tbd

### Content
- [Let's go HTTPS](#prerequisites)

## Let's go HTTPS with a reverse proxy

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
