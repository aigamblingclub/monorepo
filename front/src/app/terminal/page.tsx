'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

export default function ChecklistPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [currentDirectory] = useState('~/near');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const wasAtBottomRef = useRef(true);
  const router = useRouter();

  const checklistItems = [
    { id: 1, text: 'Live Feed of Bet Pools (WSS)', completed: false, priority: 'HIGH' },
    { id: 2, text: 'Typewriter effect among other visual animations for game transitions', completed: false, priority: 'HIGH' },
    { id: 3, text: 'Introduce new AI Agent', completed: false, priority: 'MEDIUM' },
    { id: 4, text: 'Game History Analysis', completed: false, priority: 'MEDIUM' },
    { id: 5, text: 'AI History Analysis', completed: false, priority: 'LOW' },
  ];

  // Check if at bottom before output changes
  const checkIfAtBottom = () => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.getScrollElement();
      if (scrollElement) {
        const { scrollTop, scrollHeight, clientHeight } = scrollElement;
        wasAtBottomRef.current = scrollTop + clientHeight >= scrollHeight - 10;
      }
    }
  };

  // Auto-scroll to bottom after output changes if was at bottom before
  useEffect(() => {
    if (wasAtBottomRef.current && scrollRef.current) {
      setTimeout(() => {
        const scrollElement = scrollRef.current.getScrollElement();
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }
      }, 50); // Increased delay to ensure DOM is updated
    }
  }, [output]);

  useEffect(() => {
    // Focus on input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Initial welcome message
    setOutput([
      'Welcome to AI Gambling Club Closed Alpha',
      'Type "agc help" for available commands',
      'Type "exit", "quit", or "q" to return to main page',
      '',
    ]);
  }, []);

  const handleBannerClick = () => {
    router.push('/');
  };

  const handleCommand = (command: string) => {
    // Check if at bottom before adding new content
    checkIfAtBottom();
    
    const cmd = command.trim().toLowerCase();
    const newOutput = [...output, `user@agc:${currentDirectory}$ ${command}`];

    switch (cmd) {
      case 'help':
      case 'agc help':
        newOutput.push(
          'Available commands:',
          '  ls          - List roadmap items',
          '  cat todo    - Display checklist',
          '  status      - Show development status',
          '  clear       - Clear terminal',
          '  exit/quit/q - Return to main page',
          ''
        );
        break;

      case 'ls':
        newOutput.push(
          'todo.txt    priorities.md    status.log',
          ''
        );
        break;

      case 'cat todo':
      case 'todo':
        newOutput.push('═══════════════════════════════════════════════════════');
        newOutput.push('                DEVELOPMENT ROADMAP v0.2');
        newOutput.push('═══════════════════════════════════════════════════════');
        newOutput.push('');
        checklistItems.forEach((item, index) => {
          const status = item.completed ? '[✓]' : '[ ]';
          const priority = `[${item.priority}]`;
          newOutput.push(`${index + 1}. ${status} ${item.text} ${priority}`);
        });
        newOutput.push('');
        newOutput.push('Legend: [✓] Complete  [ ] Pending');
        newOutput.push('Priority: [HIGH] [MEDIUM] [LOW]');
        newOutput.push('');
        break;

      case 'status':
        const totalItems = checklistItems.length;
        const completedItems = checklistItems.filter(item => item.completed).length;
        const progress = Math.round((completedItems / totalItems) * 100);
        
        newOutput.push('Development Status Report:');
        newOutput.push(`Progress: ${completedItems}/${totalItems} (${progress}%)`);
        newOutput.push('');
        newOutput.push('█░░░░░░░░░░ 10% - Just getting started!');
        newOutput.push('');
        newOutput.push('Next Sprint Focus: Live Feed & Visual Effects');
        newOutput.push('');
        break;

      case 'clear':
        wasAtBottomRef.current = true; // Always scroll after clear
        setOutput([]);
        return;

      case 'exit':
      case 'quit':
      case 'q':
        router.push('/');
        return;

      case '':
        // Empty command, just show prompt
        break;

      default:
        newOutput.push(`Command not found: ${command}`);
        newOutput.push('Type "agc help" for available commands');
        newOutput.push('');
        break;
    }

    setOutput(newOutput);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      handleCommand(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion for common commands
      const commands = ['agc help', 'help', 'ls', 'cat todo', 'status', 'clear', 'exit'];
      const matches = commands.filter(cmd => cmd.startsWith(input.toLowerCase()));
      if (matches.length === 1) {
        setInput(matches[0]);
      }
    }
  };

  const renderPrompt = () => (
    <span>
      <span style={{ color: '#00ff00', textShadow: 'none', opacity: 1 }}>user</span>
      <span style={{ color: '#ffffff', textShadow: 'none', opacity: 1 }}>@</span>
      <span style={{ color: '#ffff00', textShadow: 'none', opacity: 1 }}>agc</span>
      <span style={{ color: '#ffffff', textShadow: 'none', opacity: 1 }}>:</span>
      <span style={{ color: '#ff00ff', textShadow: 'none', opacity: 1 }}>{currentDirectory}</span>
      <span style={{ color: '#00ff00', textShadow: 'none', opacity: 1 }}>$</span>
    </span>
  );

  return (
    <div className="bg-black min-h-screen font-mono text-[var(--theme-primary)] p-4">
      {/* Terminal Window */}
      <div className="flex justify-center items-center min-h-screen">
        <div 
          className="border-[var(--border-width)] border-[var(--theme-primary)] bg-[var(--surface-secondary)] rounded-[var(--border-radius-element)] shadow-[0_0_var(--shadow-strength)_var(--theme-primary),inset_0_0_var(--shadow-inner-strength)_var(--theme-primary)]"
          style={{ 
            width: '800px', 
            height: '600px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          
          {/* Terminal Header */}
          <div 
            className="border-b border-[var(--theme-primary)] p-3 flex items-center gap-3"
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50px',
              boxSizing: 'border-box'
            }}
          >
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="text-sm opacity-80">
              Terminal - AGC
            </div>
          </div>

          {/* Terminal Content */}
          <SimpleBar
            // @ts-expect-error - SimpleBar ref is not typed
            ref={scrollRef}
            autoHide={false}
            className='ai-thoughts-scrollbar'
            style={{ 
              position: 'absolute',
              top: '50px',
              left: 0,
              right: 0,
              bottom: 0,
              boxSizing: 'border-box'
            }}
          >
            <div className="p-4">
            
              {/* ASCII Banner inside terminal - Clickable and Left Aligned */}
              <div 
                className="mb-6 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleBannerClick}
                title="Click to return to main page"
              >
                <div className="text-sm opacity-70 mb-2">
                  <span className="opacity-90">user@agc:~/near$ cat banner.txt</span>
                </div>
                <pre className="text-lg leading-tight whitespace-pre [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)] select-none">
{`╔═══════════════════════════════════╗
║ AI GAMBLING CLUB          [ALPHA] ║
║ ================          █████   ║
║ PROMPT2WIN  v0.1                  ║
╚═══════════════════════════════════╝`}
                </pre>
              </div>
              
              {/* Output */}
              <div className="mb-4">
                {output.map((line, index) => (
                  <div key={index} className="whitespace-pre-wrap [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)]">
                    {line}
                  </div>
                ))}
              </div>

              {/* Input Line */}
              <form onSubmit={handleSubmit} className="flex items-center">
                <span className="mr-2">
                  {renderPrompt()}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-[var(--theme-primary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)]"
                  placeholder="Type a command..."
                  autoComplete="off"
                  spellCheck="false"
                />
                <span className="animate-pulse ml-1">_</span>
              </form>
            </div>
          </SimpleBar>
        </div>
      </div>
    </div>
  );
} 