// supabase-client.js
let sb = null;

try {
  if (typeof supabase !== 'undefined' && SUPABASE_CONFIG && SUPABASE_CONFIG.url) {
    sb = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log("Supabase initialized successfully!");
  } else {
    console.error("Supabase library or CONFIG is missing.");
  }
} catch (err) {
  console.error("Error initializing Supabase:", err);
}
