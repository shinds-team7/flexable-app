ALTER TABLE users MODIFY COLUMN email VARCHAR(254) NULL;
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(100) NULL;

CREATE TABLE user_identities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(100) NOT NULL,
    email VARCHAR(254) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_identity_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uk_identity_provider UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_identity_user ON user_identities (user_id);
