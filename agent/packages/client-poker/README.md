# @elizaos/client-poker

Este pacote implementa um cliente para o sistema Eliza que permite integração com um jogo de Poker baseado em API.

## Instalação

```bash
cd packages/client-poker
pnpm install
pnpm build
```

Em seguida, adicione-o ao agente:

```bash
cd ../../agent
pnpm add @elizaos/client-poker@workspace:*
```

## Configuração

### 1. Arquivo de Personagem (Obrigatório)

A API key é **obrigatória** e deve ser configurada no arquivo de personagem em `characters/poker-player.json`:

```json
{
    "name": "TexasHoldBot",
    "archetype": "Jogador de Poker Profissional",
    "personality": "Calculista, paciente e observador.",
    "background": "Um experiente jogador de poker que ganhou vários torneios importantes.",
    "clients": ["poker"],
    "plugins": ["plugin-bootstrap"],
    "settings": {
        "secrets": {
            "POKER_API_KEY": "sua-api-key-aqui" // Obrigatório: API key para autenticação
        }
    }
}
```

⚠️ **IMPORTANTE**: O cliente não iniciará se a API key não estiver configurada.

### 2. Variáveis de Ambiente (Opcional)

O cliente pode ser configurado através das seguintes variáveis de ambiente:

| Variável        | Descrição                            | Padrão                  |
| --------------- | ------------------------------------ | ----------------------- |
| `POKER_API_URL` | URL base da API do servidor de poker | `http://localhost:3001` |
| `POKER_API_KEY` | API key para autenticação            | `string`                |

Exemplo de configuração:

```bash
export POKER_API_URL=http://localhost:3001
export POKER_API_KEY=sua-api-key-aqui
```

### 3. Ordem de Precedência

A configuração é carregada na seguinte ordem:

1. API key do arquivo de personagem (obrigatória)
2. Variáveis de ambiente (opcional)
3. Valores padrão (para URL da API)

## Uso

Execute o Eliza com o personagem jogador de poker:

```bash
pnpm start --characters="characters/poker-player.json"
```

### Verificando a Configuração

O cliente registra sua configuração no início da execução. Você pode verificar se tudo está configurado corretamente observando os logs:

```
[INFO] PokerClient created with API endpoint: http://localhost:3001
[DEBUG] API key configured: { apiKeyLength: 64 }
[DEBUG] PokerClient configuration: {
    apiUrl: "http://localhost:3001",
    botName: "TexasHoldBot"
}
```

### Erros Comuns

1. **API Key não configurada**:

```
[ERROR] API key not found in character configuration
Error: POKER_API_KEY is required in character settings.secrets
```

2. **API Key inválida**:

```
[ERROR] HTTP error (401): {"error":"Invalid API key"}
```

## Sobre o Cliente

Este cliente foi projetado para se conectar automaticamente ao servidor de Poker, entrar em jogos disponíveis e tomar decisões com base na análise do estado do jogo usando a IA do Eliza.

### Funcionalidades

-   Detecção automática de jogos disponíveis
-   Entrada automática em jogos
-   Tomada de decisões baseada em IA usando o sistema Eliza
-   Gerenciamento de estado do jogo
-   Comunicação com API RESTful do jogo de Poker
-   Autenticação segura usando API key

### Autenticação

O cliente usa uma API key para autenticação com o servidor. A API key é obrigatória e deve ser configurada no arquivo de personagem do agente em `settings.secrets.API_KEY`. O cliente:

1. Valida a presença da API key durante a inicialização
2. Inclui a API key em todas as requisições no header `x-api-key`
3. Gerencia erros de autenticação

Se você receber um erro 401 (Unauthorized), verifique:

1. Se a API key está configurada no arquivo do personagem
2. Se a API key está correta
3. Se o servidor está esperando a API key no header `x-api-key`

### Adaptação

É possível que você precise modificar alguns aspectos deste cliente para adequá-lo à implementação específica do servidor de Poker. As principais áreas que podem exigir adaptação são:

1. Endpoints da API em `api-connector.ts`
2. Formato do estado do jogo em `game-state.ts`
3. Mecanismo de tomada de decisão em `poker-client.ts`
