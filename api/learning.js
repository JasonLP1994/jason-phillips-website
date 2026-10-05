import { createClient } from '@supabase/supabase-js';
import { makeHandler } from '../lib/learning.js';

export default makeHandler(createClient);
