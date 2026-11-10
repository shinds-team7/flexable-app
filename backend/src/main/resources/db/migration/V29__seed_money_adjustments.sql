-- 실제 생활비에서 옮긴 돈과, 생활비를 바꾸지 않는 시드머니 총액 정정을 구분한다.
ALTER TABLE seed_money_additions ADD COLUMN is_adjustment BOOLEAN NOT NULL DEFAULT FALSE;
