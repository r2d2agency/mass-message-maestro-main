import { query } from '../db.js';

const buildMessagesFromTemplate = (items, contactName) => {
  if (!items || !Array.isArray(items)) return [];

  const name = contactName || '';
  const replaceVariables = (text) => {
    if (!text) return '';
    return text.replace(/\{\{nome\}\}/gi, name);
  };

  const messages = [];

  for (const item of items) {
    if (!item || !item.type) continue;

    if (item.type === 'text') {
      const text = replaceVariables(item.content || '');
      if (text.trim()) {
        messages.push({ kind: 'text', text });
      }
    } else {
      const mediaUrl = item.mediaUrl || item.mediaURL || item.url || '';
      const caption = replaceVariables(item.caption || '');
      if (mediaUrl) {
        messages.push({
          kind: item.type,
          mediaUrl,
          caption: caption || '',
        });
      } else if (caption.trim()) {
        messages.push({ kind: 'text', text: caption });
      }
    }
  }

  return messages;
};

const sendMessagesViaEvolution = async (connection, phone, messageItems, contactName) => {
  const messages = buildMessagesFromTemplate(messageItems, contactName);

  if (messages.length === 0) {
    throw new Error('Template de mensagem vazio');
  }

  const apiUrl = connection.api_url.replace(/\/$/, '');
  const apiKey = connection.api_key;
  const instanceName = connection.instance_name;

  for (const msg of messages) {
    if (msg.kind === 'text') {
      const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: phone,
          text: msg.text,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Evolution API error (${response.status}): ${body || 'failed to send text'}`
        );
      }
    } else if (
      msg.kind === 'image' ||
      msg.kind === 'video' ||
      msg.kind === 'audio'
    ) {
      if (!msg.mediaUrl) {
        continue;
      }

      console.log(`Sending media to ${phone}: ${msg.mediaUrl} (Type: ${msg.kind})`);

      const response = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: phone,
          mediatype: msg.kind,
          caption: msg.caption || undefined,
          media: msg.mediaUrl,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Evolution API sendMedia error (${response.status}): ${body || 'failed to send media'}`
        );
      }
    }
  }

  return true;
};

let isRunning = false;

export const startWorker = () => {
  console.log('👷 Message Worker started...');

  // Run every 10 seconds
  setInterval(async () => {
    if (isRunning) {
      console.log('Worker still running, skipping cycle...');
      return;
    }

    isRunning = true;
    try {
      // 1. Fetch pending messages that are due
      // We limit to 20 to avoid clogging if there's a backlog
      const res = await query(`
        SELECT cm.*, 
               c.connection_id, 
               c.message_id,
               conn.api_url, conn.api_key, conn.instance_name,
               mt.items as message_items,
               ct.name as contact_name
        FROM campaign_messages cm
        JOIN campaigns c ON cm.campaign_id = c.id
        JOIN connections conn ON c.connection_id = conn.id
        JOIN message_templates mt ON c.message_id = mt.id
        LEFT JOIN contacts ct ON cm.contact_id = ct.id
        WHERE cm.status = 'pending' 
          AND cm.scheduled_for <= NOW()
          AND c.status IN ('running', 'pending')
        ORDER BY cm.scheduled_for ASC
        LIMIT 20
      `);

      if (res.rows.length === 0) {
        isRunning = false;
        return;
      }

      console.log(`Processing ${res.rows.length} due messages...`);

      // 2. Process each message
      for (const msg of res.rows) {
        try {
            // Update status to 'processing' to prevent double sends if worker overlaps (unlikely with single thread but good practice)
            // Or just do it optimistically. 
            // Better: 'processing' state.
            await query('UPDATE campaign_messages SET status = $1 WHERE id = $2', ['processing', msg.id]);

            await sendMessagesViaEvolution(
              {
                api_url: msg.api_url,
                api_key: msg.api_key,
                instance_name: msg.instance_name,
              },
              msg.phone,
              msg.message_items,
              msg.contact_name
            );

            await query(
                'UPDATE campaign_messages SET status = $1, sent_at = NOW() WHERE id = $2', 
                ['sent', msg.id]
            );
            // Update campaign stats
            await query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [msg.campaign_id]);

        } catch (err) {
            console.error(`Failed to send message ${msg.id}:`, err);
            await query(
                'UPDATE campaign_messages SET status = $1, error_message = $2 WHERE id = $3', 
                ['failed', err.message, msg.id]
            );
            await query('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1', [msg.campaign_id]);
        }
      }

    } catch (error) {
      console.error('Worker error:', error);
    } finally {
      isRunning = false;
    }
  }, 10000); // 10 seconds
};
