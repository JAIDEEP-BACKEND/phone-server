'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Play,
  Square,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  Layers,
  Clipboard,
  Info,
  Lock,
  ChevronLeft,
  Home,
  Grid,
  Send,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  SOCKET_EVENTS,
  ScreenFramePayload,
  DeviceCapabilities,
  AppInfo,
  TouchPoint,
} from '@android-server/shared';
import { getSocket } from '@/lib/socket';
import { fetchApi } from '@/lib/api';

export default function RemotePage() {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [screenActive, setScreenActive] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({ fps: 30, resolution: '1080 x 2400', latencyMs: 25 });
  const [activeTab, setActiveTab] = useState<'screen' | 'apps' | 'clipboard' | 'info'>('screen');

  // Apps & Clipboard
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [clipboardText, setClipboardText] = useState('');
  const [newClipboardInput, setNewClipboardInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const screenContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Fetch capabilities
    fetchApi('/api/system/capabilities')
      .then((c) => {
        if (isMounted) setCapabilities(c);
      })
      .catch(() => {});

    // Fetch installed apps
    fetchApi('/api/phone/apps')
      .then((a) => {
        if (isMounted) setApps(a);
      })
      .catch(() => {});

    const socket = getSocket();

    const handleCaps = (c: DeviceCapabilities) => {
      if (isMounted) setCapabilities(c);
    };

    const handleFrame = (payload: ScreenFramePayload) => {
      if (isMounted) {
        setCurrentFrame(payload.data);
        if (payload.fps) {
          setMetrics((m) => ({
            ...m,
            fps: payload.fps || 30,
            resolution: `${payload.width} x ${payload.height}`,
          }));
        }
      }
    };

    const handleClipboard = (data: { text: string }) => {
      if (isMounted && data?.text) {
        setClipboardText(data.text);
        setStatusMessage('Clipboard received from phone.');
      }
    };

    socket.on(SOCKET_EVENTS.DEVICE_CAPABILITIES, handleCaps);
    socket.on(SOCKET_EVENTS.REMOTE_SCREEN_FRAME, handleFrame);
    socket.on(SOCKET_EVENTS.REMOTE_CLIPBOARD_DATA, handleClipboard);

    return () => {
      isMounted = false;
      socket.emit(SOCKET_EVENTS.REMOTE_SCREEN_STOP);
      socket.off(SOCKET_EVENTS.DEVICE_CAPABILITIES, handleCaps);
      socket.off(SOCKET_EVENTS.REMOTE_SCREEN_FRAME, handleFrame);
      socket.off(SOCKET_EVENTS.REMOTE_CLIPBOARD_DATA, handleClipboard);
    };
  }, []);

  const startScreen = () => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.REMOTE_SCREEN_START);
    setScreenActive(true);
  };

  const stopScreen = () => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.REMOTE_SCREEN_STOP);
    setScreenActive(false);
  };

  // Convert mouse/pointer event on screen container to normalized (0.0 to 1.0) coordinates
  const getNormalizedPoint = (e: React.MouseEvent<HTMLDivElement>): TouchPoint | null => {
    if (!screenContainerRef.current) return null;
    const rect = screenContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const point = getNormalizedPoint(e);
    if (point) {
      getSocket().emit(SOCKET_EVENTS.REMOTE_TOUCH_DOWN, point);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const point = getNormalizedPoint(e);
    if (point) {
      getSocket().emit(SOCKET_EVENTS.REMOTE_TOUCH_MOVE, point);
    }
  };

  const handlePointerUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const point = getNormalizedPoint(e);
    if (point) {
      getSocket().emit(SOCKET_EVENTS.REMOTE_TOUCH_UP, point);
    }
  };

  // Navigation actions
  const sendNav = (action: 'back' | 'home' | 'recents' | 'lock') => {
    const socket = getSocket();
    if (action === 'back') socket.emit(SOCKET_EVENTS.REMOTE_NAV_BACK);
    if (action === 'home') socket.emit(SOCKET_EVENTS.REMOTE_NAV_HOME);
    if (action === 'recents') socket.emit(SOCKET_EVENTS.REMOTE_NAV_RECENTS);
    if (action === 'lock') socket.emit(SOCKET_EVENTS.REMOTE_NAV_LOCK);
  };

  // Volume actions
  const sendVolume = (action: 'up' | 'down' | 'mute') => {
    const socket = getSocket();
    if (action === 'up') socket.emit(SOCKET_EVENTS.REMOTE_VOLUME_UP);
    if (action === 'down') socket.emit(SOCKET_EVENTS.REMOTE_VOLUME_DOWN);
    if (action === 'mute') socket.emit(SOCKET_EVENTS.REMOTE_VOLUME_MUTE);
  };

  // Launch app
  const handleLaunchApp = async (pkg: string) => {
    try {
      await fetchApi('/api/phone/launch', {
        method: 'POST',
        body: JSON.stringify({ packageName: pkg }),
      });
      setStatusMessage(`Launched ${pkg}`);
    } catch (err: any) {
      setStatusMessage(`Failed to launch: ${err.message}`);
    }
  };

  // Clipboard sync
  const handleReadClipboard = () => {
    getSocket().emit(SOCKET_EVENTS.REMOTE_CLIPBOARD_READ);
  };

  const handleSendClipboard = () => {
    if (!newClipboardInput.trim()) return;
    getSocket().emit(SOCKET_EVENTS.REMOTE_CLIPBOARD_WRITE, { text: newClipboardInput });
    setNewClipboardInput('');
    setStatusMessage('Sent text to phone clipboard.');
  };

  const isCompanionConnected = capabilities?.companionConnected;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Top Remote Header */}
      <div className="flex items-center justify-between rounded border border-border bg-bg-panel px-4 py-2.5 font-mono text-xs">
        <div className="flex items-center space-x-2">
          <Smartphone className="h-4 w-4 text-accent-blue" />
          <span className="font-semibold text-fg">OPPO_REMOTE_CONSOLE</span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <div
              className={`h-2 w-2 rounded-full ${
                isCompanionConnected ? 'bg-accent-green animate-pulse' : 'bg-accent-red'
              }`}
            />
            <span className={isCompanionConnected ? 'text-accent-green' : 'text-accent-red'}>
              {isCompanionConnected ? 'CONNECTED' : 'COMPANION DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded border border-border bg-bg-panel px-3 py-2 font-mono text-xs text-accent-blue flex justify-between items-center">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-fg-subtle hover:text-fg">
            ×
          </button>
        </div>
      )}

      {/* Main Remote Controller Card */}
      <div className="flex flex-col items-center rounded border border-border bg-bg-panel p-4">
        {/* Screen Controls & Metrics Bar */}
        <div className="mb-3 flex w-full max-w-md items-center justify-between font-mono text-xs">
          <div className="flex items-center space-x-2">
            {!screenActive ? (
              <button
                onClick={startScreen}
                disabled={!isCompanionConnected}
                className="flex items-center space-x-1.5 rounded border border-accent-green/50 bg-accent-green-subtle px-2.5 py-1 text-accent-green hover:bg-accent-green hover:text-white transition-colors disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start Screen</span>
              </button>
            ) : (
              <button
                onClick={stopScreen}
                className="flex items-center space-x-1.5 rounded border border-accent-red/50 bg-accent-red-subtle px-2.5 py-1 text-accent-red hover:bg-accent-red hover:text-white transition-colors"
              >
                <Square className="h-3.5 w-3.5" />
                <span>Stop Screen</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-fg-muted">
            <span className="flex items-center space-x-1">
              <span className={`h-1.5 w-1.5 rounded-full ${screenActive ? 'bg-accent-green animate-pulse' : 'bg-fg-subtle'}`} />
              <span>{screenActive ? 'LIVE' : 'IDLE'}</span>
            </span>
            <span>{metrics.fps} FPS</span>
            <span>{metrics.resolution}</span>
          </div>
        </div>

        {/* Screen Frame Container / Display */}
        <div
          ref={screenContainerRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          className="relative flex h-[520px] w-full max-w-xs sm:max-w-sm flex-col items-center justify-center rounded-lg border-2 border-border bg-black overflow-hidden shadow-2xl select-none cursor-crosshair"
        >
          {currentFrame && screenActive ? (
            /* Real Screen Frame from MediaProjection */
            <img
              src={`data:image/jpeg;base64,${currentFrame}`}
              alt="Android Screen"
              className="h-full w-full object-contain pointer-events-none"
            />
          ) : (
            /* Setup / Permission Notice */
            <div className="flex flex-col items-center space-y-3 p-6 text-center font-mono">
              <Smartphone className="h-10 w-10 text-fg-subtle" />
              <div className="text-xs font-semibold uppercase text-fg">
                {!isCompanionConnected ? 'Companion App Required' : 'Screen Stream Paused'}
              </div>
              <p className="text-[11px] text-fg-muted leading-relaxed max-w-xs">
                {!isCompanionConnected
                  ? 'Install the Companion APK on your phone and link it to enable screen projection and touch control.'
                  : 'Press "Start Screen" to begin streaming frames from Android MediaProjection.'}
              </p>
              {!isCompanionConnected && (
                <div className="rounded border border-border bg-bg-subtle p-2.5 text-left text-[11px] text-fg-subtle space-y-1">
                  <div>1. Grant Screen Capture permission on phone</div>
                  <div>2. Enable Accessibility Service</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Bar: BACK, HOME, RECENTS, LOCK */}
        <div className="mt-4 flex w-full max-w-sm items-center justify-between rounded border border-border bg-bg-base p-1.5 font-mono text-xs">
          <button
            onClick={() => sendNav('back')}
            title="Back"
            className="flex flex-1 items-center justify-center space-x-1 rounded py-1.5 text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>BACK</span>
          </button>

          <button
            onClick={() => sendNav('home')}
            title="Home"
            className="flex flex-1 items-center justify-center space-x-1 rounded py-1.5 text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>HOME</span>
          </button>

          <button
            onClick={() => sendNav('recents')}
            title="Recents"
            className="flex flex-1 items-center justify-center space-x-1 rounded py-1.5 text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
          >
            <Grid className="h-4 w-4" />
            <span>RECENTS</span>
          </button>

          <button
            onClick={() => sendNav('lock')}
            title="Lock Screen"
            className="flex flex-1 items-center justify-center space-x-1 rounded py-1.5 text-fg-muted hover:bg-bg-hover hover:text-accent-blue transition-colors"
          >
            <Lock className="h-4 w-4" />
            <span>LOCK</span>
          </button>
        </div>

        {/* Volume Controls: VOL -, MUTE, VOL + */}
        <div className="mt-2 flex w-full max-w-sm items-center justify-between rounded border border-border bg-bg-base p-1.5 font-mono text-xs">
          <button
            onClick={() => sendVolume('down')}
            className="flex flex-1 items-center justify-center space-x-1 rounded py-1.5 text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
          >
            <Volume1 className="h-4 w-4" />
            <span>VOL -</span>
          </button>

          <button
            onClick={() => sendVolume('mute')}
            className="flex flex-1 items-center justify-center space-x-1 rounded py-1.5 text-fg-muted hover:bg-bg-hover hover:text-accent-red transition-colors"
          >
            <VolumeX className="h-4 w-4" />
            <span>MUTE</span>
          </button>

          <button
            onClick={() => sendVolume('up')}
            className="flex flex-1 items-center justify-center space-x-1 rounded py-1.5 text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
          >
            <Volume2 className="h-4 w-4" />
            <span>VOL +</span>
          </button>
        </div>

        {/* Action Tabs: SCREEN, APPS, CLIPBOARD, INFO */}
        <div className="mt-4 flex w-full max-w-sm border-b border-border font-mono text-xs">
          <button
            onClick={() => setActiveTab('screen')}
            className={`flex-1 pb-2 font-medium ${
              activeTab === 'screen' ? 'border-b-2 border-accent-blue text-accent-blue' : 'text-fg-muted hover:text-fg'
            }`}
          >
            SCREEN
          </button>
          <button
            onClick={() => setActiveTab('apps')}
            className={`flex-1 pb-2 font-medium ${
              activeTab === 'apps' ? 'border-b-2 border-accent-blue text-accent-blue' : 'text-fg-muted hover:text-fg'
            }`}
          >
            APPS
          </button>
          <button
            onClick={() => setActiveTab('clipboard')}
            className={`flex-1 pb-2 font-medium ${
              activeTab === 'clipboard' ? 'border-b-2 border-accent-blue text-accent-blue' : 'text-fg-muted hover:text-fg'
            }`}
          >
            CLIPBOARD
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 pb-2 font-medium ${
              activeTab === 'info' ? 'border-b-2 border-accent-blue text-accent-blue' : 'text-fg-muted hover:text-fg'
            }`}
          >
            INFO
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-3 w-full max-w-sm">
          {activeTab === 'apps' && (
            <div className="space-y-2 font-mono text-xs">
              <div className="text-[11px] text-fg-subtle">Permitted Applications:</div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {apps.map((app) => (
                  <div
                    key={app.packageName}
                    className="flex items-center justify-between rounded border border-border bg-bg-base p-2"
                  >
                    <div className="truncate pr-2">
                      <div className="font-semibold text-fg">{app.name}</div>
                      <div className="text-[10px] text-fg-subtle truncate">{app.packageName}</div>
                    </div>
                    <button
                      onClick={() => handleLaunchApp(app.packageName)}
                      className="rounded border border-accent-blue/50 bg-accent-blue-subtle px-2 py-1 text-[11px] text-accent-blue hover:bg-accent-blue hover:text-white transition-colors"
                    >
                      Launch
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'clipboard' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-fg-subtle">Device Clipboard:</span>
                <button
                  onClick={handleReadClipboard}
                  className="rounded border border-border bg-bg-base px-2 py-1 text-[11px] text-fg-muted hover:text-fg"
                >
                  Read From Phone
                </button>
              </div>
              <div className="rounded border border-border bg-bg-base p-2 text-fg min-h-[48px] break-all">
                {clipboardText || '(Clipboard is empty or not yet read)'}
              </div>

              <div className="space-y-1">
                <span className="text-fg-subtle">Send text to Phone:</span>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Type text to paste on Android..."
                    value={newClipboardInput}
                    onChange={(e) => setNewClipboardInput(e.target.value)}
                    className="flex-1 rounded border border-border bg-bg-base px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent-blue"
                  />
                  <button
                    onClick={handleSendClipboard}
                    className="rounded bg-accent-blue px-3 py-1.5 text-white font-medium hover:bg-blue-600"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-2 font-mono text-xs text-fg-muted">
              <div className="flex justify-between border-b border-border/50 py-1">
                <span>Accessibility:</span>
                <span className={capabilities?.accessibility === 'READY' ? 'text-accent-green' : 'text-accent-red'}>
                  {capabilities?.accessibility || 'REQUIRED'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 py-1">
                <span>Screen Capture:</span>
                <span className={capabilities?.screenCapture === 'READY' ? 'text-accent-green' : 'text-accent-red'}>
                  {capabilities?.screenCapture || 'REQUIRED'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 py-1">
                <span>Root State:</span>
                <span className="text-fg-subtle">{capabilities?.root || 'UNAVAILABLE'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
