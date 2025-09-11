import { useState, useRef } from 'react';
import './App.css'
import { fetchEventSource } from './fetch-event';

function App() {
  const [message, setMessage] = useState<string[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const sendEvent = async () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      await fetchEventSource("/sse", {
        signal: controller.signal,
        onmessage: (event) => {
          console.log("Received message:", event.data);
          setMessage((prev) => [...prev, event.data]);
        },
        onerror: (error) => {
          console.error("EventSource error:", error);
        },
        onclose: () => {
          console.log("EventSource closed");
        },
      });
    } catch (err) {
      console.error("fetchEventSource error:", err);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh" }}>
      <div className="card">
        <h1>SSE</h1>
        <button onClick={sendEvent}>
          Send Event
        </button>
      </div>
      <div style={{ height: "80vh", overflowY: "scroll", minWidth: "500px" }}>
        {message.map((item, index) => <p key={index}>{item}</p>)}
      </div>
    </div>
  )
}

export default App;
