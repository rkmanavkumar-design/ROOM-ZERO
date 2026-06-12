'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogIn, RefreshCw } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import ThemeWrapper from '@/components/ThemeWrapper';

export default function LobbyPage() {
  const router = useRouter();
  const { socket, connected } = useSocket();

  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Generate or retrieve persistent guest userId
  const [userId, setUserId] = useState('');

  useEffect(() => {
    let id = sessionStorage.getItem('rz_userId');
    if (!id) {
      id = Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('rz_userId', id);
    }
    setUserId(id);

    const savedNickname = sessionStorage.getItem('rz_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for room creation success
    socket.on('room-created', (room: { id: string }) => {
      sessionStorage.setItem('rz_nickname', nickname);
      router.push(`/room/${room.id}`);
    });

    socket.on('join-error', (err: string) => {
      setErrorMsg(err);
      setIsLoading(false);
    });

    return () => {
      socket.off('room-created');
      socket.off('join-error');
    };
  }, [socket, nickname, router]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setErrorMsg('Enter a nickname');
      return;
    }
    if (!connected || !socket) {
      setErrorMsg('Connecting...');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    socket.emit('create-room', { nickname: nickname.trim(), userId });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setErrorMsg('Enter a nickname');
      return;
    }
    if (!roomCode.trim()) {
      setErrorMsg('Enter a room code');
      return;
    }
    if (roomCode.trim().length !== 6) {
      setErrorMsg('Code must be 6 characters');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    sessionStorage.setItem('rz_nickname', nickname.trim());
    router.push(`/room/${roomCode.toUpperCase().trim()}`);
  };

  return (
    <ThemeWrapper theme="space">
      <div className="min-h-screen p-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              RoomZero
            </h1>
            <p className="text-gray-400 text-sm md:text-base mt-2">Connect and play</p>
          </div>

          {/* Connection Status */}
          <div className="flex justify-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium ${
              connected ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
              {connected ? 'Connected' : 'Connecting...'}
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setActiveTab('create'); setErrorMsg(''); }}
              className={`py-4 rounded-xl text-base font-semibold transition-all ${
                activeTab === 'create'
                  ? 'bg-violet-600 text-white shadow-xl shadow-violet-500/30'
                  : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              Create
            </button>
            <button
              onClick={() => { setActiveTab('join'); setErrorMsg(''); }}
              className={`py-4 rounded-xl text-base font-semibold transition-all ${
                activeTab === 'join'
                  ? 'bg-cyan-600 text-white shadow-xl shadow-cyan-500/30'
                  : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              Join
            </button>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateRoom} className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">Nickname</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="Your name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full glass-input text-base"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !connected}
                className="w-full py-4 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Create Room
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinRoom} className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">Nickname</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="Your name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full glass-input text-base"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">Room Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full glass-input uppercase tracking-widest text-center font-bold text-base"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                Join Room
              </button>
            </form>
          )}
        </div>
      </div>
    </ThemeWrapper>
  );
}
