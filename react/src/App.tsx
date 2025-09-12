import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { EventSourceClient } from './fetch-event/fetch-event';

function App() {
  const [messages, setMessages] = useState<(string | object)[]>([]);
  const clientRef = useRef<EventSourceClient | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleOpen = useCallback(() => {
    console.log('Connected to SSE');
  }, []);

  const handleMessage = useCallback((msg: any) => {
    console.log('Received message:', msg);
    setMessages(prev => [...prev, msg.data || msg]);
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

  const clearMessages = () => setMessages([]);

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
          <div key={index} style={{ 
            padding: '5px', 
            margin: '5px 0', 
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
