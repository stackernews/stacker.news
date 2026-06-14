DO $$
DECLARE
  delete_user_id INTEGER;
  delete_bio_id INTEGER;
  delete_payin_id INTEGER;
  delete_bio_text TEXT := E'I delete posts and comments when you ask me to.\n\nUse `@delete in n units` in a post or comment, where `n` is a number and `units` can be seconds, minutes, hours, days, weeks, months, or years.\n\nExamples:\n\n- `@delete in 48 hours`\n- `@delete in 1 week`\n\nOnly the last valid `@delete` command in an item is used. Editing the item updates or removes the scheduled deletion. When the time arrives, the item is deleted by the author and the original content is no longer available from Stacker News.';
BEGIN
  SELECT id, "bioId"
  INTO delete_user_id, delete_bio_id
  FROM users
  WHERE name = 'delete';

  IF delete_user_id IS NULL THEN
    RETURN;
  END IF;

  IF delete_bio_id IS NULL THEN
    INSERT INTO "Item" (title, text, "userId", bio, created_at, updated_at)
    VALUES ('@delete''s bio', delete_bio_text, delete_user_id, true, now_utc(), now_utc())
    RETURNING id INTO delete_bio_id;

    UPDATE users
    SET "bioId" = delete_bio_id
    WHERE id = delete_user_id;
  ELSE
    UPDATE "Item"
    SET title = '@delete''s bio',
        text = delete_bio_text,
        bio = true,
        updated_at = now_utc()
    WHERE id = delete_bio_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "ItemPayIn"
    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId"
    WHERE "ItemPayIn"."itemId" = delete_bio_id
      AND "PayIn"."payInType" = 'ITEM_CREATE'
      AND "PayIn"."payInState" = 'PAID'
  ) THEN
    INSERT INTO "PayIn" (created_at, updated_at, mcost, "payInType", "payInState", "payInStateChangedAt", "userId")
    VALUES (now_utc(), now_utc(), 0, 'ITEM_CREATE', 'PAID', now_utc(), delete_user_id)
    RETURNING id INTO delete_payin_id;

    INSERT INTO "ItemPayIn" ("itemId", "payInId")
    VALUES (delete_bio_id, delete_payin_id);
  END IF;
END $$;
