-- 요일별 비중(월~일 7개 정수, 쉼표로 구분)과 고른 프리셋. 기존 사용자는 기본 배분(모든 요일 같음)이라 하루 예산이 바뀌지 않는다.
ALTER TABLE budget_settings ADD COLUMN day_preset VARCHAR(10) NOT NULL DEFAULT 'EVEN';
ALTER TABLE budget_settings ADD COLUMN day_weights VARCHAR(40) NOT NULL DEFAULT '14,14,14,14,14,14,14';
