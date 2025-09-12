import { fetchEventSource, type FetchEventSourceInit } from "./fetch";
import type { EventSourceMessage } from "./parse";

export interface EventSourceClientOptions
  extends Omit<
    FetchEventSourceInit,
    "onopen" | "onmessage" | "onclose" | "onerror"
  > {}

export type EventMap = {
  open: Response;
  close: void;
  message: EventSourceMessage;
  error: any;
  statechange: StateChangeEvent;
  // [event: string]: any; // 支持自定义事件
};

/** 连接状态变化事件 */
export interface StateChangeEvent {
  state: EventSourceState;
}

type EventHandler<T = any> = (data: T) => void;

export type EventSourceState =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error";

export class EventSourceClient {
  private url: string;
  private options: EventSourceClientOptions;

  private controller: AbortController | null = null;
  private connectPromise: Promise<void> | null = null;

  private stateInternal: EventSourceState = "idle";
  private listeners: {
    [K in keyof EventMap]?: Set<EventHandler<EventMap[K]>>;
  } = {};

  constructor(url: string, options: EventSourceClientOptions = {}) {
    this.url = url;
    this.options = options;
  }

  /** 订阅事件，返回取消订阅函数 */
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): () => void {
    (this.listeners[event] ??= new Set()).add(handler);
    return () => this.off(event, handler);
  }

  /** 取消订阅事件 */
  off<K extends keyof EventMap>(event: K, handler?: EventHandler<EventMap[K]>) {
    const set = this.listeners[event];
    if (!set) return;
    handler ? set.delete(handler) : set.clear();
  }

  /** 一次性事件订阅 */
  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): () => void {
    const onceHandler: EventHandler<EventMap[K]> = (data) => {
      handler(data);
      this.off(event, onceHandler);
    };
    return this.on(event, onceHandler);
  }

  /** 触发事件 */
  private emit<K extends keyof EventMap>(event: K, data?: EventMap[K]) {
    this.listeners[event]?.forEach((handler) => {
      try {
        handler(data!);
      } catch (err) {
        console.error(`[EventSourceClient] handler for '${event}' error:`, err);
      }
    });
  }

  /** 状态变化处理 */
  private changeState(newState: EventSourceState) {
    if (this.stateInternal !== newState) {
      this.stateInternal = newState;
      const stateEvent: StateChangeEvent = {
        state: newState,
      };
      this.emit("statechange", stateEvent);
    }
  }

  /** 建立 SSE 连接 */
  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    if (this.connected || this.isConnecting) return Promise.resolve();
  
    this.changeState("connecting");
    this.controller = new AbortController();
  
    this.connectPromise = fetchEventSource(this.url, {
      ...this.options,
      signal: this.controller.signal,
      onopen: async (res) => {
        this.changeState("open");
        this.emit("open", res);
      },
      onmessage: (msg) => {
        this.emit("message", msg);
        // if (msg.event) this.emit(msg.event as string, msg);
      },
      onclose: () => {
        this.cleanup("closed");
        this.emit("close");
      },
      onerror: (err) => {
        this.changeState("error");
        this.emit("error", err);
        this.cleanup("closed");
      },
    }).catch((err) => {
      this.changeState("error");
      this.emit("error", err);
      this.cleanup("closed");
    });
  
    return this.connectPromise;
  }
  
  private cleanup(nextState: EventSourceState) {
    this.controller = null;
    this.connectPromise = null;
    this.changeState(nextState);
  }
  

  /** 主动断开连接 */
  disconnect() {
    if (this.stateInternal === "closed" || this.stateInternal === "idle")
      return Promise.resolve();
    this.controller?.abort();
    return Promise.resolve();
  }

  /** 当前连接状态 */
  get state(): EventSourceState {
    return this.stateInternal;
  }

  /** 是否已连接 */
  get connected(): boolean {
    return this.stateInternal === "open";
  }

  /** 是否正在连接 */
  get isConnecting(): boolean {
    return this.stateInternal === "connecting";
  }

  /** 移除所有监听器 */
  removeAllListeners() {
    this.listeners = {};
  }

  /** 销毁客户端 */
  destroy() {
    this.disconnect();
    this.removeAllListeners();
  }
}
