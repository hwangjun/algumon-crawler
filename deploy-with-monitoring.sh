#!/bin/bash

# 🚀 Render + UptimeRobot 자동 배포 스크립트
# 알구몬 크롤러 24/7 모니터링 설정

echo "🚀 Render + UptimeRobot 배포 시작..."
echo "=================================================="

# 1. Git 상태 확인
echo "📊 Git 상태 확인 중..."
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  커밋되지 않은 변경사항 발견"
    echo "📝 자동 커밋 중..."
    git add .
    git commit -m "🚀 Render + UptimeRobot 배포 준비

✅ 최적화된 Health Check 엔드포인트:
- /health: 상세 상태 정보 (UptimeRobot Keyword: 'healthy')
- /ping: 초경량 핑 엔드포인트 (Sleep 방지용)
- /status-check: 서비스 상태 체크 (Keyword: 'operational')

🔧 UptimeRobot 최적화:
- Cache-Control 헤더 설정
- X-Health-Check 커스텀 헤더
- Keyword 모니터링 지원
- 응답 시간 최적화

📚 완전한 설정 가이드:
- UPTIMEROBOT_SETUP.md: 단계별 설정 가이드
- render-uptimerobot.yaml: 최적화된 Render 설정"
fi

echo "📤 GitHub에 푸시 중..."
git push origin main

# 2. Render URL 확인
echo ""
echo "🌐 Render 서비스 URL 확인..."
echo "Render 대시보드에서 서비스 URL을 확인하세요:"
echo "https://dashboard.render.com"
echo ""
echo "예상 URL: https://algumon-crawler-[random].onrender.com"

# 3. Health Check 엔드포인트 목록
echo ""
echo "🔍 UptimeRobot 모니터링 엔드포인트:"
echo "=================================================="
echo "1. 🏥 Health Check (메인)"
echo "   URL: https://your-service.onrender.com/health"  
echo "   간격: 1분 (Sleep 방지)"
echo "   키워드: 'healthy'"
echo ""
echo "2. 🏓 Ping (경량)"
echo "   URL: https://your-service.onrender.com/ping"
echo "   간격: 1분 (Sleep 방지)"
echo "   키워드: 'pong'"
echo ""
echo "3. 📊 Status Check"
echo "   URL: https://your-service.onrender.com/status-check"
echo "   간격: 5분"
echo "   키워드: 'operational'"
echo ""
echo "4. 🏠 Main Service"
echo "   URL: https://your-service.onrender.com/"
echo "   간격: 10분"
echo "   키워드: '알구몬 크롤링 서버'"

# 4. UptimeRobot 설정 안내
echo ""
echo "🤖 UptimeRobot 설정 안내:"
echo "=================================================="
echo "1. https://uptimerobot.com 에서 계정 생성"
echo "2. Add New Monitor 클릭"
echo "3. 위의 엔드포인트들을 하나씩 추가"
echo "4. Keyword Monitoring 활성화"
echo "5. Alert Contacts 설정 (이메일/웹훅)"
echo ""
echo "📚 자세한 가이드: UPTIMEROBOT_SETUP.md"

# 5. 배포 체크리스트
echo ""
echo "✅ 배포 후 체크리스트:"
echo "=================================================="
echo "□ Render 배포 성공 확인"
echo "□ Service URL 접속 테스트" 
echo "□ /health 엔드포인트 응답 확인"
echo "□ /ping 엔드포인트 응답 확인"
echo "□ UptimeRobot 모니터 4개 추가"
echo "□ 키워드 모니터링 설정"
echo "□ 알림 연락처 추가"
echo "□ 첫 번째 크롤링 성공 확인"

# 6. 테스트 스크립트
echo ""
echo "🧪 로컬 테스트:"
echo "=================================================="
echo "npm run validate  # 구문 검증"
echo "npm start         # 로컬 서버 실행"
echo "curl http://localhost:3000/health  # Health Check 테스트"

echo ""
echo "🎉 배포 스크립트 완료!"
echo "다음 단계: Render 대시보드에서 배포 상태를 확인하세요."