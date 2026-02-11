export default async function handler(req, res) {
  const { centreId, to } = req.query;

  // 1. Robust 'to' handling (Fix #1)
  const destination = Array.isArray(to) ? to[0] : to;

  if (!destination) {
    return res.status(400).json({ error: 'Missing destination URL' });
  }

  // 2. Open-redirect protection (Fix #2)
  try {
    const parsedUrl = new URL(destination);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or restricted destination URL' });
  }

  const webhookUrl = process.env.CLICK_LOG_WEBHOOK_URL;

  // 3. Prepare logging data
  const logData = {
    centreId: centreId || 'unknown',
    destination: destination,
    sourcePage: req.headers['referer'] || '',
    userAgent: req.headers['user-agent'] || '',
    timestamp: new Date().toISOString(),
  };

  // 4. Log to webhook (Non-blocking)
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    }).catch((err) => console.error('Webhook logging failed:', err));
  } else {
    console.warn('CLICK_LOG_WEBHOOK_URL not configured');
  }

  // 5. Immediate Redirect (302)
  res.redirect(302, destination);
}
