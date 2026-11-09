-- 새로 RECORD를 선택한 주에는 선택 당시 비중을 유지하고 다음 월요일부터 갱신한다.
ALTER TABLE budget_settings ADD COLUMN day_weights_chosen_at TIMESTAMP(6);
-- 기존 RECORD 선택자는 배포한 주에는 저장된 비중을 유지한다.
UPDATE budget_settings SET day_weights_chosen_at = CURRENT_TIMESTAMP(6) WHERE day_preset = 'RECORD';
