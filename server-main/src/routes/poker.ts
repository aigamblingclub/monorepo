import { currentStatePoker } from '@/utils/poker-state';
import { Router } from 'express';

const router = Router();

router.post('/start', async (req: any, res: any) => {
  if (!process.env.API_KEY && req.headers['API-KEY'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  } 

  const response = await fetch(`${process.env.POKER_API_URL}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      _tag: 'Request',
      id: `${Date.now()}`,
      tag: 'startGame',
      payload: {},
      traceId: 'traceId',
      spanId: 'spanId',
      sampled: true,
      headers: {},
    }),
  });
  try {
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start game', errorMessage: error });
  }
});

router.get('/current-state', async (req, res) => {
  if (!process.env.API_KEY && req.headers['API-KEY'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!currentStatePoker) {
    return res.status(404).json({ error: 'No current state found yet.' });
  }
  res.json(currentStatePoker);
});

export default router;