# Poker AI - Farcaster Mini App

Uma aplicação mobile-first para assistir agentes de IA jogando poker Texas Hold'em, desenvolvida como **Mini App completo** para Farcaster usando o SDK oficial `@farcaster/miniapp-sdk`.

## 🎯 Características

- **🚀 Farcaster Mini App**: Implementação completa usando SDK oficial
- **🔐 Quick Auth**: Autenticação integrada com Farcaster
- **💳 Wallet Integration**: Conecta carteira Ethereum via Farcaster
- **🔔 Push Notifications**: Sistema de notificações para eventos do jogo
- **📱 Mobile-First**: Interface otimizada para dispositivos móveis
- **6-Player Support**: Layout compacto que acomoda até 6 jogadores na tela
- **Real-time Updates**: Atualizações em tempo real do estado do jogo
- **Modern UI**: Interface moderna com animações suaves

## 🚀 Tecnologias

- **Next.js 15**: Framework React para produção
- **@farcaster/miniapp-sdk**: SDK oficial do Farcaster para Mini Apps
- **TypeScript**: Tipagem estática
- **Tailwind CSS**: Framework de CSS utilitário
- **Framer Motion**: Animações React
- **Effect Schema**: Validação de tipos runtime

## 🔧 Funcionalidades do Mini App

### SDK Integration
- ✅ **Context Detection** - Detecta automaticamente se está rodando no Farcaster
- ✅ **Ready Signal** - Implementa `sdk.actions.ready()` obrigatório
- ✅ **Performance** - Otimizações de performance com preconnect

### Autenticação
- ✅ **Quick Auth** - Sistema de autenticação rápida do Farcaster
- ✅ **Token Management** - Gerenciamento automático de tokens JWT
- ✅ **Session Persistence** - Mantém sessão entre reloads

### Wallet
- ✅ **Ethereum Integration** - Conecta carteira Ethereum via Farcaster
- ✅ **Auto-detection** - Detecta carteiras já conectadas
- ✅ **Address Display** - Mostra endereço formatado

### Notificações
- ✅ **Game Events** - Notificações para eventos do jogo
- ✅ **Permission Management** - Controle de permissões
- ✅ **Real-time** - Notificações em tempo real

## 📱 Interface Mobile

A interface foi especialmente projetada para mobile com:

- Layout responsivo que se adapta a diferentes tamanhos de tela
- Componentes touch-friendly com área mínima de 44px
- Posicionamento inteligente de 6 jogadores ao redor da mesa
- Informações compactas mas legíveis
- Animações otimizadas para performance mobile

## 🎮 Funcionalidades

### Mesa de Poker
- Visualização de 6 jogadores com avatars e informações
- Cartas comunitárias com animações de revelação
- Display do pot total e apostas atuais
- Indicadores de status dos jogadores (Playing, Folded, All-in)
- Botão do dealer e posições dos jogadores

### Estados do Jogo
- **WAITING**: Aguardando jogadores
- **PLAYING**: Jogo em andamento
- **ROUND_OVER**: Fim da rodada
- **GAME_OVER**: Fim do jogo

### Integração Farcaster
- Meta tags configuradas para Farcaster Frames
- API endpoints para interação via Frame
- Botões de ação (Join Game, View Stats)
- Geração dinâmica de imagens OG

## 🛠️ Estrutura do Projeto

```
mini-app/
├── app/
│   ├── api/
│   │   ├── frame/route.ts     # Farcaster Frame API
│   │   └── og/route.ts        # Open Graph images
│   ├── globals.css            # Estilos globais
│   ├── layout.tsx             # Layout principal
│   └── page.tsx               # Página principal
├── components/
│   ├── Card.tsx               # Componente de carta
│   ├── CommunityCardsMobile.tsx
│   ├── PlayerSeatMobile.tsx   # Assento do jogador
│   └── PokerTableMobile.tsx   # Mesa principal
├── hooks/
│   └── useGameState.ts        # Hook de estado do jogo
├── types/
│   └── poker.ts               # Tipos TypeScript
└── utils/
    └── api.ts                 # Utilitários de API
```

## 🎨 Design Mobile

### Layout de Jogadores
- **2 Players**: Um embaixo, um em cima
- **3-4 Players**: Distribuídos nos cantos
- **5-6 Players**: Posicionamento otimizado nas laterais

### Responsividade
- **xs (375px+)**: Layout básico para telas pequenas
- **sm (640px+)**: Elementos maiores e mais espaçamento
- Classes Tailwind customizadas para diferentes breakpoints

### Animações
- `mobile-card-flip`: Animação de revelação de cartas
- `mobile-pulse`: Indicador de jogador atual
- `mobile-glow`: Destaque visual para elementos ativos

## 🔧 Desenvolvimento

### Instalação
```bash
npm install
```

### Desenvolvimento
```bash
npm run dev
```
A aplicação estará disponível em `http://localhost:4000`

### Testando o Mini App
- **Browser**: Acesse `http://localhost:4000` - funciona como web app
- **Farcaster**: Abra no app Farcaster para ver funcionalidades completas do Mini App
- **Frame**: Use o Frame Validator para testar como Frame

### Funcionalidades por Ambiente
| Funcionalidade | Browser | Farcaster Mini App |
|----------------|---------|-------------------|
| Interface Poker | ✅ | ✅ |
| Farcaster Auth | ❌ | ✅ |
| Wallet Connect | ❌ | ✅ |
| Push Notifications | ❌ | ✅ |
| Context Detection | ❌ | ✅ |

### Build
```bash
npm run build
npm start
```

## 🌐 API Endpoints

### `/api/frame`
- **GET/POST**: Endpoint principal do Farcaster Frame
- Manipula interações dos botões do Frame
- Retorna HTML com meta tags FC apropriadas

### `/api/og`
- **GET**: Gera imagens SVG para Open Graph
- Query params: `?action=join|stats|default`
- Usado para previews do Frame

## 🎯 Próximos Passos

1. **Integração Real**: Conectar com APIs reais do backend
2. **Wallet Farcaster**: Implementar conexão com carteira
3. **WebSocket**: Conexão em tempo real com o servidor
4. **Mais Animações**: Efeitos visuais adicionais
5. **Modo Escuro**: Tema alternativo
6. **Notificações**: Alerts e toasts para ações

## 📝 Notas de Desenvolvimento

- A aplicação usa dados mock para demonstração
- Prepared para integração com o backend existente
- Estrutura de tipos compatível com o projeto front
- Layout otimizado para Farcaster Frame dimensions (1200x630) 