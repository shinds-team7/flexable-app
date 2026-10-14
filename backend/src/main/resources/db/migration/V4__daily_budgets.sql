-- 캐릭터 단계 점수용: 날짜별 하루 예산(그날 마지막으로 계산한 값). 그날 지출이 이보다 적으면 예산을 지킨 날이다.
CREATE TABLE daily_budgets (
    id            BIGINT NOT NULL AUTO_INCREMENT,
    user_id       BIGINT NOT NULL,
    budget_date   DATE   NOT NULL,
    daily_budget  BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_daily_budgets_date UNIQUE (user_id, budget_date),
    CONSTRAINT fk_daily_budgets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
