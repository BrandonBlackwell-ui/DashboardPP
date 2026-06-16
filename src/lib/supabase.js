import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  'https://svbbhbtllzjhfoqrsaig.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YmJoYnRsbHpqaGZvcXJzYWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTM5MDIsImV4cCI6MjA5NzE4OTkwMn0.joE1Hol5tFa5opPqQMGoCzUpOj1FpB-tklnY1DUFjD4'
);
