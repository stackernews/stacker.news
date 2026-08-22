-- Once paidAt is populated, ordinary Item writes no longer need a payment
-- join merely to decide whether to enqueue the item for search indexing.
CREATE OR REPLACE FUNCTION index_item() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO pgboss.job (name, data, priority)
    VALUES ('indexItem', jsonb_build_object('id', NEW.id), -100);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER index_item
AFTER INSERT OR UPDATE ON "Item"
FOR EACH ROW
WHEN (NEW."paidAt" IS NOT NULL)
EXECUTE FUNCTION index_item();
