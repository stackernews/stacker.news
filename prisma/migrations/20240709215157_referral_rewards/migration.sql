ALTER TYPE "EarnType" ADD VALUE 'FOREVER_REFERRAL';
ALTER TYPE "EarnType" ADD VALUE 'ONE_DAY_REFERRAL';

-- delete attributing one day referrals to pages
DELETE FROM "OneDayReferral"
WHERE "typeId" IN (
    SELECT id::text
    FROM users
    WHERE name IN (
        'api', 'auth', 'day', 'invites', 'invoices', 'referrals', 'rewards',
        'satistics', 'settings', 'stackers', 'wallet', 'withdrawals', '404', '500',
        'email', 'live', 'login', 'notifications', 'offline', 'search', 'share',
        'signup', 'territory', 'recent', 'top', 'edit', 'post', 'rss', 'saloon',
        'faq', 'story', 'privacy', 'copyright', 'tos', 'changes', 'guide', 'daily',
        'anon', 'ad'
    )
);

-- delete attributing forever referrals to pages
UPDATE users SET "referrerId" = NULL
WHERE "referrerId" IN (
    SELECT id
    FROM users
    WHERE name IN (
        'api', 'auth', 'day', 'invites', 'invoices', 'referrals', 'rewards',
        'satistics', 'settings', 'stackers', 'wallet', 'withdrawals', '404', '500',
        'email', 'live', 'login', 'notifications', 'offline', 'search', 'share',
        'signup', 'territory', 'recent', 'top', 'edit', 'post', 'rss', 'saloon',
        'faq', 'story', 'privacy', 'copyright', 'tos', 'changes', 'guide', 'daily',
        'anon', 'ad'
    )
);