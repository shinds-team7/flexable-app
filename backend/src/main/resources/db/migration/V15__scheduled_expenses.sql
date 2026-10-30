CREATE TABLE scheduled_expenses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    amount BIGINT NOT NULL,
    title VARCHAR(40) NOT NULL,
    planned_date DATE NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_scheduled_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_scheduled_category FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX idx_scheduled_user_date ON scheduled_expenses(user_id, planned_date);
