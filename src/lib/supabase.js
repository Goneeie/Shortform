import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kaptpoxnyxuezpkvpjhn.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcHRwb3hueXh1ZXpwa3ZwamhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODM0MjcsImV4cCI6MjA5NDc1OTQyN30.j03viNcqDrAnlZbmuRg-Bt4TWibeeqjGCqiPJkwlWcg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
