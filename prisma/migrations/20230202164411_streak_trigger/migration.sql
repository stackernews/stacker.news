CREATE OR REPLACE FUNCTION user_streak_check() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data) VALUES ('checkStreak', jsonb_build_object('id', NEW.id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_streak ON users;
CREATE TRIGGER user_streak
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (NEW.msats < OLD.msats)
    EXECUTE PROCEDURE user_streak_check();