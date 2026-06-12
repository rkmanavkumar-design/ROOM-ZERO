'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, ArrowRight, Shield, Zap, RefreshCw } from 'lucide-react';
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
    socket.on('room-created', (room: any) => {
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
      setErrorMsg('Please enter a nickname first.');
      return;
    }
    if (!connected || !socket) {
      setErrorMsg('Not connected to the signaling server. Retrying...');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    socket.emit('create-room', { nickname: nickname.trim(), userId });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setErrorMsg('Please enter a nickname.');
      return;
    }
    if (!roomCode.trim()) {
      setErrorMsg('Please enter a 6-character room code.');
      return;
    }
    if (roomCode.trim().length !== 6) {
      setErrorMsg('Room code must be exactly 6 characters.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // Store nickname in sessionStorage and redirect to room
    // The room page itself will handle joining via socket
    sessionStorage.setItem('rz_nickname', nickname.trim());
    router.push(`/room/${roomCode.toUpperCase().trim()}`);
  };

  return (
    <ThemeWrapper theme="space">
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative min-h-screen">
        
        {/* Floating Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 md:w-96 md:h-96 rounded-full bg-violet-600/15 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-60 h-60 rounded-full bg-cyan-600/10 blur-[80px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl font-extrabold tracking-tight mb-2 select-none"
            >
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-md">
                RoomZero
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 text-sm md:text-base font-light"
            >
              privacy-first social playground for two
            </motion.p>
          </div>

          {/* Connection Status indicator */}
          <div className="flex justify-center mb-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold glass-panel bg-opacity-10 border-opacity-10 ${
              connected ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
              {connected ? 'Signal Established' : 'Connecting to Server...'}
            </div>
          </div>

          {/* Core Interactive Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="glass-panel p-6 md:p-8 relative overflow-hidden"
          >
            {/* Background Grid Accent */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/25 pointer-events-none" />

            {/* Form Tabs */}
            <div className="flex border-b border-gray-800 mb-6 relative">
              <button
                onClick={() => { setActiveTab('create'); setErrorMsg(''); }}
                className={`flex-1 pb-3 text-sm font-bold transition-all relative ${
                  activeTab === 'create' ? 'text-violet-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Create Room
                {activeTab === 'create' && (
                  <motion.div 
                    layoutId="active-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-400"
                  />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('join'); setErrorMsg(''); }}
                className={`flex-1 pb-3 text-sm font-bold transition-all relative ${
                  activeTab === 'join' ? 'text-cyan-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Join Room
                {activeTab === 'join' && (
                  <motion.div 
                    layoutId="active-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400"
                  />
                )}
              </button>
            </div>

            {/* Error Message display */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-semibold flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabs Render */}
            <AnimatePresence mode="wait">
              {activeTab === 'create' ? (
                <motion.form
                  key="create-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleCreateRoom}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Your Nickname</label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g. ShadowDraw"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="glass-input"
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !connected}
                    className="neon-button mt-2 py-3 bg-violet-600 hover:bg-violet-700/80 font-bold border-violet-500/30 text-white rounded-xl shadow-lg relative group overflow-hidden"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-all duration-300" />
                        Create a Safe Space
                      </>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="join-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleJoinRoom}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Your Nickname</label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g. PixelSurfer"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="glass-input"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Room Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. RZ-9A4X"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      className="glass-input uppercase tracking-widest text-center text-lg font-bold"
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="neon-button mt-2 py-3 bg-cyan-600 hover:bg-cyan-700/80 font-bold border-cyan-500/30 text-white rounded-xl shadow-lg relative group overflow-hidden"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        Step into Room
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-all" />
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Privacy Badges / Core selling points */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="glass-panel p-3 bg-opacity-5 border-opacity-5 flex items-start gap-2 text-xs">
              <Shield className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-300">RAM-Only Storage</p>
                <p className="text-gray-500 font-light mt-0.5">No database. Rooms vanish instantly when empty.</p>
              </div>
            </div>
            <div className="glass-panel p-3 bg-opacity-5 border-opacity-5 flex items-start gap-2 text-xs">
              <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-300">Consent Call System</p>
                <p className="text-gray-500 font-light mt-0.5">Calls require dual consent. No recordings.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ThemeWrapper>
  );
}
