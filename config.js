// إعدادات الاتصال بقاعدة البيانات (Supabase)
// اربط مشروعك من هنا — شوف SETUP.md للخطوات الكاملة.
const SUPABASE_CONFIG = {
  url: "https://exoqrqndxzqibxwmsebv.supabase.co",
  anonKey: "sb_publishable_63uE0FwQCr8oiUugXPksJw_gzUbXL_e"
};

const supabaseReady = !SUPABASE_CONFIG.url.includes('YOUR_');
