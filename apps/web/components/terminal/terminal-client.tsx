'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@android-server/shared';
import { Trash2, Terminal as TermIcon, RefreshCw } from 'lucide-react';

export default function TerminalClient() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true, // Fixes Linux/Unix staircase newline formatting
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.25,
      theme: {
        background: '#07070a',
        foreground: '#e2e8f0',
        cursor: '#00f0ff',
        selectionBackground: 'rgba(0, 240, 255, 0.25)',
        black: '#07070a',
        red: '#ff3366',
        green: '#00ff88',
        yellow: '#ffb700',
        blue: '#00f0ff',
        magenta: '#ff007f',
        cyan: '#00f0ff',
        white: '#e2e8f0',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    const socket = getSocket();

    const handleConnect = () => {
      setConnected(true);
      setError(null);
      socket.emit('terminal:init');
      socket.emit(SOCKET_EVENTS.TERMINAL_RESIZE, {
        cols: term.cols,
        rows: term.rows,
      });
    };

    const handleData = (data: string) => {
      term.write(data);
    };

    const handleError = (msg: string) => {
      setError(msg);
      term.writeln(`\r\n\x1b[31m[ERROR] ${msg}\x1b[0m\r\n`);
    };

    const handleExit = ({ exitCode }: { exitCode?: number }) => {
      setConnected(false);
      term.writeln(`\r\n\x1b[33m[PROCESS EXITED with code ${exitCode}]\x1b[0m\r\n`);
    };

    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on(SOCKET_EVENTS.TERMINAL_DATA, handleData);
    socket.on('terminal:error', handleError);
    socket.on(SOCKET_EVENTS.TERMINAL_EXIT, handleExit);

    term.onData((input) => {
      socket.emit(SOCKET_EVENTS.TERMINAL_INPUT, input);
    });

    const handleResize = () => {
      if (fitAddonRef.current && xtermInstance.current) {
        fitAddonRef.current.fit();
        socket.emit(SOCKET_EVENTS.TERMINAL_RESIZE, {
          cols: xtermInstance.current.cols,
          rows: xtermInstance.current.rows,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('connect', handleConnect);
      socket.off(SOCKET_EVENTS.TERMINAL_DATA, handleData);
      socket.off('terminal:error', handleError);
      socket.off(SOCKET_EVENTS.TERMINAL_EXIT, handleExit);
      term.dispose();
    };
  }, []);

  const handleClear = () => {
    xtermInstance.current?.clear();
  };

  const handleReconnect = () => {
    const socket = getSocket();
    socket.emit('terminal:init');
    setConnected(true);
    setError(null);
  };

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col hud-card rounded-xl overflow-hidden shadow-2xl">
      {/* Terminal Top Bar */}
      <div className="flex h-12 items-center justify-between border-b border-cyan-500/20 bg-black/50 px-4 font-mono text-xs backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <TermIcon className="h-4 w-4 text-cyan-400" />
            <span className="font-orbitron font-bold text-xs tracking-wider text-cyan-400 text-glow-cyan">
              TERMINAL CONSOLE
            </span>
          </div>

          <div className="flex items-center space-x-1.5 rounded-full bg-cyan-950/40 px-2.5 py-0.5 border border-cyan-500/30">
            <div
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className={`text-[10px] font-orbitron font-bold tracking-wide ${connected ? 'text-emerald-400' : 'text-rose-500'}`}>
              {connected ? '[ONLINE]' : '[OFFLINE]'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick command buttons */}
          <div className="hidden md:flex items-center space-x-1">
            {['ls -la', 'df -h', 'free -m', 'ip a', 'uptime'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => {
                  const socket = getSocket();
                  socket.emit(SOCKET_EVENTS.TERMINAL_INPUT, `${cmd}\n`);
                }}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-fg-muted hover:bg-white/10 hover:text-accent-blue transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>

          <button
            onClick={handleClear}
            title="Clear terminal buffer"
            className="flex items-center space-x-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-fg-muted hover:bg-white/10 hover:text-fg transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          {!connected && (
            <button
              onClick={handleReconnect}
              title="Reconnect"
              className="flex items-center space-x-1 rounded-lg border border-accent-blue/50 bg-accent-blue/20 px-2.5 py-1 text-accent-blue hover:bg-accent-blue hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Reconnect</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal Canvas Container */}
      <div className="flex-1 bg-[#080808] p-3 overflow-hidden">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
}
