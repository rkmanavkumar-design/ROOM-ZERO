'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogIn, RefreshCw, Wifi, WifiOff, Loader2, ArrowRight } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import ThemeWrapper from '@/components/ThemeWrapper';
import { motion, AnimatePresence } from 'framer-motion';

export default function LobbyPage() {
  const router = useRouter();
  const { socket, connected, connectionStatus, connectionError } = useSocket();

  const [nickname, setNickname] = useState('');
  // OTP-style 6 character code
  const [codeChars, setCodeChars] = useState<string[]>(['', '', '', '', '', '']);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    let id = sessionStorage.getItem('rz_userId');
    if (!id) {
      id = Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('rz_userId', id);
    }
    setUserId(id);
    const savedNickname = sessionStorage.getItem('rz_nickname');
    if (savedNickname) setNickname(savedNickname);
  }, []);

  useEffect(() => {
    if (!socket) return;
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

  // OTP input handlers
  const handleCodeChange = useCallback((index: number, value: string) => {
    const char = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-1);
    const next = [...codeChars];
    next[index] = char;
    setCodeChars(next);
    if (char && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  }, [codeChars]);

  const handleCodeKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (codeChars[index]) {
        const next = [...codeChars];
        next[index] = '';
        setCodeChars(next);
      } else if (index > 0) {
        codeInputRefs.current[index - 1]?.focus();
        const next = [...codeChars];
        next[index - 1] = '';
        setCodeChars(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  }, [codeChars]);

  const handleCodePaste = useCallback((e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    if (pasted.length > 0) {
      e.preventDefault();
      const next = [...codeChars];
      for (let i = 0; i < 6; i++) {
        next[i] = pasted[i] || '';
      }
      setCodeChars(next);
      const focusIdx = Math.min(pasted.length, 5);
      codeInputRefs.current[focusIdx]?.focus();
    }
  }, [codeChars]);

  const roomCode = codeChars.join('');

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) { setErrorMsg('Enter a nickname'); return; }
    if (!connected || !socket) { setErrorMsg(connectionError || 'Connecting... please wait.'); return; }
    setIsLoading(true);
    setErrorMsg('');
    socket.emit('create-room', { nickname: nickname.trim(), userId });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) { setErrorMsg('Enter a nickname'); return; }
    if (roomCode.length !== 6) { setErrorMsg('Enter the full 6-character room code'); return; }
    setIsLoading(true);
    setErrorMsg('');
    sessionStorage.setItem('rz_nickname', nickname.trim());
    router.push(`/room/${roomCode}`);
  };

  const switchTab = (tab: 'create' | 'join') => {
    setActiveTab(tab);
    setErrorMsg('');
  };

  return (
    <ThemeWrapper theme="space">
      <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center p-5 safe-top safe-bottom">
        <div className="w-full max-w-sm space-y-7">

          {/* ── Logo & Tagline ─────────────────────────────── */}
          <div className="text-center space-y-2">
            <motion.h1
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="text-5xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent"
            >
              RoomZero
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-gray-400 text-sm font-light tracking-wide"
            >
              Your private space for two
            </motion.p>
          </div>

          {/* ── Connection Pill ────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center"
          >
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border ${
              connected
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : connectionStatus === 'error'
                  ? 'text-red-300 bg-red-500/10 border-red-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            }`}>
              {connected ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : connectionStatus === 'error' ? (
                <WifiOff className="w-3.5 h-3.5" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {connected
                ? 'Server connected'
                : connectionStatus === 'reconnecting'
                  ? 'Reconnecting…'
                  : connectionStatus === 'error'
                    ? 'Connection failed'
                    : 'Connecting…'}
            </div>
          </motion.div>

          {!connected && (
            <p className="text-center text-xs text-gray-500 -mt-4">
              {connectionError || 'Free tier cold start — usually under 30s.'}
            </p>
          )}

          {/* ── Tab Switcher ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="grid grid-cols-2 gap-2 p-1 bg-gray-900/60 rounded-2xl border border-gray-800"
          >
            {(['create', 'join'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`py-3 rounded-xl text-sm font-bold capitalize transition-all ${
                  activeTab === tab
                    ? tab === 'create'
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                      : 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'create' ? 'Create Room' : 'Join Room'}
              </button>
            ))}
          </motion.div>

          {/* ── Error ──────────────────────────────────────── */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3.5 rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 text-sm text-center font-medium">
                  {errorMsg}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Forms ──────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {activeTab === 'create' ? (
              <motion.form
                key="create"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.22 }}
                onSubmit={handleCreateRoom}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-widest">
                    Your Nickname
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="How should we call you?"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="glass-input"
                    autoComplete="nickname"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  id="create-room-btn"
                  disabled={isLoading || !connected}
                  className="btn-primary bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Create Private Room
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="join"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
                onSubmit={handleJoinRoom}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-widest">
                    Your Nickname
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="How should we call you?"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="glass-input"
                    autoComplete="nickname"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    disabled={isLoading}
                  />
                </div>

                {/* OTP-style code inputs */}
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-3 block uppercase tracking-widest">
                    Room Code
                  </label>
                  <div
                    className="flex gap-2 justify-center"
                    onPaste={handleCodePaste}
                  >
                    {codeChars.map((char, i) => (
                      <input
                        key={i}
                        ref={(el) => { codeInputRefs.current[i] = el; }}
                        type="text"
                        inputMode="text"
                        maxLength={1}
                        value={char}
                        onChange={(e) => handleCodeChange(i, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(i, e)}
                        onFocus={(e) => e.target.select()}
                        className={`code-char-input ${char ? 'filled' : ''}`}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        disabled={isLoading}
                        id={`code-char-${i}`}
                        aria-label={`Room code character ${i + 1}`}
                      />
                    ))}
                  </div>
                  <p className="text-center text-[10px] text-gray-600 mt-2">
                    Paste or type the 6-character room code
                  </p>
                </div>

                <button
                  type="submit"
                  id="join-room-btn"
                  disabled={isLoading || roomCode.length !== 6}
                  className="btn-primary bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  Enter Room
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* ── Footer ─────────────────────────────────────── */}
          <p className="text-center text-[10px] text-gray-700 font-light">
            Rooms are private · No accounts · No logs
          </p>
        </div>
      </div>
    </ThemeWrapper>
  );
}
