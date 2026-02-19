-- 🚀 알구몬 크롤러용 deals 테이블 업그레이드
-- deal_id 필드 추가로 중복 체크 성능 향상

-- 1. deal_id 컬럼 추가
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_id TEXT;

-- 2. deal_id에 unique 제약 조건 추가 (중복 방지의 핵심!)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_deal_id 
ON deals (deal_id) 
WHERE deal_id IS NOT NULL;

-- 3. 성능을 위한 추가 인덱스
CREATE INDEX IF NOT EXISTS idx_deals_deal_id_created_at 
ON deals (deal_id, created_at DESC) 
WHERE deal_id IS NOT NULL;

-- 4. 알구몬 딜 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_deals_algumon_deal_id 
ON deals (mall_name, deal_id, created_at DESC) 
WHERE mall_name = '알구몬';

-- 5. 기존 알구몬 딜들의 deal_id 추출 및 업데이트
-- URL에서 deal_id 추출하여 기존 데이터 업데이트
UPDATE deals 
SET deal_id = (
    SELECT substring(url FROM '/l/d/(\d+)')
    WHERE url ~ '/l/d/\d+'
)
WHERE mall_name = '알구몬' 
AND deal_id IS NULL 
AND url ~ '/l/d/\d+';

-- 6. 통계 및 확인 쿼리들

-- 알구몬 딜 deal_id 현황
SELECT 
    COUNT(*) as total_algumon_deals,
    COUNT(deal_id) as deals_with_id,
    COUNT(*) - COUNT(deal_id) as deals_without_id,
    ROUND(COUNT(deal_id) * 100.0 / COUNT(*), 2) as completion_rate
FROM deals 
WHERE mall_name = '알구몬';

-- deal_id 길이 분포 (데이터 품질 체크)
SELECT 
    LENGTH(deal_id) as id_length,
    COUNT(*) as count,
    MIN(deal_id) as min_id,
    MAX(deal_id) as max_id
FROM deals 
WHERE mall_name = '알구몬' 
AND deal_id IS NOT NULL
GROUP BY LENGTH(deal_id)
ORDER BY id_length;

-- 최근 알구몬 딜들 확인
SELECT 
    id,
    deal_id,
    title,
    url,
    created_at
FROM deals 
WHERE mall_name = '알구몬'
AND deal_id IS NOT NULL
ORDER BY created_at DESC 
LIMIT 10;

-- 7. 데이터 품질 체크 쿼리

-- deal_id 중복 확인 (있으면 안됨!)
SELECT deal_id, COUNT(*) 
FROM deals 
WHERE deal_id IS NOT NULL
GROUP BY deal_id 
HAVING COUNT(*) > 1;

-- 알구몬 딜 중 deal_id 누락된 것들
SELECT id, title, url, created_at
FROM deals 
WHERE mall_name = '알구몬'
AND deal_id IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- 8. 성능 테스트 쿼리

-- deal_id 기반 중복 체크 (매우 빨라야 함)
EXPLAIN ANALYZE 
SELECT 1 FROM deals WHERE deal_id = '939539' LIMIT 1;

-- 알구몬 최신 딜 조회
EXPLAIN ANALYZE
SELECT deal_id, title, price, created_at 
FROM deals 
WHERE mall_name = '알구몬' 
AND deal_id IS NOT NULL
ORDER BY created_at DESC 
LIMIT 20;

-- 완료 메시지
SELECT 'deals 테이블 deal_id 업그레이드 완료! 🎉' as message;