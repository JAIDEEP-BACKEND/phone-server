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
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#080808',
        foreground: '#ededed',
        cursor: '#3b82f6',
        selectionBackground: '#1d4ed8',
        black: '#121212',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#ededed',
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
    <div className="flex h-[calc(100vh-6.5rem)] flex-col rounded border border-border bg-bg-panel overflow-hidden">
      {/* Terminal Top Bar */}
      <div className="flex h-11 items-center justify-between border-b border-border bg-bg-subtle px-4 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <TermIcon className="h-4 w-4 text-accent-green" />
            <span className="font-semibold text-fg">PHONE_SHELL_CONSOLE</span>
          </div>

          <div className="flex items-center space-x-1.5 rounded-full bg-black/40 px-2.5 py-0.5 border border-white/10">
            <div
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className={`text-[10px] font-semibold ${connected ? 'text-emerald-400' : 'text-rose-500'}`}>
              {connected ? 'ACTIVE' : 'DISCONNECTED'}
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
