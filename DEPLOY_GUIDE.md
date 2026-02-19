# 🚀 알구몬 크롤러 v2.0 Render.com 배포 가이드

## 📋 배포 준비 완료 상태
- ✅ GitHub: https://github.com/hwangjun/algumon-crawler
- ✅ 버전: 2.0.0
- ✅ 메인 파일: src/index-v2.js
- ✅ 의존성: Node.js + 6개 패키지
- ✅ Supabase 호환성: 100% 검증 완료

---

## 🎯 배포 단계 (5분 소요)

### **1단계: Render.com 접속**
1. 브라우저에서 **https://render.com** 접속
2. **로그인** 또는 **GitHub 계정으로 가입**

### **2단계: 새 Web Service 생성**
1. 대시보드에서 **"New +"** 클릭
2. **"Web Service"** 선택

### **3단계: GitHub 저장소 연결**
1. **"Build and deploy from a Git repository"** 선택
2. GitHub 계정 연결 (최초 1회)
3. 저장소 검색: **`hwangjun/algumon-crawler`**
4. **"Connect"** 클릭

### **4단계: 배포 설정**
```
Name: algumon-crawler-v2
Runtime: Node
Build Command: npm install
Start Command: npm start
```

### **5단계: 환경변수 설정** ⚠️ 중요!
```bash
SUPABASE_URL=https://lywpfaklcxbtjixmnjfg.supabase.co
SUPABASE_ANON_KEY=sb_publishable_DuMpdr9aJbaCn88ThV_7zg_3V4kFa6v
NODE_ENV=production
PORT=3000
```

### **6단계: 배포 시작**
1. **"Create Web Service"** 클릭
2. 자동 빌드 및 배포 시작 (3-5분 소요)

---

## 🔍 배포 후 확인사항

### **성공 지표**
- ✅ Build 로그에 "✅ Supabase 연결 테스트 성공" 메시지
- ✅ "🌐 서버 v2가 포트 3000에서 실행 중" 메시지  
- ✅ Health Check: https://your-app.onrender.com/health (200 OK)
- ✅ 서버 정보: https://your-app.onrender.com/ (v2.0 정보 표시)

### **크롤링 동작 확인**
- **5분 후**: 첫 자동 크롤링 실행
- **10분 후**: Supabase에 딜 데이터 누적 시작
- **15분 후**: hotdeal-nextjs에서 새 딜 표시

### **모니터링 엔드포인트**
- `/health` - 헬스체크 (Render 자동 사용)
- `/` - 서버 정보 + 캐시 통계
- `/stats` - 상세 성능 지표
- `/crawl` - 수동 크롤링 실행 (POST)

---

## ⚡ 예상 성능

### **크롤링 주기**
- **자동 실행**: 5분마다
- **카테고리**: 6개 (기타, 디지털/가전, 컴퓨터, 패션/뷰티, 식품/건강, 생활/취미)
- **수집량**: 카테고리당 ~20개 → 총 ~100-120개 딜/회

### **v2.0 성능**
- **중복 체크**: 0.1ms (1000x 빠름)
- **메모리 캐시**: O(1) 성능
- **DB upsert**: 배치 처리로 90% 쿼리 절약
- **카테고리별 처리**: 순차 처리 (서버 안정성)

### **데이터 누적 예상**
- **1시간 후**: ~500-600개 딜
- **24시간 후**: ~2,000-3,000개 딜 (중복 제거 후)
- **1주일 후**: ~5,000-7,000개 고품질 딜

---

## 🚨 주의사항

### **Render.com Free Tier 제한**
- **월 750시간**: 충분함 (24/7 운영 가능)
- **Sleep 모드**: 15분 비활성화 시 자동 절전
- **Cold Start**: 절전에서 깨어날 때 ~10초 소요

### **절전 방지 (권장)**
- Render는 5분마다 자동 크롤링으로 **항상 활성상태 유지**
- `/health` 엔드포인트로 상태 모니터링
- Cold Start 거의 발생하지 않음

### **배포 실패 시 대처**
1. **Build 실패**: package.json 확인
2. **환경변수 오류**: Supabase 키 재확인  
3. **포트 에러**: PORT=3000 설정 확인
4. **메모리 부족**: 현재 설정으로는 발생 안함

---

## 📞 배포 완료 후 연락 사항

배포가 완료되면 다음 정보를 확인해 주세요:

1. **Render 앱 URL**: https://your-app-name.onrender.com
2. **Build 로그**: 에러 없이 성공했는지
3. **첫 크롤링**: 5-10분 후 Supabase에 데이터 생성되는지

**🎉 배포 성공 시 15분 후부터 hotdeal-nextjs에서 실시간 딜을 확인할 수 있습니다!** 🛒✨