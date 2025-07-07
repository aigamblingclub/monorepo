# Integração com Projeto Existente

## 🔗 Conectando Mini-App com o Backend

### 1. Estrutura de APIs Compatível

O mini-app foi desenvolvido para ser compatível com a estrutura do projeto `front`. Os endpoints esperados são:

```typescript
// utils/api.ts - já configurado
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Endpoints que devem existir no backend
export const pokerApi = {
  getCurrentState: () => apiRequest('/api/current-state'),    // ✅ Existe no server-main
  getBets: () => apiRequest('/api/bet/all'),                  // ✅ Existe no server-main  
  placeBet: (amount: number, tableId: string) => 
    apiRequest('/api/bet', { method: 'POST', body: JSON.stringify({ amount, tableId }) }),
  getBalance: () => apiRequest('/api/balance'),               // ✅ Existe no server-main
};
```

### 2. WebSocket Integration

```typescript
// hooks/useGameState.ts - modificar para produção
import { PokerWebSocket } from '@/utils/api';

export function useGameState() {
  const [gameState, setGameState] = useState<PokerState | null>(null);
  const [ws] = useState(() => new PokerWebSocket());

  useEffect(() => {
    // Conectar WebSocket real
    ws.connect();
    
    ws.on('gameState', (newState: PokerState) => {
      setGameState(newState);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return () => ws.disconnect();
  }, []);

  return { gameState, isConnected: !!gameState };
}
```

### 3. Variables de Ambiente

```env
# .env.local (development)
NEXT_PUBLIC_BASE_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000/ws

# .env.production  
NEXT_PUBLIC_BASE_URL=https://ai-poker-club.vercel.app
NEXT_PUBLIC_API_URL=https://your-backend.com
NEXT_PUBLIC_WS_URL=wss://your-backend.com/ws
```

## 🏗️ Estrutura de Pastas no Monorepo

```
monorepo/
├── front/                    # Aplicação desktop existente
├── mini-app/                 # ✅ Nova aplicação mobile
├── server-main/              # Backend principal
├── packages/
│   ├── poker-state-machine/  # Shared logic
│   └── server-poker/         # Poker server
└── contracts/                # Smart contracts
```

## 🔄 Shared Components

### 1. Tipos TypeScript

O mini-app reutiliza os tipos do projeto front:

```typescript
// mini-app/types/poker.ts
// Baseado em front/src/types/schemas.ts
export type {
  Card,
  PlayerState,
  PokerState,
  TableStatus,
  Street,
  // ... outros tipos
} from './schemas';
```

### 2. Shared Package (Futuro)

Criar package compartilhado:

```bash
# packages/shared-types/
├── package.json
├── src/
│   ├── poker.ts
│   ├── api.ts
│   └── utils.ts
└── tsconfig.json
```

## 🚀 Deploy Integrado

### 1. Vercel Monorepo

```json
// vercel.json (raiz do monorepo)
{
  "projects": [
    {
      "name": "ai-poker-club-front",
      "directory": "front"
    },
    {
      "name": "ai-poker-club-mini-app", 
      "directory": "mini-app"
    }
  ]
}
```

### 2. Scripts Compartilhados

```json
// package.json (raiz)
{
  "scripts": {
    "dev:front": "cd front && npm run dev",
    "dev:mini": "cd mini-app && npm run dev", 
    "dev:server": "cd server-main && npm run dev",
    "dev:all": "concurrently \"npm run dev:front\" \"npm run dev:mini\" \"npm run dev:server\"",
    "build:all": "npm run build --workspaces"
  }
}
```

## 🔧 Configuração Nginx (Produção)

```nginx
# nginx.conf
server {
    listen 80;
    server_name ai-poker-club.com;

    # Desktop app
    location / {
        proxy_pass http://front:3000;
    }

    # Mobile mini-app  
    location /mini {
        proxy_pass http://mini-app:4000;
    }

    # API
    location /api {
        proxy_pass http://server-main:5000;
    }
}
```

## 📱 Farcaster Frame Integration

### 1. Frame URLs

```typescript
// Frame URLs para o Farcaster
const FRAME_URLS = {
  production: 'https://ai-poker-club.vercel.app',
  development: 'http://localhost:4000'
};
```

### 2. Frame Validator

Teste o Frame em: `https://warpcast.com/~/developers/frames`

URLs para testar:
- `http://localhost:4000/api/frame`
- `http://localhost:4000/api/og`

## 🔒 Autenticação Farcaster

### 1. Farcaster ID Integration

```typescript
// TODO: Implementar autenticação real
interface FarcasterUser {
  fid: number;
  username: string;
  walletAddress?: string;
}

const useFarcasterAuth = () => {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  
  const connect = async () => {
    // Lógica de autenticação Farcaster
    // Integrar com @farcaster/auth-kit ou similar
  };

  return { user, connect };
};
```

### 2. Wallet Connection

```typescript
// Conectar com carteira Ethereum via Farcaster
const connectWallet = async () => {
  // Usar Farcaster's embedded wallet ou conectar MetaMask
  // Integrar com contratos do projeto
};
```

## 📊 Analytics e Monitoring

### 1. Shared Analytics

```typescript
// packages/shared-analytics/
export const trackEvent = (event: string, properties: any) => {
  // Analytics compartilhado entre front e mini-app
  if (typeof window !== 'undefined') {
    // Google Analytics, Mixpanel, etc.
  }
};
```

### 2. Error Tracking

```typescript
// Sentry configuration compartilhada
export const initSentry = (project: 'front' | 'mini-app') => {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    beforeSend: (event) => {
      event.tags = { ...event.tags, project };
      return event;
    }
  });
};
```

## 🎯 Roadmap de Integração

### Fase 1: Básica (Atual)
- ✅ Aplicação standalone funcionando
- ✅ Mock data para demonstração
- ✅ Farcaster Frame configurado

### Fase 2: Backend Integration
- 🔄 Conectar APIs reais do server-main
- 🔄 WebSocket em tempo real
- 🔄 Sincronização de estado entre apps

### Fase 3: Wallet Integration  
- 🔄 Autenticação Farcaster
- 🔄 Carteira Ethereum
- 🔄 Integração com contratos

### Fase 4: Advanced Features
- 🔄 Shared state management
- 🔄 Cross-platform notifications
- 🔄 Advanced analytics

## ✅ Checklist de Integração

- [ ] Configurar variáveis de ambiente para produção
- [ ] Testar APIs com server-main  
- [ ] Configurar WebSocket connection
- [ ] Deploy conjunto front + mini-app
- [ ] Testar Farcaster Frame em produção
- [ ] Configurar monitoring e analytics
- [ ] Documentar URLs para time
- [ ] Setup CI/CD para ambas apps 