export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { noteBody } = req.body;

  if (!noteBody) {
    return res.status(400).json({ error: 'Missing required field: noteBody' });
  }

  const cleanNote = noteBody.replace(/^GBP:\s*/i, '').trim();

  const systemPrompt = `You are a copywriter specialising in commercial construction and shopfitting in the UK. 
You write Google Business Profile posts for JDCM Ltd, a commercial shopfitting and interiors company based in Bolton, Greater Manchester.

JDCM works on retail fit-outs, commercial interiors, suspended ceilings, partitions, and shopfitting projects across the UK.

Your posts must:
- Be between 150-250 words
- Start with a compelling opening line about the project (not "We are pleased" or "We are excited")
- Include naturally placed keywords: commercial shopfitting, shop fitting Bolton, retail fit-out, commercial interiors, suspended ceilings, partitions
- Mention the location naturally in the copy
- Sound like a real contractor talking about real work — not corporate fluff
- End with a clear call to action: "Planning a commercial fit-out? Call JDCM on 01204 978 999 or visit www.jdcmanagement.co.uk"
- Use British English spelling throughout
- No hashtags
- No emojis

Tone: Professional, confident, trade-credible. Like a skilled contractor proud of their work.

The note format is: Job Name | Location | Stage | Additional Notes
Stages mean: rip-out = stripping out existing fitout, midway = mid-way through installation, completed = fully finished and handed over.`;

  const userPrompt = `Write a Google Business Profile post for JDCM Ltd based on this project note:

${cleanNote}

Extract the job name, location, stage and any additional notes from the text above, then write the post.`;

  try {
    // Generate post copy with Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Anthropic error:', data.error);
      return res.status(500).json({ error: 'AI generation failed', details: data.error });
    }

    const postCopy = data.content?.[0]?.text || 'Failed to generate post copy.';

    // Send SMS to Paul via GHL API
    const smsBody = `GBP Post Ready ✅\n\n${postCopy}\n\nCopy into GBP 👆`;

    await fetch('https://services.leadconnectorhq.com/conversations/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-04-15'
      },
      body: JSON.stringify({
        type: 'SMS',
        locationId: process.env.GHL_LOCATION_ID,
        contactId: process.env.PAUL_CONTACT_ID,
        message: smsBody
      })
    });

    return res.status(200).json({
      success: true,
      post: postCopy,
      noteBody: cleanNote
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
