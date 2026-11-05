-- 캐릭터 단계를 3개에서 6개로 늘린다(CharacterScore.MAX 500, docs/coin-plan.md·policies.md §4).
-- 레벨 코스튬: Lv.1 광부(costume-lv1), Lv.2 마구간지기, Lv.3 상인, Lv.4 기사, Lv.5 귀족, Lv.6 왕족.
-- 새 5개는 디자인 중이라 꺼 둔 채(active = FALSE) 자리만 잡는다. 꺼져 있는 동안 앱에는 자물쇠 칸으로 보이고 레벨이 되어도 열리지 않는다.
-- 직장냥이(outfit-02)·잭팟(outfit-01)은 레벨 코스튬에서 200코인 상품으로 바꾼다. 이미 레벨로 열어 둔 사용자는 V21이 보유 기록을 넣어 계속 쓴다.
UPDATE outfits SET price = 200, unlock_level = NULL, sort_order = 102 WHERE id = 'outfit-02';
UPDATE outfits SET price = 200, unlock_level = NULL, sort_order = 101 WHERE id = 'outfit-01';

UPDATE outfits SET name = '마구간지기', unlock_level = 2, sort_order = 2, active = FALSE WHERE id = 'costume-lv2';
UPDATE outfits SET name = '상인',       unlock_level = 3, sort_order = 3, active = FALSE WHERE id = 'costume-lv3';
UPDATE outfits SET name = '기사',       unlock_level = 4, sort_order = 4, active = FALSE WHERE id = 'costume-lv4';
UPDATE outfits SET name = '귀족',       unlock_level = 5, sort_order = 5, active = FALSE WHERE id = 'costume-lv5';
INSERT INTO outfits (id, name, price, unlock_level, sort_order, active) VALUES ('costume-lv6', '왕족', NULL, 6, 6, FALSE);
