# Local Auth

You must be logged in to test features like posting, replying, tipping, etc.

### Login with Email

- First, follow the local development instructions in the README.md
- Create a Sendgrid account (or other smtp service)
- Update your `.env` file and source it in `docker-compose.yml`

```
LOGIN_EMAIL_SERVER=smtp://apikey:<sendgrid_api_key>@smtp.sendgrid.net:587
LOGIN_EMAIL_FROM=<sendgrid_email_from>
```

- Open http://localhost:3000
- Click "sign up" and enter your email address
- Check your email
- Click the link (looks like this):

```
http://localhost:3000/api/auth/callback/email?email=satoshi%40gmail.com&token=110e30a954ce7ca643379d90eb511640733de405f34a31b38eeda8e254d48cd7
```

### Login with Github

- [Create a new OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) in your Github account
  - Set the callback URL to: `http://localhost:3000/api/auth/callback/github`
- Update your `.env` file

```
GITHUB_ID=<Client ID>
GITHUB_SECRET=<Client secret>
```
- Signup and login as above

