-- 기본 카테고리 개편(2026-11-14, policies §10): 지출 12개(식비·카페·생활·교통·주거·통신·쇼핑·여가·건강·교육·구독·기타),
-- 수입 6개(급여·용돈·금융수입·환급·지원금·기타 수입). 기존 사용자도 같은 이름으로 맞춘다.
-- ① 옛 기본 이름을 새 이름으로 바꾼다. 같은 이름이 이미 있으면(사용자가 만든 것) 건드리지 않는다.
-- ② 없는 카테고리를 그 종류의 끝에 더한다. ③ '기타'·'기타 수입'을 다시 맨 끝으로 옮긴다.
-- '고정지출'은 거래가 들어 있으므로 그대로 둔다(새 가입자에게만 만들지 않는다). 거래·예정 지출은 바꾸지 않는다.
-- MySQL은 바꾸는 표를 하위 질의에서 바로 읽지 못하므로(1093) 같은 표는 DISTINCT·GROUP BY 파생 표로만 읽는다.

UPDATE categories SET name = '카페'
WHERE type = 'EXPENSE' AND name = '카페·간식'
  AND user_id NOT IN (SELECT taken.user_id FROM (SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE' AND name = '카페') taken);

UPDATE categories SET name = '생활'
WHERE type = 'EXPENSE' AND name = '생활·마트'
  AND user_id NOT IN (SELECT taken.user_id FROM (SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE' AND name = '생활') taken);

UPDATE categories SET name = '여가'
WHERE type = 'EXPENSE' AND name = '문화·여가'
  AND user_id NOT IN (SELECT taken.user_id FROM (SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE' AND name = '여가') taken);

INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order, created_at)
SELECT u.id, '주거', 'EXPENSE', '#6172F3', 'home', TRUE, COALESCE(last.max_order, -1) + 1, CURRENT_TIMESTAMP(6)
FROM users u
LEFT JOIN (SELECT user_id, MAX(sort_order) AS max_order FROM categories WHERE type = 'EXPENSE' GROUP BY user_id) last ON last.user_id = u.id
LEFT JOIN (SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE' AND name = '주거') taken ON taken.user_id = u.id
WHERE taken.user_id IS NULL;

INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order, created_at)
SELECT u.id, '통신', 'EXPENSE', '#0BA5EC', 'phone-portrait', TRUE, COALESCE(last.max_order, -1) + 1, CURRENT_TIMESTAMP(6)
FROM users u
LEFT JOIN (SELECT user_id, MAX(sort_order) AS max_order FROM categories WHERE type = 'EXPENSE' GROUP BY user_id) last ON last.user_id = u.id
LEFT JOIN (SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE' AND name = '통신') taken ON taken.user_id = u.id
WHERE taken.user_id IS NULL;

INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order, created_at)
SELECT u.id, '건강', 'EXPENSE', '#F04438', 'medkit', TRUE, COALESCE(last.max_order, -1) + 1, CURRENT_TIMESTAMP(6)
FROM users u
LEFT JOIN (SELECT user_id, MAX(sort_order) AS max_order FROM categories WHERE type = 'EXPENSE' GROUP BY user_id) last ON last.user_id = u.id
LEFT JOIN (SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE' AND name = '건강') taken ON taken.user_id = u.id
WHERE taken.user_id IS NULL;

INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order, created_at)
SELECT u.id, '교육', 'EXPENSE', '#444CE7', 'school', TRUE, COALESCE(last.max_order, -1) + 1, CURRENT_TIMESTAMP(6)
FROM users u
LEFT JOIN (SELECT user_id, MAX(sort_order) AS max_order FROM categories WHERE type = 'EXPENSE' GROUP BY user_id) last ON last.user_id = u.id
LEFT JOIN (SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE' AND name = '교육') taken ON taken.user_id = u.id
WHERE taken.user_id IS NULL;

INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order, created_at)
SELECT u.id, '구독', 'EXPENSE', '#DD2590', 'play-circle', TRUE, COALESCE(last.max_order, -1) + 1, CURRENT_TIMESTAMP(6)
FROM users u
LEFT JOIN (SELECT user_id, MAX(sort_order) AS max_order FROM categories WHERE type = 'EXPENSE' GROUP BY user_id) last ON last.user_id = u.id
LEFT JOIN (SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE' AND name = '구독') taken ON taken.user_id = u.id
WHERE taken.user_id IS NULL;

INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order, created_at)
SELECT u.id, '금융수입', 'INCOME', '#F79009', 'trending-up', TRUE, COALESCE(last.max_order, -1) + 1, CURRENT_TIMESTAMP(6)
FROM users u
LEFT JOIN (SELECT user_id, MAX(sort_order) AS max_order FROM categories WHERE type = 'INCOME' GROUP BY user_id) last ON last.user_id = u.id
LEFT JOIN (SELECT DISTINCT user_id FROM categories WHERE type = 'INCOME' AND name = '금융수입') taken ON taken.user_id = u.id
WHERE taken.user_id IS NULL;

INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order, created_at)
SELECT u.id, '환급', 'INCOME', '#15B79E', 'receipt', TRUE, COALESCE(last.max_order, -1) + 1, CURRENT_TIMESTAMP(6)
FROM users u
LEFT JOIN (SELECT user_id, MAX(sort_order) AS max_order FROM categories WHERE type = 'INCOME' GROUP BY user_id) last ON last.user_id = u.id
LEFT JOIN (SELECT DISTINCT user_id FROM categories WHERE type = 'INCOME' AND name = '환급') taken ON taken.user_id = u.id
WHERE taken.user_id IS NULL;

INSERT INTO categories (user_id, name, type, color, icon, is_default, sort_order, created_at)
SELECT u.id, '지원금', 'INCOME', '#7A5AF8', 'ribbon', TRUE, COALESCE(last.max_order, -1) + 1, CURRENT_TIMESTAMP(6)
FROM users u
LEFT JOIN (SELECT user_id, MAX(sort_order) AS max_order FROM categories WHERE type = 'INCOME' GROUP BY user_id) last ON last.user_id = u.id
LEFT JOIN (SELECT DISTINCT user_id FROM categories WHERE type = 'INCOME' AND name = '지원금') taken ON taken.user_id = u.id
WHERE taken.user_id IS NULL;

UPDATE categories SET sort_order = (
  SELECT last.next_order FROM (SELECT user_id, MAX(sort_order) + 1 AS next_order FROM categories WHERE type = 'EXPENSE' GROUP BY user_id) last
  WHERE last.user_id = categories.user_id)
WHERE type = 'EXPENSE' AND name = '기타';

UPDATE categories SET sort_order = (
  SELECT last.next_order FROM (SELECT user_id, MAX(sort_order) + 1 AS next_order FROM categories WHERE type = 'INCOME' GROUP BY user_id) last
  WHERE last.user_id = categories.user_id)
WHERE type = 'INCOME' AND name = '기타 수입';
