import { query } from '../db.js';

// Helper: Fisher-Yates shuffle
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

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
    // If scheduled_at is in the past, start now (unless strictly historical, but usually we want to send now)
    if (startTime < new Date()) startTime = new Date();

    let nextTime = new Date(startTime);
    
    // Default delays (seconds) based on campaign configuration
    let minDelay = campaign.min_delay || 90;
    let maxDelay = campaign.max_delay || 300;

    const batchSize = 20;
    const pauseSeconds = 600; // 10 minutes

    // If end_at is provided and delays were not explicitly customized,
    // calculate dynamic delays to fit in the window
    if (campaign.end_at && (!campaign.min_delay || !campaign.max_delay)) {
      const endTime = new Date(campaign.end_at);
      const totalDurationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

      // Calculate total pause time required
      const totalBatches = Math.ceil(contacts.length / batchSize);
      const totalPauseTime = (totalBatches - 1) * pauseSeconds; // No pause after last batch

      // Available time for message gaps
      const availableTimeForMessages = totalDurationSeconds - totalPauseTime;

      if (availableTimeForMessages > 0) {
        // Average delay per message (we have N messages, so N gaps roughly? actually N messages usually mean N delays if we count from 0)
        // Let's assume delay comes BEFORE each message or AFTER? 
        // Current logic: nextTime += delay. So delay is between previous and current.
        // For 1st message, delay is from start? Or start immediately?
        // Usually 1st message goes immediately or after small delay. 
        // Let's assume delay is added for each message.
        
        const avgDelay = availableTimeForMessages / contacts.length;
        
        // Ensure at least 10s safe buffer
        const safeAvg = Math.max(avgDelay, 10);
        
        // Create a variation window around average
        // e.g. Avg=60s. Min=30s, Max=90s.
        minDelay = Math.floor(safeAvg * 0.5);
        maxDelay = Math.ceil(safeAvg * 1.5);
        
        // Enforce safety floor
        minDelay = Math.max(minDelay, 10);
        maxDelay = Math.max(maxDelay, minDelay + 5);

        console.log(`Auto-calculated delays for window: Min=${minDelay}s, Max=${maxDelay}s, Avg=${safeAvg}s`);
      } else {
        console.warn('Campaign window too short for required pauses! Using default delays.');
      }
    }

    const safeMinDelay = Math.max(minDelay, 10);
    const safeMaxDelay = Math.max(maxDelay, safeMinDelay + 5);
    
    let messagesInBatch = 0;

    console.log(
      `Scheduling ${contacts.length} messages starting at ${nextTime.toISOString()} with delay ${safeMinDelay}-${safeMaxDelay}s and 10min pause every ${batchSize} messages`
    );

    for (const contact of contacts) {
      // Add random delay BEFORE sending (or adding to the timeline)
      const delay =
        Math.floor(
          Math.random() * (safeMaxDelay - safeMinDelay + 1)
        ) + safeMinDelay;

      nextTime = new Date(nextTime.getTime() + delay * 1000);

      messagesInBatch += 1;
      
      // Check batch limit
      if (messagesInBatch >= batchSize) {
        // Add pause
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
