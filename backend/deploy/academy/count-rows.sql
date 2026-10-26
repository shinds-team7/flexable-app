-- 이전 전후 행 수 비교용. RDS와 아카데미 MySQL에서 같은 결과가 나와야 한다.
SELECT 'users' t, COUNT(*) n FROM users
UNION ALL SELECT 'user_identities', COUNT(*) FROM user_identities
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'fixed_expenses', COUNT(*) FROM fixed_expenses
UNION ALL SELECT 'fixed_expense_postings', COUNT(*) FROM fixed_expense_postings
UNION ALL SELECT 'budget_settings', COUNT(*) FROM budget_settings
UNION ALL SELECT 'daily_budgets', COUNT(*) FROM daily_budgets
UNION ALL SELECT 'seed_money_entries', COUNT(*) FROM seed_money_entries
UNION ALL SELECT 'coin_wallets', COUNT(*) FROM coin_wallets
UNION ALL SELECT 'coin_ledger', COUNT(*) FROM coin_ledger
UNION ALL SELECT 'user_outfits', COUNT(*) FROM user_outfits
UNION ALL SELECT 'referrals', COUNT(*) FROM referrals
UNION ALL SELECT 'web_links', COUNT(*) FROM web_links
UNION ALL SELECT 'flyway_schema_history', COUNT(*) FROM flyway_schema_history;
SELECT MAX(version) AS flyway_version FROM flyway_schema_history WHERE success = 1;
