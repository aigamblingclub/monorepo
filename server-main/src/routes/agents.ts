import express from 'express';
import { ELIZA_AGENT_API_URL } from '../utils/env';

const router = express.Router();

/**
 * @swagger
 * /api/agents/{id}:
 *   post:
 *     summary: Create or update an agent
 *     description: Forwards a request to the Eliza agent management API to create or update an agent's configuration.
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the agent to create or update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: The agent's character configuration.
 *     responses:
 *       200:
 *         description: Agent configuration successfully forwarded.
 *       500:
 *         description: Internal server error or error forwarding the request.
 */
router.post('/:id', async (req, res) => {
  const { id } = req.params;
  const agentConfig = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Agent ID is required' });
  }

  try {
    const elizaApiUrl = `${ELIZA_AGENT_API_URL}/agents/${id}/set`;
    console.log(`Forwarding agent creation request to: ${elizaApiUrl}`);

    const response = await fetch(elizaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error from Eliza API: ${response.status} ${response.statusText}`, errorBody);
      return res.status(response.status).json({
        error: 'Failed to forward request to Eliza agent API',
        details: errorBody,
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error forwarding agent request to Eliza:', error);
    res.status(500).json({ error: 'Internal server error while contacting Eliza agent API' });
  }
});

export default router; 