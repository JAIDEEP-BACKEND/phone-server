export declare const SOCKET_EVENTS: {
    readonly TERMINAL_DATA: "terminal:data";
    readonly TERMINAL_INPUT: "terminal:input";
    readonly TERMINAL_RESIZE: "terminal:resize";
    readonly TERMINAL_EXIT: "terminal:exit";
    readonly SYSTEM_STATS: "system:stats";
    readonly SYSTEM_STATS_SUBSCRIBE: "system:stats:subscribe";
    readonly SYSTEM_STATS_UNSUBSCRIBE: "system:stats:unsubscribe";
    readonly ACTIVITY_EVENT: "activity:event";
    readonly REMOTE_SCREEN_START: "remote:screen:start";
    readonly REMOTE_SCREEN_STOP: "remote:screen:stop";
    readonly REMOTE_SCREEN_FRAME: "remote:screen:frame";
    readonly REMOTE_SCREEN_STATUS: "remote:screen:status";
    readonly REMOTE_TOUCH_DOWN: "remote:touch:down";
    readonly REMOTE_TOUCH_MOVE: "remote:touch:move";
    readonly REMOTE_TOUCH_UP: "remote:touch:up";
    readonly REMOTE_GESTURE_SWIPE: "remote:gesture:swipe";
    readonly REMOTE_NAV_BACK: "remote:nav:back";
    readonly REMOTE_NAV_HOME: "remote:nav:home";
    readonly REMOTE_NAV_RECENTS: "remote:nav:recents";
    readonly REMOTE_NAV_LOCK: "remote:nav:lock";
    readonly REMOTE_VOLUME_UP: "remote:volume:up";
    readonly REMOTE_VOLUME_DOWN: "remote:volume:down";
    readonly REMOTE_VOLUME_MUTE: "remote:volume:mute";
    readonly REMOTE_APP_LAUNCH: "remote:app:launch";
    readonly REMOTE_CLIPBOARD_READ: "remote:clipboard:read";
    readonly REMOTE_CLIPBOARD_WRITE: "remote:clipboard:write";
    readonly REMOTE_CLIPBOARD_DATA: "remote:clipboard:data";
    readonly REMOTE_NOTIFICATIONS_LIST: "remote:notifications:list";
    readonly REMOTE_NOTIFICATION_NEW: "remote:notification:new";
    readonly REMOTE_NOTIFICATION_DISMISS: "remote:notification:dismiss";
    readonly DEVICE_CAPABILITIES: "device:capabilities";
};
export interface TouchPoint {
    x: number;
    y: number;
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
    data: string;
    width: number;
    height: number;
    timestamp: number;
    fps?: number;
}
//# sourceMappingURL=socket-events.d.ts.map