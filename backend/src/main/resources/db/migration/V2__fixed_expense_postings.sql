-- 날짜가 된 고정지출을 지출 거래로 자동 기록한다.
ALTER TABLE transactions ADD COLUMN from_fixed BOOLEAN NOT NULL DEFAULT FALSE;

-- 도입 전에 설정한 사용자는 이 시각 이후 날짜부터만 기록한다. 값은 V3에서 UTC로 채운다.
ALTER TABLE budget_settings ADD COLUMN fixed_posting_since DATETIME(6) NULL;

-- 이미 기록한 고정지출(날짜·항목별 1회). 거래를 지워도 남겨서 다시 만들지 않는다.
-- posting_key = "yyyy-MM-dd:" + 항목(일자·이름·순번) SHA-256 앞 32자(소문자 hex라 콜레이션과 무관).
-- transaction_id = 이 날짜·항목을 맡은 거래(자동으로 만든 거래, 또는 직접 기록해 둔 같은 지출). 다른 항목을 대신하는 데 다시 쓰지 않는다.
CREATE TABLE fixed_expense_postings (
    id                     BIGINT      NOT NULL AUTO_INCREMENT,
    user_id                BIGINT      NOT NULL,
    posting_key            VARCHAR(64) NOT NULL,
    transaction_id         BIGINT      NOT NULL,
    created_at             DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_fixed_postings_key UNIQUE (user_id, posting_key),
    CONSTRAINT fk_fixed_postings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
