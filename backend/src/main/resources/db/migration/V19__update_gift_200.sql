-- 업데이트 기념 200코인(2026-11-03): 이 마이그레이션이 적용될 때 지갑이 있는 모든 사용자에게 한 번 준다.
-- 사유는 계약의 reason 목록을 바꾸지 않으려고 SIGNUP_GIFT를 다른 ref_key로 쓴다(앱 모달은 '업데이트 기념 200코인 선물').
-- notified_at을 비워 두어 다음 check-in에서 모달로 안내한다. 지갑이 아직 없는 사용자는 첫 check-in의 가입 선물 200을 받는다.
INSERT INTO coin_ledger (user_id, amount, reason, ref_key, notified_at, created_at)
SELECT user_id, 200, 'SIGNUP_GIFT', 'update-1.6.0', NULL, CURRENT_TIMESTAMP(6) FROM coin_wallets;

UPDATE coin_wallets SET balance = balance + 200
WHERE EXISTS (SELECT 1 FROM coin_ledger l WHERE l.user_id = coin_wallets.user_id AND l.reason = 'SIGNUP_GIFT' AND l.ref_key = 'update-1.6.0');
