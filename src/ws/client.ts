import { API } from "@/config";
import { getAuthToken } from "@/api/client";

export type WSHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (e: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onLatencyUpdate?: (latency: number) => void;
  onConnectionStatus?: (connected: boolean, latency?: number) => void;
};

export interface WSClient {
  close: () => void;
  subscribe: (events: string[]) => void;
  unsubscribe: (events: string[]) => void;
  ping: () => void;
  getLatency: () => number;
  isConnected: () => boolean;
}

export function connectQueue(stationId: string, handlers: WSHandlers = {}): WSClient {
  const token = getAuthToken() || (typeof window !== 'undefined' ? window.localStorage.getItem('authToken') : null);
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const url = `${API.ws}/ws/queue/${encodeURIComponent(stationId)}${qs}`;
  
  console.log('WebSocket connecting to:', url);
  console.log('Token available:', !!token);
  
  let ws: WebSocket | null = null;
  let closedByUser = false;
  let retries = 0;
  let latency = 0;
  let connected = false;
  let pingInterval: NodeJS.Timeout | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let lastPingTime = 0;

  const connect = () => {
    console.log('Creating WebSocket connection...');
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('WebSocket connection opened');
      retries = 0;
      connected = true;
      handlers.onOpen?.();
      handlers.onConnectionStatus?.(true, latency);
      
      // Start heartbeat
      startHeartbeat();
      
      // Subscribe to default events
      subscribe(['queue_updated', 'queue_entry_added', 'queue_entry_removed', 'queue_entry_updated', 'queue_reordered', 'day_pass_created', 'exit_pass_created']);
    };
    
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        
        // Handle different message types
        switch (msg.type) {
          case 'pong':
            handlePong(msg);
            break;
          case 'subscription_confirmed':
            console.log('Subscription confirmed for events:', msg.events);
            break;
          default:
            handlers.onMessage?.(ev);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        handlers.onMessage?.(ev);
      }
    };
    
    ws.onerror = (ev) => {
      console.error('WebSocket error:', ev);
      connected = false;
      handlers.onError?.(ev);
      handlers.onConnectionStatus?.(false);
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      connected = false;
      stopHeartbeat();
      handlers.onClose?.();
      handlers.onConnectionStatus?.(false);
      
      if (!closedByUser) {
        const delay = Math.min(1000 * Math.pow(2, retries++), 15000);
        console.log(`Reconnecting in ${delay}ms...`);
        setTimeout(connect, delay);
      }
    };
  };

  const startHeartbeat = () => {
    // Send ping every 30 seconds
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ping();
      }
    }, 30000);

    // Check connection health every 10 seconds
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        connected = false;
        handlers.onConnectionStatus?.(false);
      }
    }, 10000);
  };

  const stopHeartbeat = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  const ping = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      lastPingTime = Date.now();
      const pingMsg = {
        type: 'ping',
        timestamp: lastPingTime,
      };
      ws.send(JSON.stringify(pingMsg));
    }
  };

  const handlePong = (msg: any) => {
    const now = Date.now();
    const roundTripTime = now - msg.timestamp;
    latency = roundTripTime / 2; // Approximate one-way latency
    
    handlers.onLatencyUpdate?.(latency);
    handlers.onConnectionStatus?.(true, latency);
  };

  const subscribe = (events: string[]) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const subscribeMsg = {
        type: 'subscribe',
        events: events,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(subscribeMsg));
    }
  };

  const unsubscribe = (events: string[]) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const unsubscribeMsg = {
        type: 'unsubscribe',
        events: events,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(unsubscribeMsg));
    }
  };

  const getLatency = () => latency;
  const isConnected = () => connected;

  connect();

  return {
    close: () => {
      closedByUser = true;
      stopHeartbeat();
      ws?.close();
    },
    subscribe,
    unsubscribe,
    ping,
    getLatency,
    isConnected,
  };
}