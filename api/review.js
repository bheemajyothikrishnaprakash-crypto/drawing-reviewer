export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in environment variables' });
  }

  const { contentBlock, prompt } = req.body;

  if (!contentBlock || !prompt) {
    return res.status(400).json({ error: 'Missing contentBlock or prompt' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic error: ' + JSON.stringify(data) });
    }

    const raw = data.content.map(i => i.text || '').join('');

    // Extract JSON from the response - handle various formats
    let jsonStr = raw;
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    // Find JSON object boundaries
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'No JSON found in response. Raw: ' + raw.substring(0, 200) });
    }
    
    jsonStr = jsonStr.substring(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(500).json({ error: 'JSON parse failed: ' + parseErr.message + '. Raw: ' + raw.substring(0, 200) });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: 'Exception: ' + e.message });
  }
}
