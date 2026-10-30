ALTER TABLE categories ADD COLUMN sort_order BIGINT NOT NULL DEFAULT 0;
UPDATE categories SET sort_order = id;
CREATE INDEX idx_categories_user_order ON categories (user_id, type, sort_order);
