const SUPABASE_URL = "https://vkkzcgwmrakqovtglftg.supabase.co";
const SUPABASE_KEY = "sb_publishable_5xs217NJ0yzjBQwTtOQYcw_dDd475tn";

// Initialize Supabase and make it available to other scripts
window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
