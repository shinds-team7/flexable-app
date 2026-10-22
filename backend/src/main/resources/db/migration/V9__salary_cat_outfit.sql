-- 앱에 outfit-02 영상·그림을 먼저 전달한 뒤 서버에 적용한다.
UPDATE outfits
SET name = '직장냥이', price = 200, active = TRUE
WHERE id = 'outfit-02';
