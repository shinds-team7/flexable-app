-- Lv.3 상인(costume-lv3, cat-trader.mp4)과 Lv.4 기사(costume-lv4, cat-knight.mp4) 영상이 들어와 켠다(앱 assets/outfits/costume-lv3·lv4.*).
-- 코인으로 살 수 없고, 지금까지 도달한 최고 단계가 3·4 이상인 사용자만 보유·적용할 수 있다(OutfitService).
-- 반영 순서: 앱 원격 업데이트(영상 연결) 수신 확인 → 이 마이그레이션. 먼저 켜면 옛 앱이 기본 캐릭터 그림으로 보인다.
UPDATE outfits SET active = TRUE WHERE id IN ('costume-lv3', 'costume-lv4');
