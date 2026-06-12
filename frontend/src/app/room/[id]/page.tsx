'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, LogOut, MessageSquare, Play, ShieldAlert, Users, Palette, Flame, Gamepad2, X } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import ThemeWrapper, { ThemeType } from '@/components/ThemeWrapper';
import ChatSection from '@/components/ChatSection';
import WebRTCCall from '@/components/WebRTCCall';
import GameArea from '@/components/GameArea';
import { Room, Message, User } from '@/lib/types';

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const router = useRouter();
  const { id: roomId } = use(params);
  const { socket, connected } = useSocket();

  const [nickname, setNickname] = useState('');
  const [userId, setUserId] = useState('');
  const [needNickname, setNeedNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  const [roomState, setRoomState] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  // Game overlay toggle state
  const [showGame, setShowGame] = useState(false);

  // Auto-open game panel when a game is started by the server/partner
  useEffect(() => {
    if (roomState?.activeGame) {
      setShowGame(true);
    }
  }, [roomState?.activeGame]);

  // Load session storage credentials on mount
  useEffect(() => {
    let storedUserId = sessionStorage.getItem('rz_userId');
    if (!storedUserId) {
      storedUserId = Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('rz_userId', storedUserId);
    }
    setUserId(storedUserId);

    const storedNickname = sessionStorage.getItem('rz_nickname');
    if (!storedNickname) {
      // Prompt modal if nickname is missing (direct link joins)
      setNeedNickname(true);
    } else {
      setNickname(storedNickname);
    }
  }, []);

  // Socket signaling and sync events
  useEffect(() => {
    if (!socket || !connected || !userId || !nickname || !roomId) return;

    // Emit join-room
    socket.emit('join-room', { roomId, nickname, userId });

    // Success listeners
    socket.on('room-joined', (updatedRoom: Room) => {
      setRoomState(updatedRoom);
      setNeedNickname(false);
    });

    socket.on('theme-changed', (theme: ThemeType) => {
      setRoomState((prev) => (prev ? { ...prev, theme } : null));
    });

    socket.on('message-received', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('user-left', ({ userId: leftUid, roomState: updatedRoom }: { userId: string; roomState: Room }) => {
      setRoomState(updatedRoom);
      // Clean up local call state if partner leaves
      if (leftUid !== userId) {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            senderId: 'system',
            senderNickname: 'System',
            text: 'Your partner has disconnected. The activity has been reset.',
            isOneTime: false,
            timestamp: Date.now()
          }
        ]);
      }
    });

    // GAME STATE RECEPTIONS
    socket.on('game-started', (data: { activeGame: any; scribble?: any; story?: any; nhie?: any }) => {
      setRoomState((prev) =>
        prev
          ? {
              ...prev,
              activeGame: data.activeGame,
              scribble: data.scribble,
              story: data.story,
              nhie: data.nhie
            }
          : null
      );
    });

    socket.on('scribble-tick', (timer: number) => {
      setRoomState((prev) => {
        if (prev && prev.scribble) {
          return {
            ...prev,
            scribble: { ...prev.scribble, timer }
          };
        }
        return prev;
      });
    });

    socket.on('scribble-correct', (data: { guesserNickname: string; word: string; scores: any[] }) => {
      // Append a system message celebrating the correct guess
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          senderId: 'system',
          senderNickname: 'RoomZero',
          text: `🎉 Correct! ${data.guesserNickname} guessed the word: "${data.word}"!`,
          isOneTime: false,
          timestamp: Date.now()
        }
      ]);

      // Update users scores in state
      setRoomState((prev) => {
        if (!prev) return null;
        const updatedUsers = { ...prev.users };
        data.scores.forEach((uScore) => {
          if (updatedUsers[uScore.id]) {
            updatedUsers[uScore.id].score = uScore.score;
            if (uScore.awards) {
              updatedUsers[uScore.id].awards = uScore.awards;
            }
          }
        });
        return {
          ...prev,
          users: updatedUsers,
          activeGame: undefined,
          scribble: undefined
        };
      });
    });

    socket.on('scribble-round-end', (data: { word: string; scores: any[] }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          senderId: 'system',
          senderNickname: 'RoomZero',
          text: `⏰ Time is up! The secret word was: "${data.word}".`,
          isOneTime: false,
          timestamp: Date.now()
        }
      ]);

      setRoomState((prev) => {
        if (!prev) return null;
        const updatedUsers = { ...prev.users };
        data.scores.forEach((uScore) => {
          if (updatedUsers[uScore.id]) {
            updatedUsers[uScore.id].score = uScore.score;
          }
        });
        return {
          ...prev,
          users: updatedUsers,
          activeGame: undefined,
          scribble: undefined
        };
      });
    });

    socket.on('story-updated', (data: { story: any; scores: any[] }) => {
      setRoomState((prev) => {
        if (!prev) return null;
        const updatedUsers = { ...prev.users };
        data.scores.forEach((uScore) => {
          if (updatedUsers[uScore.id]) {
            updatedUsers[uScore.id].score = uScore.score;
            if (uScore.awards) {
              updatedUsers[uScore.id].awards = uScore.awards;
            }
          }
        });
        return {
          ...prev,
          users: updatedUsers,
          story: data.story
        };
      });
    });

    socket.on('nhie-revealed', (data: { nhie: any; scores: any[] }) => {
      setRoomState((prev) => {
        if (!prev) return null;
        const updatedUsers = { ...prev.users };
        data.scores.forEach((uScore) => {
          if (updatedUsers[uScore.id]) {
            updatedUsers[uScore.id].score = uScore.score;
            if (uScore.awards) {
              updatedUsers[uScore.id].awards = uScore.awards;
            }
          }
        });
        return {
          ...prev,
          users: updatedUsers,
          nhie: data.nhie
        };
      });
    });

    // Error handler redirects back to lobby
    socket.on('join-error', (err: string) => {
      alert(err);
      router.push('/');
    });

    return () => {
      socket.off('room-joined');
      socket.off('theme-changed');
      socket.off('message-received');
      socket.off('user-left');
      socket.off('game-started');
      socket.off('scribble-tick');
      socket.off('scribble-correct');
      socket.off('scribble-round-end');
      socket.off('story-updated');
      socket.off('nhie-revealed');
      socket.off('join-error');
    };
  }, [socket, connected, userId, nickname, roomId, router]);

  // WebRTC Peer connection state
  const callState = useWebRTC({ socket, roomId, userId });

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicknameInput.trim()) return;

    sessionStorage.setItem('rz_nickname', nicknameInput.trim());
    setNickname(nicknameInput.trim());
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const changeTheme = (newTheme: ThemeType) => {
    if (socket) {
      socket.emit('change-theme', newTheme);
    }
  };

  const handleLeaveRoom = () => {
    if (confirm('Are you sure you want to disconnect? All session statistics will disappear.')) {
      router.push('/');
    }
  };

  // Find partner details
  const partnerUser = roomState ? Object.values(roomState.users).find((u) => u.id !== userId) : null;
  const partnerNickname = partnerUser?.nickname || 'Guest';

  return (
    <ThemeWrapper theme={roomState?.theme || 'space'}>
      {/* 1. NICKNAME INPUT MODAL FOR DIRECT ACCESS */}
      <AnimatePresence>
        {needNickname && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="glass-panel p-6 max-w-sm w-full border-violet-500/20"
            >
              <h2 className="text-xl font-bold mb-2 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                Join RoomZero
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                You were invited to a secure sandbox session. Choose a guest nickname to step in.
              </p>
              <form onSubmit={handleNicknameSubmit} className="flex flex-col gap-4">
                <input
                  type="text"
                  maxLength={15}
                  placeholder="Choose guest nickname..."
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  className="glass-input"
                  required
                />
                <button
                  type="submit"
                  className="neon-button py-2.5 bg-violet-600 border-violet-500/20 font-bold hover:bg-violet-700 text-white rounded-xl shadow-lg"
                >
                  Enter Room
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MAIN ROOM DASHBOARD VIEW */}
      {!needNickname && (
        <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
          
          {/* Header Navigation panel */}
          <header className="p-3 md:p-4 border-b border-gray-800 bg-black/40 backdrop-blur-md flex items-center justify-between shrink-0 relative z-30">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent select-none">
                RoomZero
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-violet-950/40 text-violet-400 border border-violet-900/30 tracking-widest uppercase">
                {roomState?.theme || 'Space'}
              </span>
            </div>

            {/* Middle Controls (Room Link & Codes) */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-xl py-1 px-3 text-xs">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-400">Guests:</span>
                <span className="font-bold text-gray-200">
                  {roomState ? Object.keys(roomState.users).length : 0}/2
                </span>
              </div>

              {/* Click to copy link */}
              <button
                onClick={copyInviteLink}
                className="py-1 px-3 bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl text-xs font-semibold text-gray-300 transition-all flex items-center gap-1.5 shadow-sm"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Room Code: {roomId}</span>
              </button>
            </div>

            {/* Settings & Exit */}
            <div className="flex items-center gap-2">
              {/* Theme Swapper dropdown */}
              <div className="relative group">
                <button className="p-2 rounded-xl bg-gray-900/50 border border-gray-800 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs">
                  <Palette className="w-4 h-4 text-violet-400" />
                  <span className="hidden md:inline">Theme</span>
                </button>
                <div className="absolute right-0 top-10 w-32 rounded-xl bg-gray-950 border border-gray-800 shadow-2xl p-1.5 hidden group-hover:block z-40">
                  {(['space', 'ocean', 'arcade', 'sakura', 'carnival'] as ThemeType[]).map((thm) => (
                    <button
                      key={thm}
                      onClick={() => changeTheme(thm)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-gray-900 capitalize font-medium transition-colors ${
                        roomState?.theme === thm ? 'text-violet-400 bg-gray-900/30' : 'text-gray-400'
                      }`}
                    >
                      {thm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exit Session */}
              <button
                onClick={handleLeaveRoom}
                className="p-2 rounded-xl bg-red-950/20 border border-red-500/10 hover:border-red-500/30 text-red-400 hover:text-red-300 transition-all"
                title="Disconnect & delete data"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Main Dashboard Space: Unified Call and Chat Log */}
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden relative z-20 max-w-2xl mx-auto w-full">
            {/* Call panel */}
            {partnerUser ? (
              <WebRTCCall callState={callState} otherUserNickname={partnerNickname} />
            ) : (
              <div className="p-4 glass-panel border-amber-500/20 bg-amber-500/5 flex items-center justify-between gap-3 text-xs text-amber-400 animate-pulse select-none">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Invite your partner to enable calls. Share the room code.</span>
                </div>
              </div>
            )}

            {/* Chat section taking up remaining space */}
            <div className="flex-1 glass-panel bg-opacity-20 flex flex-col min-h-0 overflow-hidden relative">
              <ChatSection
                socket={socket}
                roomId={roomId}
                userId={userId}
                users={roomState?.users || {}}
                messages={messages}
                setMessages={setMessages}
              />
            </div>
          </div>

          {/* Floating Game Toggle Button */}
          <div className="fixed bottom-22 right-6 md:right-12 z-30">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowGame(true)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm text-white border transition-all shadow-2xl relative ${
                roomState?.activeGame
                  ? 'bg-rose-600 border-rose-500 hover:bg-rose-700 shadow-rose-950/50 animate-pulse'
                  : 'bg-violet-600 border-violet-500 hover:bg-violet-700 shadow-violet-950/50'
              }`}
            >
              <Gamepad2 className="w-5 h-5" />
              <span>{roomState?.activeGame ? 'Active Game!' : 'Play Activity'}</span>
              
              {/* Notification badge dot */}
              {roomState?.activeGame && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
              )}
            </motion.button>
          </div>

          {/* Sliding Glassmorphic Game Overlay Sheet */}
          <AnimatePresence>
            {showGame && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-2xl flex flex-col p-4 pt-16 md:p-8 md:pt-20 overflow-hidden"
              >
                {/* Close Overlay control */}
                <div className="absolute top-4 right-4 z-50">
                  <button
                    onClick={() => setShowGame(false)}
                    className="p-2 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-all shadow-lg flex items-center gap-1 text-xs font-bold"
                  >
                    <X className="w-4 h-4" />
                    <span>Minimize</span>
                  </button>
                </div>

                {/* Main Game wrapper inside overlay */}
                <div className="flex-1 glass-panel bg-opacity-25 flex flex-col min-h-0 overflow-hidden max-w-2xl mx-auto w-full">
                  <GameArea
                    socket={socket}
                    roomId={roomId}
                    userId={userId}
                    roomState={roomState}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </ThemeWrapper>
  );
}
