# 🔍 Render 배포 확인 체크리스트

## 1단계: Render Dashboard 확인

### **배포 성공 확인**
- [ ] **Events 탭**: "Deploy succeeded" 메시지
- [ ] **Logs 탭**: 에러 없이 서버 시작 로그 확인
- [ ] **Service Status**: "Live" 상태

### **환경변수 확인**  
- [ ] **SUPABASE_SERVICE_ROLE_KEY**: 설정됨 ✅
- [ ] **SUPABASE_URL**: 설정됨 ✅
- [ ] **NODE_ENV**: production ✅

---

## 2단계: 서비스 엔드포인트 테스트

### **Service URL 확인**
Render Overview에서 Service URL 복사 후 테스트:

#### **🏥 Health Check (필수)**
```bash
GET https://your-service.onrender.com/health

# 성공 응답 예시:
{
  "status": "healthy",
  "service": "algumon-crawler", 
  "version": "2.1.0",
  "uptime": 123
}
```

#### **🏓 Ping Test (Sleep 방지)**
```bash
GET https://your-service.onrender.com/ping

# 성공 응답:
pong
```

#### **📊 Status Check**
```bash  
GET https://your-service.onrender.com/status-check

# 성공 응답:
{
  "service": "operational",
  "status": "up"
}
```

#### **🏠 Main Service**
```bash
GET https://your-service.onrender.com/

# 성공 응답:
{
  "service": "🛒 알구몬 크롤링 서버 v2",
  "status": "running"
}
```

---

## 3단계: RLS 문제 해결 확인

### **서버 시작 로그에서 확인해야 할 메시지**
```bash
✅ 성공적인 시작:
🛒 알구몬 크롤링 서버 v2 시작...
✅ Supabase 연결 테스트 성공  
✅ Supabase 연결 및 캐시 로딩 성공
🚀 서버가 포트 3000에서 실행 중입니다

❌ RLS 문제가 있다면:
❌ Supabase 연결 실패: [에러 메시지]
❌ Permission denied...
```

### **첫 크롤링 성공 확인 (5분 후)**
Logs에서 다음 메시지 확인:
```bash
🚀 크롤링 시작 #1 (ID: xxxxxxxxx)
📊 크롤링 완료: XX개 딜, 6/6 카테고리 성공
💾 Supabase 저장 시작...
✅ 저장 완료: XX개 저장, XX개 중복  ← 이 메시지가 중요!
```

---

## 4단계: UptimeRobot 모니터링 추가

### **UptimeRobot 설정** (배포 성공 후)
1. [UptimeRobot.com](https://uptimerobot.com) 가입
2. **Add New Monitor** 클릭
3. 4개 엔드포인트 모니터 추가:

| 엔드포인트 | 간격 | 키워드 | 목적 |
|-----------|------|--------|------|
| `/ping` | 1분 | "pong" | Sleep 방지 |
| `/health` | 5분 | "healthy" | 상태 체크 |
| `/status-check` | 10분 | "operational" | 서비스 상태 |
| `/` | 15분 | "알구몬" | 메인 서비스 |

---

## 5단계: 문제 해결

### **Cold Start 지연 (정상)**
- 첫 요청 시 10-15초 지연: 정상 (Render Free Tier)
- UptimeRobot ping으로 Warm 상태 유지됨

### **SERVICE_ROLE_KEY 문제**
```bash
❌ 만약 여전히 permission denied:
1. Supabase Dashboard → Settings → API → service_role key 다시 복사
2. Render → Environment Variables → SUPABASE_SERVICE_ROLE_KEY 확인
3. Manual Deploy 재실행
```

### **환경변수 미반영**
```bash
❌ 환경변수가 반영되지 않았다면:
1. Render → Settings → Environment Variables 재확인
2. Save Changes 후 Manual Deploy 실행
3. 기존 인스턴스 완전 재시작 필요
```

---

## 성공 지표

### **✅ 배포 성공 확인**
- [ ] Health Check: "healthy" 응답
- [ ] Ping: "pong" 응답  
- [ ] Status Check: "operational" 응답
- [ ] Main: 서비스 정보 JSON 응답

### **✅ 크롤링 성공 확인**
- [ ] 첫 크롤링 완료 (5분 후)
- [ ] "저장 완료: XX개 저장" 메시지
- [ ] RLS 권한 에러 없음

### **✅ 모니터링 설정 완료**
- [ ] UptimeRobot 4개 모니터 추가
- [ ] 알림 연락처 설정
- [ ] Sleep 방지 핑 작동

---

## 응급 상황 대응

### **서비스가 응답하지 않는 경우**
1. Render Logs에서 에러 확인
2. Manual Deploy 재실행
3. 환경변수 재확인

### **RLS 권한 문제 지속**
1. SERVICE_ROLE_KEY 올바른지 재확인
2. Supabase Dashboard에서 RLS 정책 확인
3. 로컬에서 동일한 키로 테스트

**🎯 모든 체크포인트 통과시: 24/7 무중단 알구몬 크롤러 완성!** 🚀