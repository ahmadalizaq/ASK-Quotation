// إعدادات الاتصال بقاعدة البيانات (Supabase)
// اربط مشروعك من هنا — شوف SETUP.md للخطوات الكاملة.
const SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_URL",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};

const supabaseReady = !SUPABASE_CONFIG.url.includes('YOUR_');
