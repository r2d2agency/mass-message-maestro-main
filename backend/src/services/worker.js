import { query } from '../db.js';
// import { sendMessage } from '../lib/evolution-api.js'; // Assuming this exists or we need to create it

// Mock sending function for now if lib doesn't exist
const sendMessageMock = async (connection, phone, messageTemplate) => {
  // Logic to call Evolution API would go here
  // We need to implement the actual API call
  console.log(`[Mock] Sending to ${phone} using connection ${connection.instance_name}`);
  return { success: true, messageId: 'mock_id_' + Date.now() };
};

export const startWorker = () => {
  console.log('👷 Message Worker started...');

  // Run every 10 seconds
  setInterval(async () => {
    try {
      // 1. Fetch pending messages that are due
      // We limit to 20 to avoid clogging if there's a backlog
      const res = await query(`
        SELECT cm.*, 
               c.connection_id, 
               c.message_id,
               conn.api_url, conn.api_key, conn.instance_name,
               mt.items as message_items
        FROM campaign_messages cm
        JOIN campaigns c ON cm.campaign_id = c.id
        JOIN connections conn ON c.connection_id = conn.id
        JOIN message_templates mt ON c.message_id = mt.id
        WHERE cm.status = 'pending' 
          AND cm.scheduled_for <= NOW()
          AND c.status IN ('running', 'pending') -- Only process active campaigns
        ORDER BY cm.scheduled_for ASC
        LIMIT 20
      `);

      if (res.rows.length === 0) return;

      console.log(`Processing ${res.rows.length} due messages...`);

      // 2. Process each message
      for (const msg of res.rows) {
        try {
            // Update status to 'processing' to prevent double sends if worker overlaps (unlikely with single thread but good practice)
            // Or just do it optimistically. 
            // Better: 'processing' state.
            await query('UPDATE campaign_messages SET status = $1 WHERE id = $2', ['processing', msg.id]);

            // Call Evolution API
            // TODO: Implement actual call using msg.api_url, msg.api_key, msg.message_items
            // For now, we simulate success
            // const result = await sendMessage(msg, msg.phone, msg.message_items);
            
            // Simulation:
            const success = true; 
            
            if (success) {
                await query(
                    'UPDATE campaign_messages SET status = $1, sent_at = NOW() WHERE id = $2', 
                    ['sent', msg.id]
                );
                // Update campaign stats
                await query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [msg.campaign_id]);
            } else {
                throw new Error('Failed to send');
            }

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
    }
  }, 10000); // 10 seconds
};
