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

## 🐛 Bugs Resolvidos e Blindagens (Não regredir!)
1. **Tela Branca no Android APK:** 
   - *Causa:* Bibliotecas Web-only (como Vercel Analytics) tentam acessar a `window.location` do ambiente Capacitor/Android e causam um Fatal Error no React.
   - *Solução/Blindagem:* O Vercel Analytics foi COMPLETAMENTE REMOVIDO do `package.json` e do `App.jsx`, pois o Capacitor não lidava bem nem mesmo com ele dentro de condicionais `!Capacitor.isNativePlatform()`.
5. **A Rifa (Home) sumiu da Web (Tela Branca / Nenhuma Rifa):**
   - *Causa:* Se um administrador digitar o valor do bilhete no Firebase como String ("5.00") em vez de Number, a função `.toFixed(2)` no React quebra a página (TypeError).
   - *Solução/Blindagem:* Envolver sempre o preço com `Number(raffle?.price)` no Frontend para garantir que o Javascript não dê erro na hora de formatar a string de exibição.
6. **Isolamento de Funcionalidade (APK vs Web):**
   - *Causa:* O usuário queria que o APK fosse focado apenas no administrador e a Web apenas para o comprador.
   - *Solução/Blindagem:* No `App.jsx`, rotas isoladas. Se `Capacitor.isNativePlatform()`, ele renderiza APENAS o componente `<Admin />`. O usuário comum no celular nunca vai ver a tela "Admin", e o dono da rifa usando o APK só vai ver o Admin, sem nem precisar logar ou voltar para Home.
2. **Push Notifications no Android Falhando / Crash:**
   - *Causa:* O Plugin `@capacitor/push-notifications` exige o `google-services.json` na pasta `android/app/`.
   - *Blindagem:* Garantir que o Google Services JSON do Firebase foi baixado e posicionado, caso contrário o Gradle sequer aplicará o plugin de Push corretamente.
3. **Versão Estática / "Sempre na versão 1.0":**
   - *Causa:* A versão estava hardcoded no JS e no Android Gradle.
   - *Blindagem:* O arquivo `vite.config.js` agora injeta o `VITE_APP_VERSION` puxado do `package.json`. Foi criado um script `bump-version.js`. Sempre que for lançar uma versão, usar `node bump-version.js X.Y.Z` ANTES de dar build e sync, para que tudo se mantenha atualizado.
4. **Atraso nas Notificações (Render Cold Start):**
   - *Causa:* O plano gratuito do Render desliga a API após 15 minutos sem requisições. Quando chega um webhook do Mercado Pago, a API demora até 50 segundos para acordar, causando atraso extremo no disparo das Notificações Push.
   - *Blindagem:* Foi criada uma rota `/api/ping` que deve ser monitorada externamente pelo **UptimeRobot** a cada 5 minutos. Além disso, a lógica do Webhook foi separada e migrada para o **Firebase Functions** (`functions/index.js`), garantindo que os webhooks de pagamento sejam recebidos de forma escalável e com Notificações Push em tempo real sem depender da API principal.
