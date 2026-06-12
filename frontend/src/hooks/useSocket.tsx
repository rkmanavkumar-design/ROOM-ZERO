'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'error';
  connectionError: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  connectionStatus: 'connecting',
  connectionError: null,
});

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_SERVER || 'http://localhost:3001';
const KEEPALIVE_URL = `${SOCKET_URL.replace(/\/$/, '')}/health`;
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SocketContextType['connectionStatus']>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to signaling server
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      setConnectionStatus('connected');
      setConnectionError(null);
      console.log('Socket.IO connected:', socketInstance.id);
    });

    socketInstance.on('disconnect', (reason) => {
      setConnected(false);
      setConnectionStatus('connecting');
      console.log('Socket.IO disconnected:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      setConnected(false);
      setConnectionStatus('error');
      setConnectionError(
        `Could not reach realtime server at ${SOCKET_URL}. ` +
          'Check NEXT_PUBLIC_WS_SERVER and make sure the backend is awake.'
      );
      console.error('Socket.IO connect error:', error.message);
    });

    socketInstance.io.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
      setConnectionError('Trying to reconnect to the realtime server...');
    });

    socketInstance.io.on('reconnect_failed', () => {
      setConnectionStatus('error');
      setConnectionError(
        `Realtime server is still unreachable at ${SOCKET_URL}. ` +
          'If you are using Render free tier, wait a few seconds and try again.'
      );
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    let intervalId: number | null = null;

    const pingBackend = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      try {
        await fetch(KEEPALIVE_URL, {
          method: 'GET',
          cache: 'no-store',
        });
      } catch (error) {
        console.warn('Backend keepalive ping failed:', error);
      }
    };

    const startKeepalive = () => {
      if (intervalId !== null) return;
      void pingBackend();
      intervalId = window.setInterval(() => {
        void pingBackend();
      }, KEEPALIVE_INTERVAL_MS);
    };

    const stopKeepalive = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startKeepalive();
      } else {
        stopKeepalive();
      }
    };

    if (document.visibilityState === 'visible') {
      startKeepalive();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopKeepalive();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, connectionStatus, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
