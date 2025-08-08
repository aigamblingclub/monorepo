import React, { useState, useEffect } from 'react';
import PokerTable from './poker/PokerTable';
import { PokerState } from '../types/poker';
import { createAgentApiClient, AgentApiClient, fetchPokerState, startPokerGame } from '../client/poker-rpc';

interface PokerCanvasProps {
  roomId: string;
  onAgentsSpawned?: (agents: any[]) => void;
  shouldStartGame?: boolean;
}

const PokerCanvas: React.FC<PokerCanvasProps> = ({ roomId, onAgentsSpawned, shouldStartGame }) => {
  const [gameState, setGameState] = useState<PokerState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [agentClient] = useState<AgentApiClient>(() => 
    createAgentApiClient('http://localhost:3001')
  );
  const [runningAgents, setRunningAgents] = useState<any[]>([]);
  const [customCharacterJson, setCustomCharacterJson] = useState<string>('');
  const [showCharacterInput, setShowCharacterInput] = useState(false);

  // Fetch current poker state
  const fetchGameState = async () => {
    const state = await fetchPokerState(roomId);
    if (state) {
      setGameState(state);
    }
  };

  // Check running agents
  const checkRunningAgents = async () => {
    try {
      const result = await agentClient.getRunningAgents(roomId);
      if (result.success) {
        setRunningAgents(result.agents || []);
      }
    } catch (error) {
      console.error('Failed to check running agents:', error);
    }
  };

  // Spawn agents
  const spawnAgents = async () => {
    if (isLoading) return; // Prevent multiple concurrent calls
    
    setIsLoading(true);
    try {
      let customCharacter: Record<string, unknown> | undefined;
      
      // Parse custom character JSON if provided
      if (customCharacterJson.trim()) {
        try {
          customCharacter = JSON.parse(customCharacterJson);
        } catch (error) {
          alert('Invalid JSON format for custom character');
          setIsLoading(false);
          return;
        }
      }
      
      const result = await agentClient.spawnAgents(roomId, 2, customCharacter);
      if (result.success) {
        setRunningAgents(result.agents || []);
        onAgentsSpawned?.(result.agents || []);
        
        // Start the game after agents are spawned and ready
        setTimeout(async () => {
          console.log(`Starting poker game for room ${roomId}...`);
          try {
            const gameResult = await startPokerGame(roomId);
            if (gameResult) {
              console.log('Game started successfully:', gameResult);
              // Fetch the updated state
              setTimeout(() => {
                fetchGameState();
              }, 1000);
            }
          } catch (error) {
            console.error('Failed to auto-start game:', error);
          }
        }, 3000); // Give agents time to connect
      } else {
        console.error('Failed to spawn agents:', result.error);
        alert(`Failed to spawn agents: ${result.error}`);
      }
    } catch (error) {
      console.error('Error spawning agents:', error);
      alert(`Error spawning agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop agents
  const stopAgents = async () => {
    setIsLoading(true);
    try {
      const result = await agentClient.stopAgents(roomId);
      if (result.success) {
        setRunningAgents([]);
      }
    } catch (error) {
      console.error('Error stopping agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual start game
  const handleStartGame = async () => {
    setIsLoading(true);
    try {
      console.log(`Manually starting poker game for room ${roomId}...`);
      const gameResult = await startPokerGame(roomId);
      if (gameResult) {
        console.log('Game started successfully:', gameResult);
        fetchGameState();
      }
    } catch (error) {
      console.error('Error starting game:', error);
      alert(`Failed to start game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for game state updates
  useEffect(() => {
    if (runningAgents.length > 0) {
      const interval = setInterval(() => {
        fetchGameState();
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [runningAgents.length, roomId]);

  // Check for running agents on mount
  useEffect(() => {
    checkRunningAgents();
  }, [roomId]);

  // Handle shouldStartGame prop - prevent infinite retries
  useEffect(() => {
    if (shouldStartGame && runningAgents.length === 0 && !isLoading) {
      // Add a small delay to prevent immediate retries
      const timeout = setTimeout(() => {
        spawnAgents();
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [shouldStartGame]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1e3c72, #2a5298)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Control panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '15px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 100,
        minWidth: '200px'
      }}>
        <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
          Room: {roomId}
        </div>
        
        {runningAgents.length > 0 && (
          <div style={{ color: 'white', fontSize: '12px' }}>
            Agents: {runningAgents.map(a => a.name).join(', ')}
          </div>
        )}

        {/* Character customization */}
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={() => setShowCharacterInput(!showCharacterInput)}
            disabled={runningAgents.length > 0}
            style={{
              padding: '6px 10px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: runningAgents.length > 0 ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              opacity: runningAgents.length > 0 ? 0.6 : 1
            }}
          >
            {showCharacterInput ? 'Hide' : 'Custom Character'}
          </button>
          
          {showCharacterInput && (
            <div style={{ marginTop: '8px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', marginBottom: '6px', color: '#666' }}>
                Paste character JSON (first agent will use this, others use defaults):
              </div>
              <textarea
                value={customCharacterJson}
                onChange={(e) => setCustomCharacterJson(e.target.value)}
                placeholder='{"name": "My Custom Agent", "bio": "Description here", ...}'
                disabled={runningAgents.length > 0}
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '6px',
                  fontSize: '11px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  resize: 'vertical',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={spawnAgents}
            disabled={isLoading || runningAgents.length > 0}
            style={{
              padding: '8px 12px',
              background: runningAgents.length > 0 ? '#7f8c8d' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (isLoading || runningAgents.length > 0) ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: (isLoading || runningAgents.length > 0) ? 0.6 : 1
            }}
          >
            {isLoading ? 'Starting...' : 'Start Game'}
          </button>
          
          {runningAgents.length > 0 && (
            <button
              onClick={stopAgents}
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? 'Stopping...' : 'Stop Game'}
            </button>
          )}
        </div>

        {runningAgents.length > 0 && (
          <button
            onClick={handleStartGame}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              background: '#f39c12',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Starting...' : 'Start Poker'}
          </button>
        )}

        <button
          onClick={fetchGameState}
          disabled={isLoading}
          style={{
            padding: '6px 12px',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: 'bold'
          }}
        >
          Refresh State
        </button>
      </div>

      {/* Poker table */}
      {gameState ? (
        <PokerTable gameState={gameState} />
      ) : (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          color: 'white',
          fontSize: '18px'
        }}>
          {runningAgents.length > 0 ? 'Loading game state...' : `Click "Start Game" to spawn agents for room ${roomId}`}
        </div>
      )}
    </div>
  );
};

export default PokerCanvas;