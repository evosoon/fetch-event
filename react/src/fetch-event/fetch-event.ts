import { fetchEventSource, type FetchEventSourceInit } from "./fetch";
import type { EventSourceMessage } from "./parse";

export interface EventSourceClientOptions extends Omit<FetchEventSourceInit, 'onopen' | 'onmessage' | 'onclose' | 'onerror'> {}

type EventHandler = (data: any) => void;

export class EventSourceClient {
  private controller: AbortController | null = null;
  private connectPromise: Promise<void> | null = null;
  private listeners: Record<string, Set<EventHandler>> = {};
  private isConnected = false;
  private url: string;
  private options: EventSourceClientOptions;

  constructor(url: string, options: EventSourceClientOptions = {}) {
    this.url = url;
    this.options = options;
  }

  on(event: string, handler: EventHandler): () => void {
    (this.listeners[event] ??= new Set()).add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler?: EventHandler): void {
    const listeners = this.listeners[event];
    if (!listeners) return;
    handler ? listeners.delete(handler) : listeners.clear();
  }

  once(event: string, handler: EventHandler): () => void {
    const onceHandler = (data: any) => {
      handler(data);
      this.off(event, onceHandler);
    };
    return this.on(event, onceHandler);
  }

  private emit(event: string, data?: any): void {
    this.listeners[event]?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for '${event}':`, error);
      }
    });
  }

  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    if (this.isConnected) return;

    this.controller = new AbortController();
    
    return this.connectPromise = fetchEventSource(this.url, {
      ...this.options,
      signal: this.controller.signal,
      onopen: async (response: Response) => {
        this.isConnected = true;
        this.emit('open', response);
      },
      onmessage: (message: EventSourceMessage) => {
        this.emit('message', message);
        if (message.event) this.emit(message.event, message);
      },
      onclose: () => {
        this.isConnected = false;
        this.controller = null;
        this.connectPromise = null;
        this.emit('close');
      },
      onerror: (error: any) => {
        this.emit('error', error);
        this.disconnect();
      }
    });
  }

  disconnect(): void {
    this.controller?.abort();
    this.controller = null;
    this.isConnected = false;
    this.connectPromise = null;
    this.emit('close');
  }

  get connected(): boolean {
    return this.isConnected;
  }

  removeAllListeners(): void {
    this.listeners = {};
  }

  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}