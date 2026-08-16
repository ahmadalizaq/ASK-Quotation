// إعدادات الاتصال بقاعدة البيانات (Supabase)
// اربط مشروعك من هنا — شوف SETUP.md للخطوات الكاملة.
const SUPABASE_CONFIG = {
  url: "https://exoqrqndxzqibxwmsebv.supabase.co/",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b3FycW5keHpxaWJ4d21zZWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDg2NTMsImV4cCI6MjEwMjI4NDY1M30.uBMp6_k8IHCN-gscpKcPsMqlwf03g-b4C2wGbJHCWpg"
};

const supabaseReady = !SUPABASE_CONFIG.url.includes('YOUR_');
