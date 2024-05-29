-- allow everyone access to API keys by default
UPDATE users SET "apiKeyEnabled" = 't';
