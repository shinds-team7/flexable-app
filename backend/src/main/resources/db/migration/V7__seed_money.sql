-- 시드머니: 가입 때 입력한 모아둔 돈(seed_base) + 수입일 전날마다 반영한 금액(seed_money_entries).
ALTER TABLE budget_settings ADD COLUMN seed_base BIGINT NOT NULL DEFAULT 0;

CREATE TABLE seed_money_entries (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    cycle_end DATE NOT NULL,
    choice VARCHAR(10) NOT NULL,
    amount BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_seed_entry_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uk_seed_entry_cycle UNIQUE (user_id, cycle_end)
);
