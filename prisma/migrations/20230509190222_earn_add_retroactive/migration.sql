SELECT sats_after_tip("Earn"."typeId", NULL, "Earn".msats)
FROM "Earn"
WHERE type = 'POST' OR type = 'COMMENT';