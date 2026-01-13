import { query } from '../db.js';

/**
 * Schedules messages for a campaign
 * @param {string} campaignId 
 */
export const scheduleCampaign = async (campaignId) => {
  try {
    console.log(`Scheduling campaign ${campaignId}...`);

    // 1. Get campaign details
    const campaignRes = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaignRes.rows.length === 0) throw new Error('Campaign not found');
    const campaign = campaignRes.rows[0];

    // 2. Get contacts
    const contactsRes = await query('SELECT * FROM contacts WHERE list_id = $1', [campaign.list_id]);
    const contacts = contactsRes.rows;
    
    if (contacts.length === 0) {
      console.log('No contacts found for this campaign.');
      return;
    }

    // 3. Scheduling Logic
    // Start from scheduled_at OR now
    let nextTime = campaign.scheduled_at ? new Date(campaign.scheduled_at) : new Date();
    // If scheduled_at is in the past, start now
    if (nextTime < new Date()) nextTime = new Date();

    // Default to user config, but enforce safer minimums if not provided
    // User asked for min 90s, max 5 min (300s)
    const minDelay = campaign.min_delay || 90; 
    const maxDelay = campaign.max_delay || 300; 
    
    // Safety check: ensure minDelay is at least 10s to avoid spam blocks
    // (User requested 90s, so we are good, but good to have a floor)
    const safeMinDelay = Math.max(minDelay, 10);
    const safeMaxDelay = Math.max(maxDelay, safeMinDelay + 10);

    const batchSize = 30 + Math.floor(Math.random() * 20); // Random batch size between 30-50
    let messagesInBatch = 0;

    console.log(`Scheduling ${contacts.length} messages starting at ${nextTime.toISOString()} with delay ${safeMinDelay}-${safeMaxDelay}s`);

    // Prepare insert values
    for (const contact of contacts) {
      // Add random delay for this message
      const delay = Math.floor(Math.random() * (safeMaxDelay - safeMinDelay + 1) + safeMinDelay);
      nextTime = new Date(nextTime.getTime() + delay * 1000);

      // "Human" pause logic: every ~40 messages, pause for 10 minutes
      messagesInBatch++;
      if (messagesInBatch >= batchSize) {
        // Add 10 minutes (600 seconds) + random variance
        const pause = 600 + Math.floor(Math.random() * 60); 
        nextTime = new Date(nextTime.getTime() + pause * 1000);
        messagesInBatch = 0; // Reset batch
        console.log(`Adding pause of ${pause}s at ${nextTime.toISOString()}`);
      }

      // Insert message record
      await query(
        `INSERT INTO campaign_messages 
         (campaign_id, contact_id, phone, status, scheduled_for)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [campaignId, contact.id, contact.phone, nextTime]
      );
    }

    console.log(`Campaign ${campaignId} scheduled successfully. Last message at ${nextTime.toISOString()}`);

  } catch (error) {
    console.error('Error scheduling campaign:', error);
    throw error;
  }
};
