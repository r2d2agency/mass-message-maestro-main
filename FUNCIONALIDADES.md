# Funcionalidades do Blaster - Mass Message Maestro

O **Blaster** é um sistema completo para automação e disparo de mensagens em massa via WhatsApp, projetado para gerenciar campanhas de marketing, avisos e comunicações em larga escala de forma eficiente e segura.

Abaixo estão detalhadas todas as funcionalidades do sistema:

## 1. Gestão de Campanhas (Mass Messaging)
O núcleo do sistema permite criar e gerenciar campanhas de disparo.
- **Criação de Campanhas**: Vincule uma conexão (WhatsApp), uma lista de contatos e um modelo de mensagem.
- **Agendamento Inteligente**:
  - Defina data e hora de início (`scheduled_at`).
  - Defina data e hora de término (`end_at`) para parar a campanha automaticamente.
- **Controle de Envio (Throttling)**:
  - Configure intervalos mínimos e máximos (em segundos) entre os disparos para simular comportamento humano e reduzir riscos de bloqueio.
- **Horário de Funcionamento**: As campanhas respeitam os horários de trabalho definidos nas configurações do usuário (ex: apenas das 08:00 às 18:00).
- **Monitoramento em Tempo Real**: Acompanhe a quantidade de mensagens enviadas, pendentes e falhas.

## 2. Editor de Mensagens (Templates)
Crie modelos de mensagens ricos e reutilizáveis.
- **Suporte a Múltiplos Formatos**:
  - **Texto**: Com suporte a variáveis para personalização.
  - **Imagem**: Upload de imagens.
  - **Vídeo**: Upload de vídeos.
  - **Áudio**: Upload de arquivos de áudio ou gravação direta no navegador.
- **Interface Drag-and-Drop**: Organize a ordem dos elementos da mensagem (texto, imagem, vídeo) arrastando e soltando.
- **Reutilização**: Salve templates para usar em múltiplas campanhas.

## 3. Gestão de Contatos
Organize sua base de leads e clientes.
- **Listas de Contatos**: Crie múltiplas listas para segmentar seu público.
- **Importação em Massa**: Importe contatos via arquivos Excel (.xlsx) ou CSV.
- **Gerenciamento Manual**: Adicione, edite ou remova contatos individualmente.
- **Visualização**: Pesquise e filtre contatos dentro das listas.

## 4. Conexões (WhatsApp)
Integração robusta com a API do WhatsApp (via Evolution API).
- **Múltiplas Instâncias**: Conecte múltiplos números de WhatsApp.
- **Conexão via QR Code**: Interface simples para parear o dispositivo.
- **Status da Conexão**: Monitoramento em tempo real se a instância está conectada ou desconectada.

## 5. Administração e Configurações
Ferramentas para gestão do sistema e dos usuários.
- **Níveis de Acesso**:
  - **Admin**: Controle total do sistema.
  - **Manager**: Gestão de equipes/sub-usuários.
  - **User**: Usuário padrão para operação de campanhas.
- **Planos e Limites**: Definição de limite mensal de mensagens por usuário.
- **Personalização (White Label)**:
  - Upload de Logo personalizado.
  - Upload de Favicon.
- **Configuração de Horários**: Defina a janela de horário permitida para disparos (Início e Fim do expediente).

## 6. Dashboard e Relatórios
Visão geral do desempenho.
- **Resumo de Campanhas**: Visualize rapidamente as campanhas recentes e seus status.
- **Estatísticas**: Métricas de envio e desempenho.
- **Logs Detalhados**: Histórico de envio mensagem por mensagem (sucesso/erro).
