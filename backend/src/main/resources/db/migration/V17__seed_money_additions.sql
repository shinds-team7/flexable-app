-- 수입일 전날 반영(seed_money_entries, 주기당 1번)과 별개로, 지금 예산에서 시드머니로 바로 옮긴 돈. 횟수 제한이 없다.
-- 옮긴 돈은 반영한 돈처럼 통장 잔액에서 빠진 것으로 보고 시드머니 합계에 더한다.
CREATE TABLE seed_money_additions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    amount BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_seed_addition_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
