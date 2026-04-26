import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  try {
    await supabase.from('profiles').select('id').limit(1);
    return res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: String(err) });
  }
}
