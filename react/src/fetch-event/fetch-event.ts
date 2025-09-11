import { fetchEventSource, type FetchEventSourceInit } from "./fetch";
import type { EventSourceMessage } from "./parse";

export class EventSourceClient {
  private url: string;
  private options: FetchEventSourceInit;
  private controller: AbortController | null = null;
  private connectingPromise: Promise<void> | null = null;
  private listeners: Record<string, Set<(payload: any) => void>> = {};
  private lastEventId?: string;

  constructor(url: string, options: FetchEventSourceInit) {
    this.url = url;
    this.options = options;
  }

  public on(event: string, handler: (payload: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event].add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler?: (payload: any) => void) {
    const set = this.listeners[event];
    if (!set) return;
    if (handler) set.delete(handler);
    else set.clear();
  }

  public once(event: string, handler: (payload: any) => void) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  private emit(event: string, payload?: any) {
    const set = this.listeners[event];
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch { /* 忽略单个错误 */ }
    }
  }

  public async connect() {
    if (this.connectingPromise) return this.connectingPromise;

    this.controller = new AbortController();

    const { onopen, onmessage, onclose, onerror, ...rest } = this.options;

    const handleOpen = async (res: Response) => {
      await onopen?.(res);
      this.emit("open", res);
    };

    const handleMessage = (msg: EventSourceMessage) => {
      this.lastEventId = msg.id || this.lastEventId;
      onmessage?.(msg);
      this.emit("message", msg);
      if (msg.event) this.emit(msg.event, msg);
    };

    const handleError = (err: any) => {
      onerror?.(err);
      this.emit("error", err);
      this.disconnect(); // 自动关闭
    };

    const handleClose = () => {
      onclose?.();
      this.emit("close");
      this.controller = null;
      this.connectingPromise = null;
    };

    this.connectingPromise = fetchEventSource(this.url, {
      ...rest,
      signal: this.controller.signal,
      onopen: handleOpen,
      onmessage: handleMessage,
      onerror: handleError,
      onclose: handleClose,
      headers: {
        ...rest.headers,
        ...(this.lastEventId ? { "last-event-id": this.lastEventId } : {}),
      },
    });

    return this.connectingPromise;
  }

  public disconnect() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
      this.emit("close");
    }
    this.connectingPromise = null;
  }

  public get connected() {
    return !!this.controller;
  }
}
