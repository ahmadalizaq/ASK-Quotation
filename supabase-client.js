// ينشئ عميل Supabase الوحيد المستخدم بكل الموقع (db.js و app.js يستخدمونه عن طريق المتغير sb)
let sb = null;
window.__sbInitError = null;

if(supabaseReady){
  if(typeof supabase === 'undefined'){
    // مكتبة Supabase-js نفسها ما تحمّلت — لا jsDelivr ولا unpkg نجحوا (على الأغلب حجب شبكة/فايروول)
    window.__sbInitError = 'مكتبة Supabase-js ما وصلت تتحمّل من الإنترنت أصلاً (لا jsDelivr ولا unpkg). '
      + 'افتح أدوات المطوّر (F12) → تبويب Network، حدّث الصفحة، ودوّر على أي طلب لونه أحمر يحتوي "supabase-js" — هذا يوضح إذا الشبكة/الفايروول يحجب الوصول لهذي الروابط.';
  } else {
    try{
      sb = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch(err){
      // غالباً رابط Project URL بملف config.js غير صحيح الصيغة
      window.__sbInitError = 'فشل إنشاء اتصال Supabase — تأكد إن "url" بملف config.js هو Project URL الصحيح '
        + '(مثال: https://xxxxx.supabase.co) بدون أخطاء إملائية. الخطأ التقني: ' + err.message;
      console.error('Supabase createClient error:', err);
    }
  }
}
