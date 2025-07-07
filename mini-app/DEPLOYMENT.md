# Deployment Guide - AI Poker Club Mini App

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Vercel/Netlify (para deployment)
- Acesso ao servidor backend (para integração real)

## 🚀 Deploy Local

### 1. Desenvolvimento
```bash
cd mini-app
npm install
npm run dev
```
Aplicação estará disponível em: `http://localhost:4000`

### 2. Build de Produção
```bash
npm run build
npm start
```

## 🌐 Deploy em Produção

### Vercel (Recomendado)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Variáveis de Ambiente
Configure as seguintes variáveis no ambiente de produção:

```env
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
NEXT_PUBLIC_API_URL=https://your-backend-api.com
NEXT_PUBLIC_WS_URL=wss://your-backend-api.com/ws
```

## 🔧 Configuração para Farcaster

### 1. Frame Metadata
A aplicação já está configurada com as meta tags necessárias:
- `fc:frame`
- `fc:frame:image`
- `fc:frame:button:1`
- `fc:frame:button:2`
- `fc:frame:post_url`

### 2. Endpoints de Frame
- `GET/POST /api/frame` - Manipula interações do Frame
- `GET /api/og` - Gera imagens para o Frame

### 3. Testando o Frame
Use o Farcaster Frame Validator:
```
https://warpcast.com/~/developers/frames
```

## 📱 Otimizações Mobile

### Performance
- Assets otimizados para mobile
- Lazy loading de componentes
- Animações CSS performáticas

### UX Mobile
- Touch targets de 44px mínimo
- Viewport meta tags configuradas
- Prevent zoom e user-scalable=no

### PWA Ready
- Meta tags de mobile app configuradas
- Offline-first architecture preparada

## 🔌 Integração Backend

### 1. WebSocket
```typescript
// Conectar ao WebSocket real
const ws = new PokerWebSocket();
ws.connect();
ws.on('gameState', (state) => {
  setGameState(state);
});
```

### 2. API Endpoints
Substitua as URLs mock por endpoints reais:
- `/api/current-state` - Estado atual do jogo
- `/api/bet/all` - Todas as apostas
- `/api/bet` - Fazer aposta
- `/api/balance` - Saldo do usuário

### 3. Autenticação Farcaster
Integre com Farcaster ID para autenticação:
```typescript
// TODO: Implementar autenticação Farcaster
const connectFarcasterWallet = async () => {
  // Lógica de conexão
};
```

## 🧪 Testes

### Endpoints de API
```bash
# Health check
curl http://localhost:4000/api/health

# Frame endpoint
curl http://localhost:4000/api/frame

# OG image
curl http://localhost:4000/api/og
```

### Mobile Testing
- Use Chrome DevTools mobile simulator
- Teste em dispositivos reais iOS/Android
- Verifique performance no Lighthouse

## 🔒 Segurança

### CORS
Configure CORS apropriadamente para produção:
```javascript
// next.config.js
headers: [
  {
    source: '/api/:path*',
    headers: [
      { key: 'Access-Control-Allow-Origin', value: 'https://warpcast.com' },
    ],
  },
]
```

### Rate Limiting
Implemente rate limiting nos endpoints de API:
```javascript
// Middleware de rate limiting para Frame interactions
```

## 📊 Monitoramento

### Analytics
- Integre Google Analytics ou Plausible
- Track Frame interactions
- Monitor performance mobile

### Logs
- Configure logging estruturado
- Monitor erros com Sentry
- Track WebSocket connections

## 🎯 Próximos Passos

1. **Wallet Integration**: Integrar carteira Farcaster/Ethereum
2. **Real-time Backend**: Conectar com WebSocket real
3. **Push Notifications**: Notificações de ações do jogo
4. **Advanced Analytics**: Métricas detalhadas de uso
5. **A/B Testing**: Testar diferentes layouts mobile 