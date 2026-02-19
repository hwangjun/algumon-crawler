# 🔧 Render 배포 에러 해결 가이드

## 🚨 에러 상황
```bash
Error: Cannot find module 'express'
Start Command: node src/index.js  # ❌ 잘못된 파일
```

## ✅ 해결 방법

### **1단계: Render 대시보드 설정 변경**
1. [Render Dashboard](https://dashboard.render.com) 로그인
2. **algumon-crawler** 서비스 클릭
3. **Settings** 탭 클릭
4. **Build & Deploy** 섹션 찾기

### **2단계: Start Command 수정**
```bash
# 현재 잘못된 설정 ❌
Start Command: node src/index.js

# 올바른 설정 ✅ (둘 중 하나 선택)
Start Command: npm start
# 또는
Start Command: node src/index-v2.js
```

### **3단계: 설정 저장 및 재배포**
1. **Save Changes** 클릭
2. **Manual Deploy** → **Deploy latest commit** 클릭
3. 배포 로그에서 정상 시작 확인

## 📊 올바른 설정 확인

### **package.json 설정 (이미 올바름)**
```json
{
  "main": "src/index-v2.js",
  "scripts": {
    "start": "node src/index-v2.js"
  },
  "dependencies": {
    "express": "^4.18.2"  // ✅ Express 포함됨
  }
}
```

### **render.yaml 설정 (이미 올바름)**
```yaml
services:
  - type: web
    name: algumon-crawler
    startCommand: npm start  # ✅ 올바른 명령어
```

## 🔍 에러 원인 분석

### **문제 1: 잘못된 파일**
- ❌ `src/index.js` (존재하지만 v1 버전)
- ✅ `src/index-v2.js` (현재 메인 파일)

### **문제 2: Express 모듈**
- Express는 package.json에 있음
- `npm install` 시 설치됨
- 하지만 잘못된 파일을 실행하면 에러 발생

## 🧪 로컬 테스트

### **올바른 실행 방법**
```bash
# 방법 1: npm start (권장)
npm start

# 방법 2: 직접 실행
node src/index-v2.js

# 잘못된 방법 ❌
node src/index.js
```

### **로컬 테스트 결과**
```bash
✅ npm start → 정상 시작
✅ node src/index-v2.js → 정상 시작
❌ node src/index.js → Express 에러 발생 가능
```

## 🎯 Render 설정 Best Practices

### **권장 설정**
```yaml
Build Command: npm install --only=production
Start Command: npm start  # package.json scripts 활용
```

### **대안 설정**
```yaml
Build Command: npm ci --only=production
Start Command: node src/index-v2.js  # 직접 파일 실행
```

## 📈 배포 성공 확인

### **성공 로그 예시**
```bash
🛒 알구몬 크롤링 서버 v2 시작...
✅ Supabase 연결 테스트 성공
🔄 캐시 로딩 시도 중...
✅ Supabase 연결 및 캐시 로딩 성공
⏰ 크론 작업 등록 중...
✅ 크론 작업 등록 완료
🚀 서버가 포트 3000에서 실행 중입니다
```

### **Health Check 확인**
```bash
# 배포 완료 후 테스트
curl https://your-service.onrender.com/health

# 예상 응답
{
  "status": "healthy",
  "service": "algumon-crawler",
  "version": "2.1.0"
}
```

## 🚨 문제 해결

### **여전히 Express 에러가 나는 경우**
1. **Build Command 확인**
   ```yaml
   Build Command: npm install --only=production
   ```

2. **Node.js 버전 확인**
   - Render는 Node.js 18+ 사용
   - package.json에 engines 추가 권장:
   ```json
   "engines": {
     "node": ">=18.0.0"
   }
   ```

3. **캐시 클리어**
   - Render Dashboard → Settings → Clear Build Cache

### **배포가 계속 실패하는 경우**
1. **로그 확인**
   - Render Dashboard → Logs 탭
   - 실시간 배포 로그 확인

2. **로컬 테스트**
   ```bash
   npm install
   npm start
   # 로컬에서 정상 작동 확인 후 배포
   ```

## 🎊 최종 체크리스트

### **Render 설정 확인**
- [ ] Start Command: `npm start` 또는 `node src/index-v2.js`
- [ ] Build Command: `npm install --only=production`
- [ ] 환경변수: SUPABASE_URL, SUPABASE_ANON_KEY 설정됨
- [ ] 포트: 자동 할당 (PORT 환경변수)

### **배포 성공 확인**
- [ ] 배포 로그에서 "서버가 포트 3000에서 실행 중" 메시지
- [ ] Service URL 접속 가능
- [ ] `/health` 엔드포인트 응답 정상
- [ ] 첫 번째 크롤링 성공 확인

**🎉 이제 정상적으로 배포될 것입니다!**