DROP TRIGGER IF EXISTS user_streak ON users;
CREATE TRIGGER user_streak
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (NEW.msats < OLD.msats OR NEW.mcredits < OLD.mcredits)
    EXECUTE PROCEDURE user_streak_check();