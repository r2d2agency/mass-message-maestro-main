import { query } from '../db.js';

// Helper: Fisher-Yates shuffle
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const adjustToBusinessHours = (date, startHourStr, endHourStr) => {
  // Parse user settings or use defaults
  const startHour = startHourStr ? parseInt(startHourStr.split(':')[0]) : 8;
  const endHour = endHourStr ? parseInt(endHourStr.split(':')[0]) : 18;

  const d = new Date(date);
  
  // Converter para horário do Brasil (UTC-3) para verificação
  // Subtraímos 3 horas do tempo UTC para obter a "hora visual" do Brasil
  const brDate = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const hours = brDate.getUTCHours();
  
  // Se for antes do horário de início BRT
  if (hours < startHour) {
    // Ajusta para o horário de início BRT do mesmo dia
    // Mantemos o ano/mês/dia do Brasil (brDate) para evitar problemas na virada do dia UTC
    d.setUTCFullYear(brDate.getUTCFullYear());
    d.setUTCMonth(brDate.getUTCMonth());
    d.setUTCDate(brDate.getUTCDate());
    // Convert BRT start hour to UTC (add 3 hours)
    d.setUTCHours(startHour + 3, 0, 0, 0); 
  }
  // Se for depois do horário de fim BRT
  else if (hours >= endHour) {
    // Ajusta para o horário de início BRT do dia seguinte
    const tomorrow = new Date(brDate);
    tomorrow.setUTCDate(brDate.getUTCDate() + 1);
    
    d.setUTCFullYear(tomorrow.getUTCFullYear());
    d.setUTCMonth(tomorrow.getUTCMonth());
    d.setUTCDate(tomorrow.getUTCDate());
    // Convert BRT start hour to UTC (add 3 hours)
    d.setUTCHours(startHour + 3, 0, 0, 0);
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

    // 1. Get campaign details with user settings
    const campaignRes = await query(`
      SELECT c.*, u.start_work_hour, u.end_work_hour 
      FROM campaigns c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.id = $1
    `, [campaignId]);
    
    if (campaignRes.rows.length === 0) throw new Error('Campaign not found');
    const campaign = campaignRes.rows[0];

    // User settings for business hours
    const { start_work_hour, end_work_hour } = campaign;
    console.log(`Using business hours: ${start_work_hour || '08:00'} - ${end_work_hour || '18:00'} for campaign ${campaignId}`);

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
