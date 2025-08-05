import { expect, test, describe } from "bun:test";
import { PLAYER_DEFAULT_STATE } from "../src/state_machine";
import { processPlayerMove, finalizeRound, nextRound } from "../src/transitions";
import { Effect } from "effect";
import type { PlayerState, PokerState, Move } from "../src/schemas";
import { getDeck } from "../src/poker";

describe('Real Bug Reproduction from Game Logs', () => {
  
  // Reproduzindo o estado exato do log onde o bug aconteceu
  function createRealBugScenario(): PokerState {
    const players: PlayerState[] = [
      {
        ...PLAYER_DEFAULT_STATE,
        id: "058cf225-7d2c-075f-8bf6-b7cad54aa4b7",
        playerName: "The Strategist",
        chips: 200,
        bet: { amount: 0, volume: 0 },
        status: "FOLDED",
        position: "BTN"
      },
      {
        ...PLAYER_DEFAULT_STATE,
        id: "0d6ec944-aa2c-05c3-9d3b-37d285d56a53",
        playerName: "The Grinder",
        chips: 200,
        bet: { amount: 0, volume: 0 },
        status: "PLAYING",
        position: "SB"
      },
      {
        ...PLAYER_DEFAULT_STATE,
        id: "8be5f1c9-6a55-0893-918d-bde8814009d9",
        playerName: "The Veteran",
        chips: 200,
        bet: { amount: 0, volume: 0 },
        status: "PLAYING",
        position: "BB"
      },
      {
        ...PLAYER_DEFAULT_STATE,
        id: "472a3913-2ead-05b5-9ee2-1693304f5862",
        playerName: "The Showman",
        chips: 200,
        bet: { amount: 0, volume: 0 },
        status: "PLAYING",
        position: "MP"
      },
      {
        ...PLAYER_DEFAULT_STATE,
        id: "f17ab17a-939b-0bc2-8c77-f30a438ba0fb",
        playerName: "The Trickster",
        chips: 200,
        bet: { amount: 0, volume: 0 },
        status: "PLAYING",
        position: "MP"
      }
    ];

    return {
      tableId: "test-table",
      tableStatus: "PLAYING",
      players,
      deck: getDeck(),
      community: [
        { rank: 8, suit: "clubs" },
        { rank: 6, suit: "diamonds" },
        { rank: 9, suit: "diamonds" },
        { rank: 8, suit: "diamonds" }
      ], // Estado no TURN
      phase: {
        street: "TURN",
        actionCount: 2,
        volume: 0
      },
      round: {
        roundNumber: 1,
        volume: 100,
        currentBet: 100,
        foldedPlayers: [],
        allInPlayers: []
      },
      currentPlayerIndex: 0,
      dealerId: "058cf225-7d2c-075f-8bf6-b7cad54aa4b7",
      winner: null,
      config: {
        maxRounds: null,
        startingChips: 200,
        smallBlind: 10,
        bigBlind: 20
      },
      lastMove: null,
      lastRoundResult: null
    };
  }

  test('Debug: Simple ALL_IN test', () => {
    const state = createRealBugScenario();
    
    // Configurar jogador com chips insuficientes (The Strategist - currentPlayerIndex 0)
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = { 
      ...updatedPlayers[0], 
      chips: 80,
      bet: { amount: 0, volume: 0 },
      status: "PLAYING" // Mudar de FOLDED para PLAYING
    };
    
    const stateWithInsufficientChips = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 100 }
    };
    
    console.log("=== ANTES DO CALL ===");
    console.log("Player chips:", stateWithInsufficientChips.players[0].chips);
    console.log("Current bet:", stateWithInsufficientChips.round.currentBet);
    console.log("Player bet:", stateWithInsufficientChips.players[0].bet);
    
    // Player tenta call de 100 com apenas 80 chips
    const callMove: Move = { 
      type: "call", 
      decisionContext: null
    };
    const resultState = Effect.runSync(processPlayerMove(stateWithInsufficientChips, callMove));
    
    console.log("=== DEPOIS DO CALL ===");
    console.log("Player status:", resultState.players[0].status);
    console.log("Player chips:", resultState.players[0].chips);
    console.log("Player bet:", resultState.players[0].bet);
    console.log("Player playedThisPhase:", resultState.players[0].playedThisPhase);
    
    const playerAfter = resultState.players[0];
    expect(playerAfter.status).toBe("ALL_IN");
    expect(playerAfter.chips).toBe(0);
    expect(playerAfter.bet.amount).toBe(80);
    expect(playerAfter.bet.volume).toBe(80);
    expect(playerAfter.playedThisPhase).toBe(true);
  });

  test('Bug 1: The Trickster should go ALL_IN when calling after Grinder raises', () => {
    const state = createRealBugScenario();
    
    // Configurar o estado inicial com as apostas corretas
    const updatedPlayers = [...state.players];
    updatedPlayers[1] = { ...updatedPlayers[1], bet: { amount: 100, volume: 100 } }; // The Grinder já apostou 100
    updatedPlayers[2] = { ...updatedPlayers[2], bet: { amount: 100, volume: 100 } }; // The Veteran já apostou 100
    updatedPlayers[3] = { ...updatedPlayers[3], bet: { amount: 100, volume: 100 } }; // The Showman já apostou 100
    updatedPlayers[4] = { ...updatedPlayers[4], bet: { amount: 100, volume: 100 } }; // The Trickster já apostou 100
    
    const stateWithBets = { 
      ...state, 
      players: updatedPlayers,
      currentPlayerIndex: 1 // The Grinder faz o raise
    };
    
    // The Grinder faz raise de 300 (total 400)
    const raiseMove: Move = { 
      type: "raise", 
      amount: 300,
      decisionContext: null
    };
    const stateAfterRaise = Effect.runSync(processPlayerMove(stateWithBets, raiseMove));
    
    // Verificar que The Grinder foi para ALL_IN
    const grinderAfter = stateAfterRaise.players[1];
    expect(grinderAfter.status).toBe("ALL_IN");
    expect(grinderAfter.chips).toBe(0);
    expect(grinderAfter.bet.amount).toBe(300);
    expect(grinderAfter.bet.volume).toBe(300);
    expect(grinderAfter.playedThisPhase).toBe(true);
    
    // Configurar para The Veteran fazer call
    const stateForVeteran = { ...stateAfterRaise, currentPlayerIndex: 2 };
    
    // The Veteran faz call (iguala ao all_in)
    const callMove: Move = { 
      type: "call", 
      decisionContext: null
    };
    const resultState = Effect.runSync(processPlayerMove(stateForVeteran, callMove));
    
    // Verificar que The Veteran permanece ALL_IN, NÃO volta para PLAYING
    const veteranAfter = resultState.players[2];
    expect(veteranAfter.status).toBe("ALL_IN");
    expect(veteranAfter.chips).toBe(0);
    expect(veteranAfter.bet.amount).toBe(300); // Corrigido: 100 + 200 = 300
    expect(veteranAfter.bet.volume).toBe(300);
    expect(veteranAfter.playedThisPhase).toBe(true);
  });

  test('Bug 2: playedThisPhase should be updated correctly when player makes a move', () => {
    const state = createRealBugScenario();
    
    // Configurar The Trickster como jogador atual
    const stateWithTrickster = { 
      ...state, 
      currentPlayerIndex: 4 // The Trickster
    };
    
    // The Trickster faz call
    const callMove: Move = { 
      type: "call", 
      decisionContext: null
    };
    const resultState = Effect.runSync(processPlayerMove(stateWithTrickster, callMove));
    
    // Verificar que playedThisPhase foi atualizado para true
    const tricksterAfter = resultState.players[4];
    expect(tricksterAfter.playedThisPhase).toBe(true);
  });

  test('Bug 3: Player should go ALL_IN when calling with insufficient chips', () => {
    const state = createRealBugScenario();
    
    // Configurar jogador com chips insuficientes (The Grinder - índice 1)
    const updatedPlayers = [...state.players];
    updatedPlayers[1] = { 
      ...updatedPlayers[1], 
      chips: 80,
      bet: { amount: 0, volume: 0 }
    };
    
    const stateWithInsufficientChips = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 100 },
      currentPlayerIndex: 1 // The Grinder
    };
    
    // Player tenta call de 100 com apenas 80 chips
    const callMove: Move = { 
      type: "call", 
      decisionContext: null
    };
    const resultState = Effect.runSync(processPlayerMove(stateWithInsufficientChips, callMove));
    
    const player2After = resultState.players[1];
    expect(player2After.status).toBe("ALL_IN");
    expect(player2After.chips).toBe(0);
    expect(player2After.bet.amount).toBe(80);
    expect(player2After.bet.volume).toBe(80);
    expect(player2After.playedThisPhase).toBe(true);
  });

  test('Bug 4: Eliminated player should not return as ALL_IN in next round', () => {
    const state = createRealBugScenario();
    
    // Configurar jogador com 0 chips (eliminated)
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = { 
      ...updatedPlayers[0], 
      chips: 0,
      status: "ELIMINATED" as const
    };
    
    const stateWithEliminated = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, volume: 100 }
    };
    
    // Verificar que o jogador eliminated permanece ELIMINATED
    const eliminatedPlayer = stateWithEliminated.players[0];
    expect(eliminatedPlayer.status).toBe("ELIMINATED");
    expect(eliminatedPlayer.chips).toBe(0);
  });

  test('Bug 5: Complex scenario from CSV - The Trickster should go ALL_IN', () => {
    const state = createRealBugScenario();
    
    // Configurar estado inicial baseado no CSV - jogadores com chips insuficientes
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = { ...updatedPlayers[0], chips: 200, bet: { amount: 0, volume: 0 } }; // The Strategist
    updatedPlayers[1] = { ...updatedPlayers[1], chips: 50, bet: { amount: 100, volume: 100 } }; // The Grinder
    updatedPlayers[2] = { ...updatedPlayers[2], chips: 30, bet: { amount: 100, volume: 100 } }; // The Veteran
    updatedPlayers[3] = { ...updatedPlayers[3], chips: 200, bet: { amount: 100, volume: 100 } }; // The Showman
    updatedPlayers[4] = { ...updatedPlayers[4], chips: 20, bet: { amount: 100, volume: 100 } }; // The Trickster
    
    const stateWithRealisticChips = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 200 },
      currentPlayerIndex: 0 // The Strategist
    };
    
    // The Strategist faz all-in
    const allInMove: Move = { 
      type: "all_in", 
      decisionContext: null
    };
    const stateAfterAllIn = Effect.runSync(processPlayerMove(stateWithRealisticChips, allInMove));
    
    // Configurar para The Grinder fazer call
    const stateForGrinder = { ...stateAfterAllIn, currentPlayerIndex: 1 };
    
    // The Grinder faz call
    const grinderCallMove: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterGrinder = Effect.runSync(processPlayerMove(stateForGrinder, grinderCallMove));
    
    // Configurar para The Veteran fazer call
    const stateForVeteran = { ...stateAfterGrinder, currentPlayerIndex: 2 };
    
    // The Veteran faz call
    const veteranCallMove: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterVeteran = Effect.runSync(processPlayerMove(stateForVeteran, veteranCallMove));
    
    // Configurar para The Trickster fazer call
    const stateForTrickster = { ...stateAfterVeteran, currentPlayerIndex: 4 };
    
    // The Trickster faz call
    const tricksterCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const finalState = Effect.runSync(processPlayerMove(stateForTrickster, tricksterCall));
    
    // Verificar que todos foram para ALL_IN
    expect(finalState.players[1].status).toBe("ALL_IN");
    expect(finalState.players[2].status).toBe("ALL_IN");
    expect(finalState.players[4].status).toBe("ALL_IN");
  });

  test('Bug 6: Multiple players should go ALL_IN when calling with insufficient chips', () => {
    const state = createRealBugScenario();
    
    // Configurar jogadores com chips insuficientes
    const updatedPlayers = [...state.players];
    updatedPlayers[1] = { ...updatedPlayers[1], chips: 50, bet: { amount: 0, volume: 0 } }; // The Grinder
    updatedPlayers[2] = { ...updatedPlayers[2], chips: 30, bet: { amount: 0, volume: 0 } }; // The Veteran
    updatedPlayers[4] = { ...updatedPlayers[4], chips: 20, bet: { amount: 0, volume: 0 } }; // The Trickster
    
    const stateWithInsufficientChips = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 100 },
      currentPlayerIndex: 1 // The Grinder
    };
    
    // The Grinder faz call (all-in)
    const grinderCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterGrinder = Effect.runSync(processPlayerMove(stateWithInsufficientChips, grinderCall));
    
    // Configurar para The Veteran fazer call
    const stateForVeteran = { ...stateAfterGrinder, currentPlayerIndex: 2 };
    
    // The Veteran faz call (all-in)
    const veteranCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterVeteran = Effect.runSync(processPlayerMove(stateForVeteran, veteranCall));
    
    // Configurar para The Trickster fazer call
    const stateForTrickster = { ...stateAfterVeteran, currentPlayerIndex: 4 };
    
    // The Trickster faz call (all-in)
    const tricksterCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const finalState = Effect.runSync(processPlayerMove(stateForTrickster, tricksterCall));
    
    // Verificar que todos foram para ALL_IN
    expect(finalState.players[1].status).toBe("ALL_IN");
    expect(finalState.players[1].chips).toBe(0);
    expect(finalState.players[1].bet.amount).toBe(50);
    
    expect(finalState.players[2].status).toBe("ALL_IN");
    expect(finalState.players[2].chips).toBe(0);
    expect(finalState.players[2].bet.amount).toBe(30);
    
    expect(finalState.players[4].status).toBe("ALL_IN");
    expect(finalState.players[4].chips).toBe(0);
    expect(finalState.players[4].bet.amount).toBe(20);
  });

  test('Bug 7: Multiple pots scenario - Player 3 accepts raise after all-in', () => {
    const state = createRealBugScenario();
    
    // Configurar jogadores com chips específicos para o cenário
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = { ...updatedPlayers[0], chips: 300, bet: { amount: 0, volume: 0 } }; // The Strategist
    updatedPlayers[1] = { ...updatedPlayers[1], chips: 200, bet: { amount: 0, volume: 0 } }; // The Grinder
    updatedPlayers[2] = { ...updatedPlayers[2], chips: 250, bet: { amount: 0, volume: 0 } }; // The Veteran
    updatedPlayers[3] = { ...updatedPlayers[3], chips: 0, status: "FOLDED" as const }; // The Showman (folded)
    updatedPlayers[4] = { ...updatedPlayers[4], chips: 0, status: "FOLDED" as const }; // The Trickster (folded)
    
    const stateWithSpecificChips = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 100 },
      currentPlayerIndex: 0, // The Strategist
      phase: { ...state.phase, street: "TURN" as const }
    };
    
    console.log("=== MULTIPLE POTS TEST 1 - Player 3 accepts ===");
    console.log("Initial state:");
    stateWithSpecificChips.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, bet: ${p.bet.amount}`);
    });
    
    // The Strategist faz call de 100
    const strategistCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterStrategist = Effect.runSync(processPlayerMove(stateWithSpecificChips, strategistCall));
    
    console.log("\nAfter Strategist call:");
    stateAfterStrategist.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, bet: ${p.bet.amount}, status: ${p.status}`);
    });
    
    // The Grinder faz all-in de 200
    const stateForGrinder = { ...stateAfterStrategist, currentPlayerIndex: 1 };
    const grinderAllIn: Move = { 
      type: "all_in", 
      decisionContext: null
    };
    const stateAfterGrinder = Effect.runSync(processPlayerMove(stateForGrinder, grinderAllIn));
    
    console.log("\nAfter Grinder all-in:");
    stateAfterGrinder.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, bet: ${p.bet.amount}, status: ${p.status}`);
    });
    
    // The Veteran faz call (vira all-in do pot de 200)
    const stateForVeteran = { ...stateAfterGrinder, currentPlayerIndex: 2 };
    const veteranCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterVeteran = Effect.runSync(processPlayerMove(stateForVeteran, veteranCall));
    
    console.log("\nAfter Veteran call (all-in):");
    stateAfterVeteran.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, bet: ${p.bet.amount}, status: ${p.status}`);
    });
    
    // The Strategist faz raise para 250
    const stateForStrategistRaise = { ...stateAfterVeteran, currentPlayerIndex: 0 };
    const strategistRaise: Move = { 
      type: "raise", 
      amount: 150, // raise de 100 para 250
      decisionContext: null
    };
    const stateAfterRaise = Effect.runSync(processPlayerMove(stateForStrategistRaise, strategistRaise));
    
    console.log("\nAfter Strategist raise to 250:");
    stateAfterRaise.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, bet: ${p.bet.amount}, status: ${p.status}`);
    });
    
    // The Veteran aceita o raise (vai all-in com 250)
    const stateForVeteranAccept = { ...stateAfterRaise, currentPlayerIndex: 2 };
    const veteranAccept: Move = { 
      type: "call", 
      decisionContext: null
    };
    const finalState = Effect.runSync(processPlayerMove(stateForVeteranAccept, veteranAccept));
    
    console.log("\nFinal state after Veteran accepts:");
    finalState.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, bet: ${p.bet.amount}, status: ${p.status}`);
    });
    
    // Verificações
    const strategist = finalState.players[0];
    const grinder = finalState.players[1];
    const veteran = finalState.players[2];
    
    // Após avançar para RIVER, as apostas são resetadas mas o volume do pot permanece
    expect(strategist.chips).toBe(50);
    expect(strategist.bet.amount).toBe(0); // Aposta resetada após avançar fase
    expect(strategist.status).toBe("PLAYING");
    
    // The Grinder deve estar ALL_IN
    expect(grinder.chips).toBe(0);
    expect(grinder.bet.amount).toBe(0); // Aposta resetada após avançar fase
    expect(grinder.status).toBe("ALL_IN");
    
    // The Veteran deve estar ALL_IN
    expect(veteran.chips).toBe(0);
    expect(veteran.bet.amount).toBe(0); // Aposta resetada após avançar fase
    expect(veteran.status).toBe("ALL_IN");
    
    // Total do pot deve ser 800 (200 + 200 + 250 + 50 + 100 do pot anterior)
    expect(finalState.round.volume).toBe(800);
  });

  test('Bug 8: Multiple pots scenario - Player 3 folds after raise', () => {
    const state = createRealBugScenario();
    
    // Configurar jogadores com chips específicos para o cenário
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = { ...updatedPlayers[0], chips: 300, bet: { amount: 0, volume: 0 } }; // The Strategist
    updatedPlayers[1] = { ...updatedPlayers[1], chips: 200, bet: { amount: 0, volume: 0 } }; // The Grinder
    updatedPlayers[2] = { ...updatedPlayers[2], chips: 250, bet: { amount: 0, volume: 0 } }; // The Veteran
    updatedPlayers[3] = { ...updatedPlayers[3], chips: 0, status: "FOLDED" as const }; // The Showman (folded)
    updatedPlayers[4] = { ...updatedPlayers[4], chips: 0, status: "FOLDED" as const }; // The Trickster (folded)
    
    const stateWithSpecificChips = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 100 },
      currentPlayerIndex: 0, // The Strategist
      phase: { ...state.phase, street: "TURN" as const }
    };
    
    console.log("=== MULTIPLE POTS TEST 2 - Player 3 folds ===");
    console.log("Initial state:");
    stateWithSpecificChips.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, bet: ${p.bet.amount}`);
    });
    
    // The Strategist faz call de 200
    const strategistCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterStrategist = Effect.runSync(processPlayerMove(stateWithSpecificChips, strategistCall));
    
    // The Grinder faz all-in de 200
    const stateForGrinder = { ...stateAfterStrategist, currentPlayerIndex: 1 };
    const grinderAllIn: Move = { 
      type: "all_in", 
      decisionContext: null
    };
    const stateAfterGrinder = Effect.runSync(processPlayerMove(stateForGrinder, grinderAllIn));
    
    // The Veteran faz call (vira all-in do pot de 200)
    const stateForVeteran = { ...stateAfterGrinder, currentPlayerIndex: 2 };
    const veteranCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterVeteran = Effect.runSync(processPlayerMove(stateForVeteran, veteranCall));
    
    // The Strategist faz raise para 250
    const stateForStrategistRaise = { ...stateAfterVeteran, currentPlayerIndex: 0 };
    const strategistRaise: Move = { 
      type: "raise", 
      amount: 150, // raise de 100 para 250
      decisionContext: null
    };
    const stateAfterRaise = Effect.runSync(processPlayerMove(stateForStrategistRaise, strategistRaise));
    
    // The Veteran folda o raise (perde os 200 que já apostou)
    const stateForVeteranFold = { ...stateAfterRaise, currentPlayerIndex: 2 };
    const veteranFold: Move = { 
      type: "fold", 
      decisionContext: null
    };
    const finalState = Effect.runSync(processPlayerMove(stateForVeteranFold, veteranFold));
    
    console.log("\nFinal state after Veteran folds:");
    finalState.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, bet: ${p.bet.amount}, status: ${p.status}`);
    });
    
    // Verificações
    const strategist = finalState.players[0];
    const grinder = finalState.players[1];
    const veteran = finalState.players[2];
    
    // Após avançar para RIVER, as apostas são resetadas mas o volume do pot permanece
    expect(strategist.chips).toBe(50);
    expect(strategist.bet.amount).toBe(0); // Aposta resetada após avançar fase
    expect(strategist.status).toBe("PLAYING");
    
    // The Grinder deve estar ALL_IN
    expect(grinder.chips).toBe(0);
    expect(grinder.bet.amount).toBe(0); // Aposta resetada após avançar fase
    expect(grinder.status).toBe("ALL_IN");
    
    // The Veteran deve estar FOLDED (perdeu os 200 que apostou)
    expect(veteran.chips).toBe(50); // Mantém as fichas que não apostou (250 - 200)
    expect(veteran.bet.amount).toBe(0); // Aposta resetada
    expect(veteran.status).toBe("FOLDED");
    
    // Total do pot deve ser 750 (200 do Grinder + 250 do Strategist + 300 do pot anterior)
    expect(finalState.round.volume).toBe(750);
  });

  test('Bug 9: Eliminated player should not return as ALL_IN in subsequent rounds', () => {
    const state = createRealBugScenario();
    
    // Configurar jogadores com chips específicos para o cenário
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = { ...updatedPlayers[0], chips: 50, bet: { amount: 0, volume: 0 } }; // The Strategist (poucos chips)
    updatedPlayers[1] = { ...updatedPlayers[1], chips: 200, bet: { amount: 0, volume: 0 } }; // The Grinder
    updatedPlayers[2] = { ...updatedPlayers[2], chips: 200, bet: { amount: 0, volume: 0 } }; // The Veteran
    updatedPlayers[3] = { ...updatedPlayers[3], chips: 200, bet: { amount: 0, volume: 0 } }; // The Showman
    updatedPlayers[4] = { ...updatedPlayers[4], chips: 200, bet: { amount: 0, volume: 0 } }; // The Trickster
    
    const stateWithSpecificChips = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 100 },
      currentPlayerIndex: 0, // The Strategist
      phase: { ...state.phase, street: "TURN" as const }
    };
    
    console.log("=== ELIMINATED PLAYER BUG TEST ===");
    console.log("Round 1 - Initial state:");
    stateWithSpecificChips.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Round 1: The Strategist faz all-in (50 chips)
    const strategistAllIn: Move = { 
      type: "all_in", 
      decisionContext: null
    };
    const stateAfterAllIn = Effect.runSync(processPlayerMove(stateWithSpecificChips, strategistAllIn));
    
    console.log("\nRound 1 - After Strategist all-in:");
    stateAfterAllIn.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Simular que o round termina e The Strategist perde (fica eliminated)
    const stateAfterRoundLoss = {
      ...stateAfterAllIn,
      players: stateAfterAllIn.players.map((player, index) => 
        index === 0 
          ? { ...player, status: "ELIMINATED" as const, chips: 0 }
          : player
      )
    };
    
    console.log("\nRound 1 - After loss (Strategist eliminated):");
    stateAfterRoundLoss.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Round 2: Início do próximo round
    const round2State = Effect.runSync(nextRound(stateAfterRoundLoss));
    
    console.log("\nRound 2 - After nextRound:");
    round2State.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Simular que os jogadores restantes jogam normalmente no Round 2
    // The Grinder faz call
    const grinderCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterGrinderCall = Effect.runSync(processPlayerMove(round2State, grinderCall));
    
    // The Veteran faz raise
    const stateForVeteran = { ...stateAfterGrinderCall, currentPlayerIndex: 2 };
    const veteranRaise: Move = { 
      type: "raise", 
      amount: 50,
      decisionContext: null
    };
    const stateAfterVeteranRaise = Effect.runSync(processPlayerMove(stateForVeteran, veteranRaise));
    
    // Simular fim do Round 2 e início do Round 3
    const round3State = Effect.runSync(nextRound(stateAfterVeteranRaise));
    
    console.log("\nRound 3 - After nextRound:");
    round3State.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Simular mais uma rodada normal no Round 3
    // The Showman faz all-in
    const stateForShowman = { ...round3State, currentPlayerIndex: 3 };
    const showmanAllIn: Move = { 
      type: "all_in", 
      decisionContext: null
    };
    const stateAfterShowmanAllIn = Effect.runSync(processPlayerMove(stateForShowman, showmanAllIn));
    
    // The Trickster faz call
    const stateForTrickster = { ...stateAfterShowmanAllIn, currentPlayerIndex: 4 };
    const tricksterCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterTricksterCall = Effect.runSync(processPlayerMove(stateForTrickster, tricksterCall));
    
    // Simular fim do Round 3 e início do Round 4
    const round4State = Effect.runSync(nextRound(stateAfterTricksterCall));
    
    console.log("\nRound 4 - After nextRound:");
    round4State.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // VERIFICAÇÕES CRÍTICAS:
    
    // 1. The Strategist deve permanecer ELIMINATED em TODOS os rounds
    expect(round2State.players[0].status).toBe("ELIMINATED");
    expect(round2State.players[0].chips).toBe(0);
    expect(round3State.players[0].status).toBe("ELIMINATED");
    expect(round3State.players[0].chips).toBe(0);
    expect(round4State.players[0].status).toBe("ELIMINATED");
    expect(round4State.players[0].chips).toBe(0);
    
    // 2. The Strategist NUNCA deve voltar para ALL_IN
    expect(round2State.players[0].status).not.toBe("ALL_IN");
    expect(round3State.players[0].status).not.toBe("ALL_IN");
    expect(round4State.players[0].status).not.toBe("ALL_IN");
    
    // 3. Outros jogadores devem estar jogando normalmente
    for (let i = 1; i < round4State.players.length; i++) {
      const player = round4State.players[i];
      if (player.status !== "FOLDED" && player.status !== "ELIMINATED") {
        expect(player.status).toBe("PLAYING");
        expect(player.chips).toBeGreaterThan(0);
      }
    }
    
    // 4. Verificar que o número de jogadores ativos diminuiu corretamente
    const activePlayers = round4State.players.filter(p => p.status === "PLAYING");
    const eliminatedPlayers = round4State.players.filter(p => p.status === "ELIMINATED");
    expect(eliminatedPlayers.length).toBeGreaterThan(0);
    expect(activePlayers.length).toBeLessThan(state.players.length);
  });

  test('Bug 10: Multiple rounds - Eliminated player should stay eliminated', () => {
    const state = createRealBugScenario();
    
    // Configurar jogadores com chips específicos
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = { ...updatedPlayers[0], chips: 30, bet: { amount: 0, volume: 0 } }; // The Strategist (poucos chips)
    updatedPlayers[1] = { ...updatedPlayers[1], chips: 200, bet: { amount: 0, volume: 0 } }; // The Grinder
    updatedPlayers[2] = { ...updatedPlayers[2], chips: 200, bet: { amount: 0, volume: 0 } }; // The Veteran
    updatedPlayers[3] = { ...updatedPlayers[3], chips: 200, bet: { amount: 0, volume: 0 } }; // The Showman
    updatedPlayers[4] = { ...updatedPlayers[4], chips: 200, bet: { amount: 0, volume: 0 } }; // The Trickster
    
    const stateWithSpecificChips = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 100 },
      currentPlayerIndex: 0, // The Strategist
      phase: { ...state.phase, street: "TURN" as const }
    };
    
    console.log("=== MULTIPLE ROUNDS ELIMINATED TEST ===");
    console.log("Round 1 - Initial state:");
    stateWithSpecificChips.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Round 1: The Strategist faz all-in e perde
    const strategistAllIn: Move = { 
      type: "all_in", 
      decisionContext: null
    };
    const stateAfterAllIn = Effect.runSync(processPlayerMove(stateWithSpecificChips, strategistAllIn));
    
    // Simular perda do round
    const stateAfterLoss = {
      ...stateAfterAllIn,
      players: stateAfterAllIn.players.map((player, index) => 
        index === 0 
          ? { ...player, status: "ELIMINATED" as const, chips: 0 }
          : player
      )
    };
    
    console.log("\nRound 1 - After loss (Strategist eliminated):");
    stateAfterLoss.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Round 2: Início do próximo round
    const round2State = Effect.runSync(nextRound(stateAfterLoss));
    
    console.log("\nRound 2 - After nextRound:");
    round2State.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Round 3: Simular mais um round
    const round3State = Effect.runSync(nextRound(round2State));
    
    console.log("\nRound 3 - After nextRound:");
    round3State.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Verificar que The Strategist permanece ELIMINATED em todos os rounds
    expect(round2State.players[0].status).toBe("ELIMINATED");
    expect(round2State.players[0].chips).toBe(0);
    expect(round3State.players[0].status).toBe("ELIMINATED");
    expect(round3State.players[0].chips).toBe(0);
    
    // Verificar que outros jogadores não foram afetados incorretamente
    for (let i = 1; i < round3State.players.length; i++) {
      const player = round3State.players[i];
      if (player.status !== "FOLDED") {
        expect(player.status).toBe("PLAYING");
        expect(player.chips).toBeGreaterThan(0);
      }
    }
  });

  test('Bug 11: Eliminated player should not be affected by all-in logic in subsequent rounds', () => {
    const state = createRealBugScenario();
    
    // Configurar jogadores
    const updatedPlayers = [...state.players];
    updatedPlayers[0] = { ...updatedPlayers[0], chips: 0, status: "ELIMINATED" as const }; // The Strategist (eliminated)
    updatedPlayers[1] = { ...updatedPlayers[1], chips: 50, bet: { amount: 0, volume: 0 } }; // The Grinder (poucos chips)
    updatedPlayers[2] = { ...updatedPlayers[2], chips: 200, bet: { amount: 0, volume: 0 } }; // The Veteran
    updatedPlayers[3] = { ...updatedPlayers[3], chips: 200, bet: { amount: 0, volume: 0 } }; // The Showman
    updatedPlayers[4] = { ...updatedPlayers[4], chips: 200, bet: { amount: 0, volume: 0 } }; // The Trickster
    
    const stateWithEliminated = { 
      ...state, 
      players: updatedPlayers,
      round: { ...state.round, currentBet: 100 },
      currentPlayerIndex: 1, // The Grinder
      phase: { ...state.phase, street: "TURN" as const }
    };
    
    console.log("=== ELIMINATED PLAYER ALL-IN LOGIC TEST ===");
    console.log("Initial state:");
    stateWithEliminated.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // The Grinder faz call (vira all-in)
    const grinderCall: Move = { 
      type: "call", 
      decisionContext: null
    };
    const stateAfterCall = Effect.runSync(processPlayerMove(stateWithEliminated, grinderCall));
    
    console.log("\nAfter Grinder call (all-in):");
    stateAfterCall.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.playerName}, chips: ${p.chips}, status: ${p.status}`);
    });
    
    // Verificar que The Strategist permanece ELIMINATED, não foi afetado pela lógica de all-in
    const eliminatedPlayer = stateAfterCall.players[0];
    expect(eliminatedPlayer.status).toBe("ELIMINATED");
    expect(eliminatedPlayer.chips).toBe(0);
    
    // Verificar que The Grinder foi para ALL_IN
    const grinderPlayer = stateAfterCall.players[1];
    expect(grinderPlayer.status).toBe("ALL_IN");
    expect(grinderPlayer.chips).toBe(0);
    expect(grinderPlayer.bet.amount).toBe(50);
  });
});