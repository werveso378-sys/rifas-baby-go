# 📍 CHECKPOINT DO PROJETO - RIFAS BABY GO
*Este é o arquivo de orientação e memória do projeto. Deve ser lido antes de qualquer grande modificação.*

## 📜 Regras de Ouro
1. **Não mexer onde não foi mandado:** Só alterar arquivos e lógicas estritamente relacionadas ao pedido atual do usuário.
2. **Sempre perguntar:** Em caso de ambiguidade no design ou na lógica, consultar o usuário antes de assumir uma decisão que altere o rumo do projeto.
3. **Foco no Mobile:** O aplicativo é focado em uso via celular (PWA). Cuidado absoluto com larguras (`max-width`, `grid`, `gap`) que possam forçar o navegador a dar "zoom out" e encolher a tela.

## ✅ O que já foi implementado e está funcionando:
- **Integração Mercado Pago:** Gerando Pix Copia e Cola / QR Code com o Access Token de Produção.
- **Webhook:** Recebendo notificações do Mercado Pago para aprovar o pagamento automaticamente.
- **Firebase:** Sincronizando reservas de números em tempo real (`AVAILABLE`, `PENDING_PAYMENT`, `PAID`).
- **PWA Instalável:** `manifest.json` e `sw.js` adicionados para permitir instalação nativa no Android/iOS.
- **Login Persistente:** Painel do Admin usa `localStorage` para manter a sessão.
- **Efeitos Sonoros & Notificações:** Áudios ("Ka-ching" e "Ding") e Web Notifications para quando um Pix é gerado ou pago no Painel Admin.
- **Prevenção de Zoom Acidental:** CSS global com `touch-action: manipulation;` e `user-select: none;`.

## 🐛 Bugs Recentes / Foco Atual
- **Layout encolhido no celular:** O grid de 100 números (10 colunas) com gap e paddings grandes estava ultrapassando a largura da tela do celular (360px-390px), forçando o Chrome a afastar o zoom (shrink-to-fit) para caber, deixando a interface minúscula no meio da tela.
- *Solução Aplicada:* Reduzir o `gap` do grid e o tamanho/fonte dos botões numéricos para garantir que 10 colunas caibam em 360px sem transbordar.
