import { currentStatePoker } from '@/utils/poker-state';
import { Router } from 'express';
import { SERVER_POKER } from '@/utils/env';

const router = Router();

router.post('/start', async (req: any, res: any) => {
  try {
    const response = await fetch(`${SERVER_POKER}/api`, {
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
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start game', errorMessage: error });
  }
});

router.get('/current-state', async (req, res) => {
  if (!currentStatePoker) {
    return res.status(404).json({ error: 'No current state found yet.' });
  }
  res.json(currentStatePoker);
});

export default router;
