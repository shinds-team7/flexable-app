-- 보상 id 변경 전에 누적 7일을 채운 회원도 첫 7일 출석 보상(outfit-06)을 사용할 수 있게 복구한다.
-- 기존 코인·낚시 고양이(outfit-07)·보유 outfit-06의 획득 시각은 그대로 둔다. 0코인 출석도 포함한다.
INSERT INTO user_outfits (user_id, outfit_id, acquired_at)
SELECT attendance.user_id, 'outfit-06', CURRENT_TIMESTAMP(6)
FROM coin_ledger attendance
LEFT JOIN user_outfits owned ON owned.user_id = attendance.user_id AND owned.outfit_id = 'outfit-06'
WHERE attendance.reason = 'ATTENDANCE' AND owned.user_id IS NULL
GROUP BY attendance.user_id
HAVING COUNT(*) >= 7;
