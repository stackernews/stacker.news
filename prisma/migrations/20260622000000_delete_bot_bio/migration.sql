set transaction isolation level serializable;

CREATE OR REPLACE FUNCTION upsert_delete_bot_bio()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    delete_user users;
    bio_item "Item";
    bio_text TEXT := $bio$
I delete posts and comments after a delay.

Use this format in the item or comment you want deleted:

`@delete in 10 minutes`

Other examples:

`@delete in 2 hours`

`@delete in 3 days`

Supported units: `second`, `minute`, `hour`, `day`, `week`, `month`, and `year`. Plurals work too.

If you include more than one valid `@delete in ...` command, the last one wins. Editing the item replaces the previous delete schedule. Editing it without a valid delete command clears the schedule.

When the time arrives, the normal author-delete flow runs on the item containing the command.
$bio$;
BEGIN
    SELECT * INTO delete_user FROM users WHERE name = 'delete';

    IF delete_user.id IS NULL THEN
        RETURN 0;
    END IF;

    IF delete_user."bioId" IS NULL THEN
        SELECT * INTO bio_item FROM create_bio('@delete''s bio', bio_text, delete_user.id);
        UPDATE "Item" SET bio = true WHERE id = bio_item.id;
    ELSE
        UPDATE "Item"
        SET title = '@delete''s bio',
            text = bio_text,
            bio = true,
            "deletedAt" = NULL
        WHERE id = delete_user."bioId";
    END IF;

    RETURN 0;
EXCEPTION WHEN sqlstate '42P01' THEN
    RETURN 0;
END;
$$;

SELECT upsert_delete_bot_bio();
DROP FUNCTION IF EXISTS upsert_delete_bot_bio();
