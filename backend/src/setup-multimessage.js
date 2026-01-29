import { pool } from './db.js';

const setupMultiMessage = async () => {
  try {
    console.log('Iniciando migração para suporte a múltiplas mensagens...');

    // 1. Adicionar coluna message_ids na tabela campaigns
    console.log('Adicionando coluna message_ids em campaigns...');
    await pool.query(`
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS message_ids JSONB DEFAULT '[]';
    `);

    // 2. Adicionar coluna message_id na tabela campaign_messages
    console.log('Adicionando coluna message_id em campaign_messages...');
    await pool.query(`
      ALTER TABLE campaign_messages 
      ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES message_templates(id) ON DELETE SET NULL;
    `);

    // 3. Migrar dados existentes (opcional, mas bom para consistência)
    // Para campanhas existentes, copiar message_id para message_ids
    console.log('Migrando dados de campanhas existentes...');
    await pool.query(`
      UPDATE campaigns 
      SET message_ids = jsonb_build_array(message_id) 
      WHERE message_id IS NOT NULL AND (message_ids IS NULL OR jsonb_array_length(message_ids) = 0);
    `);
    
    // Para mensagens agendadas/enviadas existentes, copiar da campanha
    // Isso é mais complexo pois precisa join, mas para novos envios é crucial.
    // Vamos fazer um update baseado na campanha pai
    console.log('Atualizando campaign_messages antigas...');
    await pool.query(`
      UPDATE campaign_messages cm
      SET message_id = c.message_id
      FROM campaigns c
      WHERE cm.campaign_id = c.id
      AND cm.message_id IS NULL
      AND c.message_id IS NOT NULL;
    `);

    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro na migração:', error);
  } finally {
    await pool.end();
  }
};

setupMultiMessage();
