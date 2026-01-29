import axios from 'axios';

/**
 * Sends a message using the Evolution API.
 * 
 * @param {Object} params
 * @param {string} params.apiUrl - The base URL of the Evolution API instance
 * @param {string} params.apiKey - The API Key for authentication
 * @param {string} params.instanceName - The name of the instance
 * @param {string} params.phone - The destination phone number (e.g., "5511999999999")
 * @param {string} params.text - The text message to send
 * @returns {Promise<Object>} - The response from the API
 */
export const sendMessage = async ({ apiUrl, apiKey, instanceName, phone, text, type = 'text', mediaUrl, caption }) => {
  try {
    // Ensure URL doesn't have trailing slash
    const baseUrl = apiUrl.replace(/\/$/, '');
    
    // Format phone number (remove non-digits)
    const formattedPhone = phone.replace(/\D/g, '');
    
    // Check if phone has DDI (assuming BR 55 if length is 10 or 11, but better to trust input if it's already long)
    // For now, we assume the user provides the DDI or we might need to add it.
    // Standard Evolution API usually expects number with DDI.
    
    const url = `${baseUrl}/message/sendText/${instanceName}`;
    
    const payload = {
      number: formattedPhone,
      text: text,
      delay: 1200,
      linkPreview: true
    };

    console.log(`Sending message to ${formattedPhone} via ${url}...`);

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      }
    });

    return response.data;
  } catch (error) {
    console.error('Evolution API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message || 'Failed to send message');
  }
};
