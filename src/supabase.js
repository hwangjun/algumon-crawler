/**
 * 🗄️ Supabase 데이터베이스 연결
 * - 기존 hotdeal-nextjs와 동일한 DB 사용
 * - 중복 방지 로직
 * - 알구몬 전용 데이터 포맷
 */

const { createClient } = require('@supabase/supabase-js');

let supabase = null;

/**
 * 🔗 Supabase 초기화
 */
async function initSupabase() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase 환경변수 필요: SUPABASE_URL, SUPABASE_ANON_KEY');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    
    // 연결 테스트 (hotdeal-nextjs와 동일한 deals 테이블 사용)
    const { data, error } = await supabase
      .from('deals')
      .select('id')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // 빈 테이블은 괜찮음
      throw error;
    }

    console.log('✅ Supabase 연결 테스트 성공');
    return supabase;

  } catch (error) {
    console.error('❌ Supabase 초기화 실패:', error);
    throw error;
  }
}

/**
 * 💾 알구몬 딜 저장
 */
async function saveAlgumonDeal(dealData) {
  try {
    if (!supabase) {
      throw new Error('Supabase 초기화 필요');
    }

    // URL 기반 중복 확인
    const { data: existing, error: checkError } = await supabase
      .from('deals')
      .select('id, title')
      .eq('url', dealData.url)
      .limit(1);

    if (checkError) {
      console.error('❌ 중복 확인 실패:', checkError);
      return { success: false, error: checkError };
    }

    // 중복 딜 건너뛰기
    if (existing && existing.length > 0) {
      console.log(`⏭️  중복 딜 건너뛰기: ${dealData.title}`);
      return { 
        success: true, 
        skipped: true, 
        reason: 'duplicate',
        existingId: existing[0].id 
      };
    }

    // 알구몬 딜 데이터 포맷
    const formattedDeal = {
      id: dealData.id,
      title: dealData.title,
      price: dealData.price,
      original_price: dealData.original_price || dealData.price,
      discount_rate: dealData.discount_rate || 0,
      has_price: dealData.has_price,
      price_text: dealData.price_text,
      mall_name: '알구몬',
      mall_logo: '🛒',
      category: dealData.category || 'general',
      image_url: dealData.image_url || '',
      tags: dealData.tags || [],
      url: dealData.url,
      description: dealData.description || '',
      pub_date: dealData.pub_date || new Date().toISOString(),
      source: 'Crawler-알구몬',
      delivery_info: dealData.delivery_info || '원문 확인',
      created_at: new Date().toISOString(),
      crawled_at: new Date().toISOString(),
      
      // 알구몬 전용 필드
      algumon_category: dealData.algumon_category,
      site_name: dealData.site_name,
      deal_score: dealData.deal_score
    };

    // 새 딜 저장
    const { data: inserted, error: insertError } = await supabase
      .from('deals')
      .insert([formattedDeal])
      .select()
      .single();

    if (insertError) {
      console.error('❌ 딜 저장 실패:', insertError);
      return { success: false, error: insertError };
    }

    console.log(`✅ 알구몬 딜 저장: ${dealData.title}`);
    return { 
      success: true, 
      inserted: true, 
      data: inserted 
    };

  } catch (error) {
    console.error('❌ saveAlgumonDeal 에러:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔢 알구몬 딜 개수 조회
 */
async function getAlgumonDealCount() {
  try {
    const { count, error } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('mall_name', '알구몬');

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('❌ getAlgumonDealCount 에러:', error);
    return 0;
  }
}

/**
 * 📊 알구몬 크롤링 통계
 */
async function getAlgumonStats() {
  try {
    // 오늘 수집한 알구몬 딜 수
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayCount, error: todayError } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('mall_name', '알구몬')
      .gte('created_at', today.toISOString());

    if (todayError) throw todayError;

    // 카테고리별 통계
    const { data: categoryStats, error: categoryError } = await supabase
      .from('deals')
      .select('algumon_category')
      .eq('mall_name', '알구몬')
      .gte('created_at', today.toISOString());

    if (categoryError) throw categoryError;

    const categoryCounts = {};
    categoryStats?.forEach(item => {
      if (item.algumon_category) {
        categoryCounts[item.algumon_category] = (categoryCounts[item.algumon_category] || 0) + 1;
      }
    });

    // 총 알구몬 딜 수
    const totalCount = await getAlgumonDealCount();

    return {
      success: true,
      todayCount: todayCount || 0,
      totalCount,
      categoryCounts,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ getAlgumonStats 에러:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🧹 오래된 알구몬 딜 정리 (7일 이상)
 */
async function cleanupOldAlgumonDeals() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('deals')
      .delete()
      .eq('mall_name', '알구몬')
      .lt('created_at', sevenDaysAgo.toISOString())
      .select();

    if (error) throw error;

    const deletedCount = data ? data.length : 0;
    if (deletedCount > 0) {
      console.log(`🧹 ${deletedCount}개 오래된 알구몬 딜 정리 완료`);
    }

    return { success: true, deletedCount };
  } catch (error) {
    console.error('❌ cleanupOldAlgumonDeals 에러:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔍 특정 카테고리 딜 조회
 */
async function getAlgumonDealsByCategory(categoryId) {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('mall_name', '알구몬')
      .eq('algumon_category', categoryId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('❌ getAlgumonDealsByCategory 에러:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initSupabase,
  saveAlgumonDeal,
  getAlgumonDealCount,
  getAlgumonStats,
  cleanupOldAlgumonDeals,
  getAlgumonDealsByCategory
};