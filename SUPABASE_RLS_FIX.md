# 🔐 Supabase RLS 문제 해결 가이드

## 🚨 문제 상황

### **RLS 정책으로 인한 쓰기 실패**
```bash
Error: new row violates row-level security policy for table "deals"
또는
Permission denied for table deals
```

### **원인 분석**
- ✅ **hotdeal-nextjs**: anon key로 **읽기만** → 문제 없음
- ❌ **algumon-crawler**: anon key로 **쓰기 시도** → RLS 차단!

## 📊 현재 RLS 설정 상태

### **supabase-tables.sql의 RLS 정책**
```sql
-- 공개 읽기 정책 (anon key 허용)
CREATE POLICY "Public read access" ON deals FOR SELECT USING (true);

-- 서비스 역할만 쓰기 가능 (service_role key만 허용)
CREATE POLICY "Service role write access" ON deals FOR ALL 
USING (auth.role() = 'service_role');
```

### **현재 키 사용 현황**
```bash
hotdeal-nextjs:    NEXT_PUBLIC_SUPABASE_ANON_KEY → 읽기 ✅
algumon-crawler:   SUPABASE_ANON_KEY → 쓰기 ❌ (RLS 차단)
```

## ⚡ 해결 방법 (권장)

### **1단계: SERVICE_ROLE_KEY 발급**

1. **Supabase Dashboard** 접속
2. **Settings** → **API** 클릭  
3. **Project API keys** 섹션 찾기
4. **service_role** key 복사 (secret, 노출 주의!)

### **2단계: 환경변수 설정**

#### **로컬 개발 (.env)**
```bash
# 🔑 SERVICE_ROLE_KEY 우선 (쓰기 권한)
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Fallback: anon key
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

#### **Render.com 배포**
```bash
Environment Variables:
- SUPABASE_SERVICE_ROLE_KEY: [service_role key 입력]
- SUPABASE_ANON_KEY: [anon key 입력]  # Fallback
```

### **3단계: 코드 수정 완료**
- ✅ `src/supabase-v2.js`: SERVICE_ROLE_KEY 우선 사용하도록 수정됨
- ✅ `.env.example`: SERVICE_ROLE_KEY 가이드 추가됨
- ✅ `render.yaml`: SERVICE_ROLE_KEY 환경변수 추가됨

## 🧪 테스트 및 확인

### **로컬 테스트**
```bash
# 1. 환경변수 설정 후
echo "SUPABASE_SERVICE_ROLE_KEY=your-key" >> .env

# 2. 크롤러 테스트
npm start

# 3. 성공 로그 확인
✅ Supabase 연결 테스트 성공
✅ 0개 deal_id 캐시 로딩 완료
```

### **Render 배포 테스트**
```bash
# 1. 환경변수 설정 후 배포
# 2. Health Check 확인
curl https://your-app.onrender.com/health

# 3. 크롤링 성공 확인 (5분 후)
curl https://your-app.onrender.com/status
```

## 🔧 대안 해결 방법

### **방법 2: RLS 정책 완화 (보안 위험)**
```sql
-- anon key도 쓰기 허용하도록 정책 수정 (권장하지 않음)
CREATE POLICY "Allow anon writes" ON deals FOR ALL 
USING (auth.role() = 'anon' OR auth.role() = 'service_role');
```

### **방법 3: RLS 비활성화 (매우 위험)**
```sql
-- 전체 RLS 비활성화 (절대 권장하지 않음)
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
```

## 🛡️ 보안 Best Practices

### **SERVICE_ROLE_KEY 보안**
- ❌ **절대 금지**: 클라이언트(브라우저)에서 사용
- ❌ **절대 금지**: public 레포지토리에 커밋  
- ❌ **절대 금지**: 로그에 출력
- ✅ **허용**: 서버 환경변수에만 저장
- ✅ **허용**: 백엔드 서비스에서만 사용

### **키 역할 구분**
```bash
anon key:         클라이언트 읽기 (브라우저 노출 OK)
service_role key: 서버 쓰기/관리 (서버에만 저장!)
```

## 📊 RLS 상태 확인 방법

### **Supabase Dashboard에서 확인**
1. **Database** → **Tables** → **deals** 클릭
2. 우측 **RLS** 스위치 확인 (활성화되어 있어야 함)
3. **Policies** 탭에서 정책 목록 확인

### **SQL로 직접 확인**
```sql
-- RLS 활성화 상태 확인
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'deals';

-- 정책 목록 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'deals';
```

## 🎯 완료 체크리스트

### **설정 완료 확인**
- [ ] Supabase Dashboard에서 service_role key 복사
- [ ] 로컬 .env에 SUPABASE_SERVICE_ROLE_KEY 추가
- [ ] Render 환경변수에 SUPABASE_SERVICE_ROLE_KEY 추가  
- [ ] 로컬에서 `npm start` 정상 실행 확인
- [ ] Render 배포 후 /health 엔드포인트 정상 응답 확인

### **보안 확인**
- [ ] service_role key가 Git에 커밋되지 않음 확인
- [ ] service_role key가 로그에 출력되지 않음 확인
- [ ] RLS 정책이 활성화된 상태 유지 확인

### **기능 확인**  
- [ ] hotdeal-nextjs에서 딜 목록 정상 표시
- [ ] algumon-crawler에서 새 딜 저장 성공
- [ ] 5분마다 자동 크롤링 정상 작동

## 🚨 문제 해결

### **여전히 permission denied 에러가 나는 경우**
1. **SERVICE_ROLE_KEY 확인**
   - Supabase Dashboard에서 올바른 키 복사했는지 확인
   - 환경변수명 정확한지 확인: `SUPABASE_SERVICE_ROLE_KEY`

2. **환경변수 반영 확인**
   - Render에서 환경변수 저장 후 재배포 필요
   - 로컬에서 `.env` 파일 확인

3. **RLS 정책 확인**  
   - Supabase Dashboard → Database → Policies
   - "Service role write access" 정책 존재하는지 확인

### **service_role key를 찾을 수 없는 경우**
```bash
# 환경변수 fallback 순서 확인
SUPABASE_SERVICE_ROLE_KEY (최우선) →
SUPABASE_ANON_KEY (fallback) →
NEXT_PUBLIC_SUPABASE_ANON_KEY (최종 fallback)
```

## 🎊 성공 확인

### **정상 작동 로그**
```bash
✅ Supabase 연결 테스트 성공
✅ 0개 deal_id 캐시 로딩 완료 (154ms)
✅ Supabase 연결 및 캐시 로딩 성공
🚀 크롤링 시작 #1 (ID: 1771508234567)
📊 크롤링 완료: 62개 딜, 6/6 카테고리 성공 (2847ms)
💾 Supabase 저장 시작...
✅ 저장 완료: 45개 저장, 17개 중복 (892ms)
```

**🔐 이제 RLS 보안을 유지하면서 정상적인 데이터 저장이 가능합니다!**