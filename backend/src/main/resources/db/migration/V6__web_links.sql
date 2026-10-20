-- 웹사이트 [앱 연동하기]. 코드와 linkId는 원문을 저장하지 않고 SHA-256(hex)만 저장한다.
CREATE TABLE web_link_codes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_web_link_code_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uk_web_link_code_hash UNIQUE (code_hash)
);
CREATE INDEX idx_web_link_code_user ON web_link_codes (user_id);

CREATE TABLE web_links (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    link_hash VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_web_link_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uk_web_link_hash UNIQUE (link_hash)
);
CREATE INDEX idx_web_link_user ON web_links (user_id);
