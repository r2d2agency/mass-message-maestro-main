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

    const minDelay = campaign.min_delay || 90;
    const maxDelay = campaign.max_delay || 300;

    const safeMinDelay = Math.max(minDelay, 10);
    const safeMaxDelay = Math.max(maxDelay, safeMinDelay + 5);

    const batchSize = 20;
    let messagesInBatch = 0;

    console.log(
      `Scheduling ${contacts.length} messages starting at ${nextTime.toISOString()} with delay ${safeMinDelay}-${safeMaxDelay}s and 10min pause every ${batchSize} messages`
    );

    for (const contact of contacts) {
      const delay =
        Math.floor(
          Math.random() * (safeMaxDelay - safeMinDelay + 1)
        ) + safeMinDelay;

      nextTime = new Date(nextTime.getTime() + delay * 1000);

      messagesInBatch += 1;
      if (messagesInBatch >= batchSize) {
        const pauseSeconds = 600;
        nextTime = new Date(nextTime.getTime() + pauseSeconds * 1000);
        messagesInBatch = 0;
        console.log(
          `Adding 10min pause at ${nextTime.toISOString()} after ${batchSize} messages`
        );
      }

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
