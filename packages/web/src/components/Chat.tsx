import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isSpawningAgents?: boolean;
  currentRoom?: string;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, isSpawningAgents, currentRoom }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      background: 'white'
    }}>
      <div style={{ 
        padding: '16px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Chat</h2>
      </div>
      
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              marginBottom: '12px',
              textAlign: message.sender === 'user' ? 'right' : 'left'
            }}
          >
            <div style={{
              display: 'inline-block',
              maxWidth: '70%',
              padding: '10px 14px',
              borderRadius: '18px',
              backgroundColor: message.sender === 'user' ? '#007aff' : '#e9e9eb',
              color: message.sender === 'user' ? 'white' : 'black',
              wordWrap: 'break-word'
            }}>
              {message.text}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#999',
              marginTop: '4px'
            }}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form 
        onSubmit={handleSubmit}
        style={{
          padding: '12px',
          borderTop: '1px solid #e0e0e0'
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '20px',
              outline: 'none',
              fontSize: '14px'
            }}
          />
          <button 
            type="submit"
            disabled={!input.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007aff',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              opacity: input.trim() ? 1 : 0.5
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;