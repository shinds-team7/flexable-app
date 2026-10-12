CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    token_version INT          NOT NULL DEFAULT 0,
    onboarded     BOOLEAN      NOT NULL DEFAULT FALSE,
    agreed_at     DATETIME(6)  NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE budget_settings (
    user_id       BIGINT      NOT NULL,
    balance       BIGINT      NOT NULL,
    balance_at    DATETIME(6) NOT NULL,
    payday        INT         NOT NULL,
    income_amount BIGINT      NOT NULL,
    card_unpaid   BIGINT      NOT NULL,
    updated_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_budget_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE fixed_expenses (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    name       VARCHAR(40) NOT NULL,
    amount     BIGINT      NOT NULL,
    day_of_month INT       NOT NULL,
    sort_order INT         NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_fixed_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_fixed_user ON fixed_expenses (user_id);

CREATE TABLE protected_items (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    name       VARCHAR(40) NOT NULL,
    amount     BIGINT      NOT NULL,
    sort_order INT         NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_protected_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_protected_user ON protected_items (user_id);

CREATE TABLE categories (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    name       VARCHAR(20) NOT NULL,
    type       VARCHAR(10) NOT NULL,
    color      VARCHAR(7)  NOT NULL,
    icon       VARCHAR(40) NOT NULL,
    is_default BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_categories_name UNIQUE (user_id, type, name),
    CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    user_id         BIGINT       NOT NULL,
    category_id     BIGINT       NOT NULL,
    type            VARCHAR(10)  NOT NULL,
    amount          BIGINT       NOT NULL,
    title           VARCHAR(40)  NOT NULL,
    memo            VARCHAR(200) NULL,
    occurred_at     DATETIME(6)  NOT NULL,
    idempotency_key VARCHAR(64)  NULL,
    created_at      DATETIME(6)  NOT NULL,
    updated_at      DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_transactions_idem UNIQUE (user_id, idempotency_key),
    CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES categories (id)
);
CREATE INDEX idx_transactions_user_time ON transactions (user_id, occurred_at);
