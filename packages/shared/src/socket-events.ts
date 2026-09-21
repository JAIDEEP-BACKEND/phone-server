export const SOCKET_EVENTS = {
  // Terminal
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_EXIT: 'terminal:exit',

  // System
  SYSTEM_STATS: 'system:stats',
  SYSTEM_STATS_SUBSCRIBE: 'system:stats:subscribe',
  SYSTEM_STATS_UNSUBSCRIBE: 'system:stats:unsubscribe',

  // Activity
  ACTIVITY_EVENT: 'activity:event',

  // Remote Screen
  REMOTE_SCREEN_START: 'remote:screen:start',
  REMOTE_SCREEN_STOP: 'remote:screen:stop',
  REMOTE_SCREEN_FRAME: 'remote:screen:frame',
  REMOTE_SCREEN_STATUS: 'remote:screen:status',

  // Remote Touch / Gestures
  REMOTE_TOUCH_DOWN: 'remote:touch:down',
  REMOTE_TOUCH_MOVE: 'remote:touch:move',
  REMOTE_TOUCH_UP: 'remote:touch:up',
  REMOTE_GESTURE_SWIPE: 'remote:gesture:swipe',

  // Remote Hardware Keys / Navigation
  REMOTE_NAV_BACK: 'remote:nav:back',
  REMOTE_NAV_HOME: 'remote:nav:home',
  REMOTE_NAV_RECENTS: 'remote:nav:recents',
  REMOTE_NAV_LOCK: 'remote:nav:lock',

  // Volume
  REMOTE_VOLUME_UP: 'remote:volume:up',
  REMOTE_VOLUME_DOWN: 'remote:volume:down',
  REMOTE_VOLUME_MUTE: 'remote:volume:mute',

  // Apps
  REMOTE_APP_LAUNCH: 'remote:app:launch',

  // Clipboard
  REMOTE_CLIPBOARD_READ: 'remote:clipboard:read',
  REMOTE_CLIPBOARD_WRITE: 'remote:clipboard:write',
  REMOTE_CLIPBOARD_DATA: 'remote:clipboard:data',

  // Notifications
  REMOTE_NOTIFICATIONS_LIST: 'remote:notifications:list',
  REMOTE_NOTIFICATION_NEW: 'remote:notification:new',
  REMOTE_NOTIFICATION_DISMISS: 'remote:notification:dismiss',

  // Device status / capabilities
  DEVICE_CAPABILITIES: 'device:capabilities',
} as const;

export interface TouchPoint {
  x: number; // 0.0 to 1.0 (normalized percentage of screen width)
  y: number; // 0.0 to 1.0 (normalized percentage of screen height)
  pointerId?: number;
}

export interface SwipeGesture {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
}

export interface ScreenFramePayload {
  data: string; // Base64 JPEG or binary ArrayBuffer
  width: number;
  height: number;
  timestamp: number;
  fps?: number;
}
