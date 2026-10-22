-- 캐릭터를 3단계로 줄이고(CharacterScore.MAX 200) 상점 코스튬 둘을 레벨 코스튬으로 옮긴다(docs/coin-plan.md).
-- Lv.1 광부(costume-lv1), Lv.2 직장냥이(outfit-02), Lv.3 잭팟(outfit-01). 코인 코스튬은 나중에 새로 들어온다.
-- 앱에 REFUND 안내 모달이 먼저 들어간 뒤(원격 업데이트) 서버에 적용한다.

-- 이미 산 사람은 계속 보유하고(OutfitService가 산 기록도 보유로 본다) 낸 코인을 돌려받는다. 다음 check-in에서 모달로 알린다.
INSERT INTO coin_ledger (user_id, amount, reason, ref_key, notified_at, created_at)
SELECT user_id, -amount, 'REFUND', ref_key, NULL, CURRENT_TIMESTAMP(6)
FROM coin_ledger
WHERE reason = 'PURCHASE' AND ref_key IN ('outfit-01', 'outfit-02');

-- REFUND는 이 마이그레이션에서만 생기므로 합계를 그대로 더한다.
UPDATE coin_wallets
SET balance = balance + (SELECT SUM(l.amount) FROM coin_ledger l
                         WHERE l.user_id = coin_wallets.user_id AND l.reason = 'REFUND'),
    version = version + 1
WHERE user_id IN (SELECT user_id FROM coin_ledger WHERE reason = 'REFUND');

UPDATE outfits SET price = NULL, unlock_level = 2, sort_order = 2 WHERE id = 'outfit-02';
UPDATE outfits SET price = NULL, unlock_level = 3, sort_order = 3 WHERE id = 'outfit-01';
-- 쓰지 않는 레벨 자리(운영에서는 꺼져 있음)는 뒤로 보내 순서가 겹치지 않게 한다.
UPDATE outfits SET sort_order = 10 + unlock_level WHERE id IN ('costume-lv2', 'costume-lv3', 'costume-lv4', 'costume-lv5');
