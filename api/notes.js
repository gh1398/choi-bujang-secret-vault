import { createClient } from '@supabase/supabase-js';

const SAMPLE_NOTES = [
  { title: '과제', content: '실습용 가상 과제 기록' },
  { title: '포트폴리오', content: '실습용 가상 포트폴리오 기록' },
  { title: '아침 리추얼', content: '실습용 가상 리추얼 기록' },
  { title: '훈련 행정 자료', content: '실습용 가상 행정 기록' },
];

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
  }

  try {
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase
      .from('learning_notes')
      .select('owner_id, title, content')
      .is('owner_id', null);
    if (error) return response.status(502).json({ error: 'NOTES_UNAVAILABLE' });

    const stored = new Map((data || []).map((note) => [note.title, note.content]));
    const notes = SAMPLE_NOTES.filter((sample) => stored.get(sample.title) === sample.content);
    return response.status(200).json({ sampleMarker: 'SAMPLE_NOTE_1', notes });
  } catch {
    return response.status(500).json({ error: 'NOTES_UNAVAILABLE' });
  }
}