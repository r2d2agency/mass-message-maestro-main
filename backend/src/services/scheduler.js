import { query } from '../db.js';

// Helper: Fisher-Yates shuffle
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const adjustToBusinessHours = (date) => {
  const d = new Date(date);
  const hours = d.getHours();
  
  // Se for antes das 08:00, ajusta para 08:00 do mesmo dia
  if (hours < 8) {
    d.setHours(8, 0, 0, 0);
  }
  // Se for depois das 18:00, ajusta para 08:00 do dia seguinte
  else if (hours >= 18) {
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
  }
  
  return d;
};

async function insertBatch(batch) {
  if (batch.length === 0) return;
  
  const params = [];
  const values = [];
  let paramIndex = 1;
  
  for (const item of batch) {
      values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4})`);
      params.push(item.campaign_id, item.contact_id, item.phone, item.status, item.scheduled_for);
      paramIndex += 5;
  }
  
  const queryStr = `INSERT INTO campaign_messages (campaign_id, contact_id, phone, status, scheduled_for) VALUES ${values.join(',')}`;
  await query(queryStr, params);
}

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
    let contacts = contactsRes.rows;
    
    if (contacts.length === 0) {
      console.log('No contacts found for this campaign.');
      return;
    }

    // Shuffle contacts for random distribution
    contacts = shuffleArray(contacts);

    // 3. Scheduling Logic
    // Start from scheduled_at OR now
    let startTime = campaign.scheduled_at ? new Date(campaign.scheduled_at) : new Date();
    // If scheduled_at is in the past, start now
    if (startTime < new Date()) startTime = new Date();

    let nextTime = new Date(startTime);
    
    // Use delays from campaign (defaulting if missing, though UI enforces them)
    // Removed 10s minimum lock as requested
    let minDelay = campaign.min_delay || 30;
    let maxDelay = campaign.max_delay || 120;

    // Ensure logic consistency
    if (minDelay < 1) minDelay = 1;
    if (maxDelay <= minDelay) maxDelay = minDelay + 1;

    const batchSize = 20;
    const pauseSeconds = 600; // 10 minutes

    let messagesInBatch = 0;

    console.log(
      `Scheduling ${contacts.length} messages starting at ${nextTime.toISOString()} with delay ${minDelay}-${maxDelay}s and 10min pause every ${batchSize} messages (Business Hours 08-18h)`
    );

    const INSERT_BATCH_SIZE = 500;
    let currentBatch = [];

    for (const contact of contacts) {
      // Add random delay BEFORE sending
      const delay =
        Math.floor(
          Math.random() * (maxDelay - minDelay + 1)
        ) + minDelay;

      nextTime = new Date(nextTime.getTime() + delay * 1000);
      nextTime = adjustToBusinessHours(nextTime);

      messagesInBatch += 1;
      
      // Check batch limit for pauses
      if (messagesInBatch >= batchSize) {
        // Add pause
        nextTime = new Date(nextTime.getTime() + pauseSeconds * 1000);
        nextTime = adjustToBusinessHours(nextTime);
        messagesInBatch = 0;
      }

      currentBatch.push({
          campaign_id: campaignId,
          contact_id: contact.id,
          phone: contact.phone,
          status: 'pending',
          scheduled_for: nextTime
      });

      if (currentBatch.length >= INSERT_BATCH_SIZE) {
          await insertBatch(currentBatch);
          currentBatch = [];
      }
    }

    if (currentBatch.length > 0) {
        await insertBatch(currentBatch);
    }

    console.log(`Campaign ${campaignId} scheduled successfully. Last message at ${nextTime.toISOString()}`);

  } catch (error) {
    console.error('Error scheduling campaign:', error);
    throw error;
  }
};
