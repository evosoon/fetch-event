import { fetchEventSource, type FetchEventSourceInit } from "./fetch";
import type { EventSourceMessage } from "./parse";

export interface EventSourceClientOptions
  extends Omit<FetchEventSourceInit, 'onopen' | 'onmessage' | 'onclose' | 'onerror'> {}

export type EventMap = {
  open: Response;
  close: void;
  message: EventSourceMessage;
  error: any;
  [event: string]: any; // 支持自定义事件
};

type EventHandler<T = any> = (data: T) => void;

export type EventSourceState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export class EventSourceClient {
  private controller: AbortController | null = null;
  private connectPromise: Promise<void> | null = null;
  private listeners: { [K in keyof EventMap]?: Set<EventHandler<EventMap[K]>> } = {};
  private url: string;
  private options: EventSourceClientOptions;
  private stateInternal: EventSourceState = 'idle';

  constructor(url: string, options: EventSourceClientOptions = {}) {
    this.url = url;
    this.options = options;
  }

  /** 订阅事件 */
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
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
  once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    const onceHandler = (data: EventMap[K]) => {
      handler(data);
      this.off(event, onceHandler);
    };
    return this.on(event, onceHandler);
  }

  /** 触发事件 */
  private emit<K extends keyof EventMap>(event: K, data?: EventMap[K]) {
    this.listeners[event]?.forEach(handler => {
      try { handler(data!); } catch (err) { console.error(`Error in handler for '${event}':`, err); }
    });
  }

  /** 连接 SSE */
  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    if (this.stateInternal === 'open' || this.stateInternal === 'connecting') return;

    this.stateInternal = 'connecting';
    this.controller = new AbortController();

    this.connectPromise = fetchEventSource(this.url, {
      ...this.options,
      signal: this.controller.signal,
      onopen: async (res) => {
        this.stateInternal = 'open';
        this.emit('open', res);
      },
      onmessage: (msg) => {
        this.emit('message', msg);
        if (msg.event) this.emit(msg.event as string, msg);
      },
      onclose: () => {
        this.cleanup();
        this.emit('close');
      },
      onerror: (err) => {
        this.stateInternal = 'error';
        this.emit('error', err);
        this.disconnect(); // 当前版本不自动重连
      }
    });

    return this.connectPromise;
  }

  /** 断开连接 */
  disconnect() {
    this.controller?.abort();
    this.cleanup();
    this.emit('close');
  }

  /** 清理内部状态 */
  private cleanup() {
    this.controller = null;
    this.connectPromise = null;
    this.stateInternal = 'closed';
  }

  /** 当前连接状态 */
  get state(): EventSourceState {
    return this.stateInternal;
  }

  /** 是否已连接 */
  get connected(): boolean {
    return this.stateInternal === 'open';
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
