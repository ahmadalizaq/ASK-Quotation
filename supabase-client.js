// ينشئ عميل Supabase الوحيد المستخدم بكل الموقع (db.js و app.js يستخدمونه عن طريق المتغير sb)
let sb = null;

if(supabaseReady){
  sb = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}
