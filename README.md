# 🛒 알구몬 크롤링 서버

[![CI/CD](https://github.com/hwangjun/algumon-crawler/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/hwangjun/algumon-crawler/actions/workflows/ci-cd.yml)
[![Deploy](https://img.shields.io/badge/Deploy-Render.com-46e3b7)](https://render.com)

알구몬 전용 크롤링 서버 - Render.com + axios/cheerio + Supabase (5분 주기, 순차 처리)

## 🏗️ 아키텍처

```
🛒 알구몬 크롤러 (Render.com)
├── 🕷️ axios + cheerio (웹 크롤링)
├── ⏰ node-cron (5분 자동화)
├── 🔄 6개 카테고리 순차 처리 (1→2→3→4→5→6)
└── 💾 Supabase 저장

🗄️ Supabase (중앙 DB)
├── 📋 hotdeals 테이블
├── 🚫 중복 방지 로직
└── 🧹 자동 데이터 정리

🌐 Next.js 사이트 (hotdeal-nextjs)
├── 📖 읽기 전용 DB 조회
└── 🚀 빠른 사용자 경험
```

## 🎯 크롤링 대상

| 카테고리 | ID | URL | 설명 |
|----------|----|----|------|
| 기타 | 1 | `/category/1` | 기타 상품 |
| 디지털/가전 | 2 | `/category/2` | 전자제품, 가전 |
| 컴퓨터 | 3 | `/category/3` | PC, 부품, 소프트웨어 |
| 패션/뷰티 | 4 | `/category/4` | 의류, 화장품 |
| 식품/건강 | 5 | `/category/5` | 음식, 건강식품 |
| 생활/취미 | 6 | `/category/6` | 생활용품, 취미 |

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 설정

```bash
# 환경변수 파일 생성
cp .env.example .env

# Supabase 정보 입력
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your-anon-key
```

### 3. 로컬 테스트

```bash
# 전체 테스트 (저장 제외)
npm test

# 특정 카테고리 테스트
npm test category 1

# 전체 크롤링 (저장 포함)
npm test full
```

### 4. 로컬 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 📡 API 엔드포인트

### `GET /`
서버 정보 및 카테고리 목록

### `GET /status`
상세 서버 상태 및 크롤링 통계

### `POST /crawl`
수동 크롤링 실행

### `GET /cron`
크론 작업 상태 확인

### `GET /health`
Render.com 헬스체크

## 🛠️ 주요 기능

### 🕷️ 강력한 크롤링
- axios + cheerio로 빠른 HTML 파싱
- 실제 브라우저 헤더 시뮬레이션
- 6개 카테고리 순차 처리
- 에러 복구 및 재시도 로직

### 💰 가격 정보 추출
- 다양한 가격 패턴 인식
- 제목 및 HTML 요소에서 추출
- 합리적 가격 범위 검증

### 🗄️ 데이터 관리
- Supabase 중앙 집중 저장
- URL 기반 중복 방지
- 자동 데이터 정리 (7일)

### ⏰ 자동화
- 1분마다 자동 실행
- Render.com 무료 플랜 최적화
- 헬스체크 엔드포인트

## 🚀 CI/CD 파이프라인

### **✅ GitHub Actions 자동화**

프로젝트는 완전한 CI/CD 파이프라인을 갖추고 있습니다:

```yaml
Push → Test → Build → Deploy → Verify
```

#### **테스트 단계:**
- 🏥 시스템 헬스체크 (`npm run test:health`)
- 🧪 크롤링 기능 테스트 (`npm test category 1`)
- 🔌 Supabase 연결 확인
- 🏗️ 코드 문법 검증 (`npm run validate`)

#### **배포 조건:**
- ✅ 모든 테스트 통과 시에만 배포
- ✅ main 브랜치 푸시 시에만 실행
- ✅ GitHub Secrets 환경변수 필요

### **🔧 GitHub Secrets 설정**

GitHub 저장소 Settings → Secrets에서 다음 변수 추가:

| Secret Name | 설명 | 예시 |
|-------------|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase 익명 키 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `RENDER_DEPLOY_HOOK` | Render.com 배포 Hook URL | `https://api.render.com/deploy/srv-xxx` |
| `RENDER_APP_URL` | 배포된 앱 URL (헬스체크용) | `https://your-app.onrender.com` |

### **🌐 Render.com 배포**

#### **1. Render.com 설정**

1. [Render.com](https://render.com)에서 새 Web Service 생성
2. GitHub 저장소 연결: `hwangjun/algumon-crawler`
3. 배포 설정:
   ```
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   Plan: Free
   Health Check Path: /health
   ```

#### **2. 환경변수 설정**

Render.com Environment 탭에서:
```bash
SUPABASE_URL=https://lywpfaklcxbtjixmnjfg.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
NODE_ENV=production
CRAWL_INTERVAL=300
```

#### **3. Deploy Hook 설정**

1. Render.com Settings → Deploy Hook 생성
2. 생성된 URL을 GitHub Secrets의 `RENDER_DEPLOY_HOOK`에 추가

#### **4. 자동 배포 테스트**

```bash
git add .
git commit -m "테스트 자동 배포"
git push origin main
```

GitHub Actions 탭에서 실행 상태 확인 가능

## 🔧 개발 가이드

### 새 크롤링 패턴 추가

1. `src/crawler.js`의 `extractDealFromElement` 함수 수정
2. 새로운 선택자 패턴 추가
3. 테스트 실행으로 검증

### 가격 추출 개선

1. `src/crawler.js`의 `extractPrice` 함수 수정
2. 새로운 정규식 패턴 추가
3. 가격 범위 검증 로직 조정

### 카테고리 추가

1. `CATEGORIES` 객체에 새 카테고리 추가
2. URL 패턴 확인 및 수정
3. 테스트 실행

## 📊 모니터링

### 로그 확인
```bash
# Render.com 로그
# 대시보드에서 실시간 로그 확인

# 로컬 개발 로그
npm run dev
```

### API 상태 확인
```bash
curl https://your-app-name.onrender.com/status
```

## 🤝 hotdeal-nextjs 연동

### 1. 동일한 Supabase 프로젝트 사용
두 프로젝트가 같은 `hotdeals` 테이블을 공유합니다.

### 2. 데이터 포맷 호환성
알구몬 크롤러는 기존 테이블 스키마와 호환되는 형태로 데이터를 저장합니다.

### 3. 추가 필드
- `algumon_category`: 알구몬 카테고리 ID
- `site_name`: 원본 사이트명
- `mall_name`: '알구몬' 고정

## 💡 최적화 팁

### Render.com 무료 플랜
- 15분 비활성 후 슬립 모드
- 헬스체크로 서버 활성 상태 유지
- 메모리 512MB 제한

### 크롤링 성능
- 병렬 처리로 속도 향상
- 타임아웃 설정으로 안정성 확보
- 에러 시 개별 카테고리만 실패

### 데이터베이스
- 중복 방지로 저장 공간 절약
- 주기적 정리로 성능 유지

## ⚠️ 주의사항

1. **Rate Limiting**: 알구몬 서버에 과부하 방지
2. **메모리 관리**: Render.com 512MB 제한
3. **에러 처리**: 개별 카테고리 실패가 전체에 영향 없음
4. **데이터 품질**: 중복 제거 및 유효성 검증

## 🤝 기여하기

1. Fork 프로젝트
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 📄 라이선스

MIT License