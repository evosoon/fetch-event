import { useState, useRef, useCallback } from 'react';
import './App.css'
import { EventSourceClient } from './fetch-event/fetch-event';

function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const clientRef = useRef<EventSourceClient | null>(null);

  // 事件处理器
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

  // 绑定事件监听器的辅助函数
  const bindEventListeners = useCallback((client: EventSourceClient) => {
    client.on('open', handleOpen);
    client.on('message', handleMessage);
    client.on('close', handleClose);
    client.on('error', handleError);
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


  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh" }}>
      <div className="card">
        <h1>SSE Client</h1>
        <button onClick={connect}>
          Connect
        </button>
        <button onClick={disconnect} style={{ marginLeft: '10px' }}>
          Disconnect
        </button>
        <button 
          onClick={() => setMessages([])} 
          style={{ marginLeft: '10px' }}
        >
          Clear Messages
        </button>
      </div>
      <div style={{ height: "80vh", overflowY: "scroll", minWidth: "500px", padding: "10px" }}>
        <h3>Messages ({messages.length}):</h3>
        {messages.map((item, index) => (
          <div key={index} style={{ 
            padding: '5px', 
            border: '1px solid #ccc', 
            margin: '5px 0',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9'
          }}>
            {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App;
