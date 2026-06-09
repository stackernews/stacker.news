UPDATE "NotificationBulletin"
SET "text" = REPLACE(REPLACE("text", '/api/me', '/me'), '/api/daily', '/daily'),
    "updated_at" = NOW();
