-- 앱에 outfit-03 영상·그림을 먼저 전달한 뒤 서버에 적용한다. 레벨 코스튬 3개 뒤 첫 코인 구매 코스튬이다.
UPDATE outfits
SET name = '유령냥이', price = 200, active = TRUE
WHERE id = 'outfit-03';
