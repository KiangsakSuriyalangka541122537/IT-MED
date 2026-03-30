import { createClient } from '@supabase/supabase-js';

// Fallback to provided keys if environment variables are missing (common on initial Vercel deploy)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://okeyxsiqxuzimyfwojlu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZXl4c2lxeHV6aW15Zndvamx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDE4OTQsImV4cCI6MjA4NTMxNzg5NH0.NVpRclwEWDkYLo_WwgYSGcTHrIAyh1JCCreIiMT5z6Y';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Using fallback Supabase credentials. For better security, please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
