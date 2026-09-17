import { createClient } from '@supabase/supabase-js';

// Credenciales del proyecto TURNEADOR
const SUPABASE_URL = 'https://grjrdvdcauygkssbzotr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_X4uYkrubbpe9NXkT3rbC9w_aRHOtcmY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
