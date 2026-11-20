-- 서버 이전 전후 행 수 비교용. 옮기기 전(아카데미 MySQL)과 옮긴 뒤(EC2 MySQL)에서 같은 결과가 나와야 한다.
-- 새 테이블을 만드는 마이그레이션을 더하면 여기에도 한 줄 더한다.
SELECT 'users' t, COUNT(*) n FROM users
UNION ALL SELECT 'user_identities', COUNT(*) FROM user_identities
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'fixed_expenses', COUNT(*) FROM fixed_expenses
UNION ALL SELECT 'fixed_expense_postings', COUNT(*) FROM fixed_expense_postings
UNION ALL SELECT 'scheduled_expenses', COUNT(*) FROM scheduled_expenses
UNION ALL SELECT 'protected_items', COUNT(*) FROM protected_items
UNION ALL SELECT 'budget_settings', COUNT(*) FROM budget_settings
UNION ALL SELECT 'daily_budgets', COUNT(*) FROM daily_budgets
UNION ALL SELECT 'seed_money_entries', COUNT(*) FROM seed_money_entries
UNION ALL SELECT 'seed_money_additions', COUNT(*) FROM seed_money_additions
UNION ALL SELECT 'coin_wallets', COUNT(*) FROM coin_wallets
UNION ALL SELECT 'coin_ledger', COUNT(*) FROM coin_ledger
UNION ALL SELECT 'outfits', COUNT(*) FROM outfits
UNION ALL SELECT 'user_outfits', COUNT(*) FROM user_outfits
UNION ALL SELECT 'referrals', COUNT(*) FROM referrals
UNION ALL SELECT 'web_links', COUNT(*) FROM web_links
UNION ALL SELECT 'web_link_codes', COUNT(*) FROM web_link_codes
UNION ALL SELECT 'error_events', COUNT(*) FROM error_events
UNION ALL SELECT 'flyway_schema_history', COUNT(*) FROM flyway_schema_history;
SELECT MAX(CAST(version AS UNSIGNED)) AS flyway_version FROM flyway_schema_history WHERE success = 1;
