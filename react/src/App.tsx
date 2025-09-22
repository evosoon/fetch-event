import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { EventSourceClient } from './fetch-event/fetch-event';
import { useStream } from './utils/useStreamQueue';

function App() {
  const [messages, setMessages] = useState<(string | object)[]>([]);
  const messagesRef = useRef<(string | object)[]>(messages);
  const clientRef = useRef<EventSourceClient | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { enqueue, cancel } = useStream();

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // 保持对 messages 的最新引用（便于计算插入位置）
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // StreamQueue lifecycle handled by hook

  const handleOpen = useCallback(() => {
    console.log('Connected to SSE');
  }, []);

  const handleMessage = useCallback((msg: any) => {
    console.log('Received message:', msg);
    const payload = msg?.data ?? msg;
    if (typeof payload === 'string') {
      let idx = -1;
      setMessages(prev => {
        idx = prev.length;
        return [...prev, ''];
      });
      
      enqueue(payload, (delta, fullText, done) => {
        setMessages(prev => {
          if (idx < 0 || idx >= prev.length) return prev;
          const next = [...prev];
          next[idx] = next[idx]+delta;
          return next;
        });
      }, clientRef.current?.signal ?? undefined);
    } else {
      setMessages(prev => [...prev, payload]);
    }
  }, []);

  const handleClose = useCallback(() => {
    console.log('SSE connection closed');
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('SSE error:', error);
  }, []);

  const bindEventListeners = useCallback((client: EventSourceClient) => {
    client.on('open', handleOpen);
    client.on('message', handleMessage);
    client.on('close', handleClose);
    client.on('error', handleError);
    client.on('statechange', (state) => {
      console.log('SSE state changed:', state);
    });

  }, [handleOpen, handleMessage, handleClose, handleError]);

  const connect = async () => {
    if (clientRef.current) {
      clientRef.current.destroy();
    }

    const client = new EventSourceClient('/sse', {
      headers: {
        'Authorization': 'Bearer token'
      }
    });

    bindEventListeners(client);
    clientRef.current = client;

    try {
      await client.connect();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
  }, []);

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div style={{ display: 'flex', height: '80vh', padding: '20px', gap: '20px' }}>
      <div className="card" style={{ minWidth: '200px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h1>SSE</h1>
        <button onClick={connect}>Connect</button>
        <button onClick={disconnect} style={{ marginLeft: '10px' }}>Disconnect</button>
        <button onClick={clearMessages} style={{ marginLeft: '10px' }}>Clear</button>
      </div>
      <div 
        ref={containerRef} 
        style={{ flex: 1, overflowY: 'auto', padding: '10px', minWidth: '500px', border: '1px solid #ccc', borderRadius: '4px' }}
      >
        <h3>Messages {messages.length}</h3>
        {messages.map((item, index) => (
          <div key={index} className="message-item" style={{
            padding: '8px 12px',
            margin: '4px 0',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9', 
            border: '1px solid #eee'
          }}>
            {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
