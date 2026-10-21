-- 앱 내부 화폐(코인)와 캐릭터 코스튬. 규칙은 docs/coin-plan.md, API는 docs/API.md "코인·코스튬".

-- 사용자별 코인 지갑. 시간 적립 상태·적용 중인 코스튬·내 추천 코드도 여기에 둔다(users 테이블은 건드리지 않음).
CREATE TABLE coin_wallets (
    user_id            BIGINT      NOT NULL,
    balance            BIGINT      NOT NULL DEFAULT 0,
    passive_date       DATE        NULL,
    passive_started_at DATETIME(6) NULL,
    passive_collected  INT         NOT NULL DEFAULT 0,
    equipped_outfit_id VARCHAR(40) NULL,
    referral_code      VARCHAR(12) NULL,
    version            BIGINT      NOT NULL DEFAULT 0,
    created_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id),
    CONSTRAINT uk_coin_wallet_referral UNIQUE (referral_code),
    CONSTRAINT fk_coin_wallet_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 코인 내역. (user_id, reason, ref_key) 유니크로 같은 보상을 두 번 주지 않는다.
-- notified_at: 모달로 보여 준 뒤 앱이 확인(ack)한 시각. 모달이 없는 내역은 만들 때 채운다.
CREATE TABLE coin_ledger (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    user_id     BIGINT      NOT NULL,
    amount      INT         NOT NULL,
    reason      VARCHAR(30) NOT NULL,
    ref_key     VARCHAR(40) NOT NULL,
    notified_at DATETIME(6) NULL,
    created_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_coin_ledger_ref UNIQUE (user_id, reason, ref_key),
    CONSTRAINT fk_coin_ledger_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 코스튬 목록. 레벨 코스튬은 unlock_level(1~5)로 열리고 price가 없다. 상점 상품은 price가 있고 unlock_level이 없다.
-- active=false는 운영에서 숨긴다(애니메이션 파일이 저장소에 들어온 뒤 V{n} 마이그레이션으로 켠다).
CREATE TABLE outfits (
    id           VARCHAR(40) NOT NULL,
    name         VARCHAR(40) NOT NULL,
    price        INT         NULL,
    unlock_level INT         NULL,
    sort_order   INT         NOT NULL,
    active       BOOLEAN     NOT NULL,
    PRIMARY KEY (id)
);

INSERT INTO outfits (id, name, price, unlock_level, sort_order, active) VALUES
    ('costume-lv1', '광부',     NULL, 1, 1, TRUE),
    ('costume-lv2', 'Lv.2 코스튬', NULL, 2, 2, TRUE),
    ('costume-lv3', 'Lv.3 코스튬', NULL, 3, 3, TRUE),
    ('costume-lv4', 'Lv.4 코스튬', NULL, 4, 4, TRUE),
    ('costume-lv5', '왕',       NULL, 5, 5, TRUE),
    ('outfit-01', '상품 01', 200, NULL, 101, FALSE),
    ('outfit-02', '상품 02', 200, NULL, 102, FALSE),
    ('outfit-03', '상품 03', 200, NULL, 103, FALSE),
    ('outfit-04', '상품 04', 200, NULL, 104, FALSE),
    ('outfit-05', '상품 05', 200, NULL, 105, FALSE),
    ('outfit-06', '상품 06', 200, NULL, 106, FALSE),
    ('outfit-07', '상품 07', 200, NULL, 107, FALSE),
    ('outfit-08', '상품 08', 200, NULL, 108, FALSE),
    ('outfit-09', '상품 09', 200, NULL, 109, FALSE),
    ('outfit-10', '상품 10', 200, NULL, 110, FALSE);

-- 산 상점 상품. 레벨 코스튬은 최고 레벨로 판단하므로 넣지 않는다.
CREATE TABLE user_outfits (
    user_id     BIGINT      NOT NULL,
    outfit_id   VARCHAR(40) NOT NULL,
    acquired_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, outfit_id),
    CONSTRAINT fk_user_outfit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_outfit_outfit FOREIGN KEY (outfit_id) REFERENCES outfits (id)
);

-- 추천 코드 등록. 한 사람은 한 번만 등록한다. 초대한 사람이 탈퇴해도 기록은 남겨 다시 등록할 수 없게 한다.
CREATE TABLE referrals (
    invitee_id BIGINT      NOT NULL,
    inviter_id BIGINT      NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (invitee_id),
    CONSTRAINT fk_referral_invitee FOREIGN KEY (invitee_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_referral_inviter FOREIGN KEY (inviter_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_referral_inviter ON referrals (inviter_id);
