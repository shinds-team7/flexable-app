-- 누적 출석 7일째에 한 번만 주는 코스튬 자리. 상점에서 팔지 않고(price NULL, active FALSE) 받은 사람에게만 목록에 보인다.
-- 영상은 아직 없어서 앱은 기본 화면으로 보여 주며, 같은 id로 영상을 나중에 넣는다(docs/coin-plan.md).
UPDATE outfits SET name = '출석 보상', price = NULL, active = FALSE WHERE id = 'outfit-06';
