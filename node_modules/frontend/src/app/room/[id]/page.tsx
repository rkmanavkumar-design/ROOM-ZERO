'use client';

import React, { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { Copy, Check, LogOut, Palette, Gamepad2, X, Users } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import ThemeWrapper, { ThemeType } from '@/components/ThemeWrapper';
import ChatSection from '@/components/ChatSection';
import WebRTCCall from '@/components/WebRTCCall';
import GameArea from '@/components/GameArea';
import { Room, Message } from '@/lib/types';

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
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // Game overlay toggle state
  const [showGame, setShowGame] = useState(false);

  // Auto-open game panel when a game is started by the server/partner
  useEffect(() => {
    if (roomState?.activeGame) {
      setShowGame(true);
    }
  }, [roomState?.activeGame]);

  // Close theme dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        themeDropdownRef.current &&
        !themeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowThemeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            text: 'Your partner has disconnected.',
            isOneTime: false,
            timestamp: Date.now()
          }
        ]);
      }
    });

    // GAME STATE RECEPTIONS
    socket.on('game-started', (data: Partial<Room>) => {
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

    interface ScoreUpdate {
      id: string;
      score: number;
      awards?: string[];
    }

    socket.on('scribble-correct', (data: { guesserNickname: string; word: string; scores: ScoreUpdate[] }) => {
      // Append a system message celebrating the correct guess
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          senderId: 'system',
          senderNickname: 'RoomZero',
          text: `🎉 Correct! ${data.guesserNickname} guessed "${data.word}"!`,
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

    socket.on('scribble-round-end', (data: { word: string; scores: ScoreUpdate[] }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          senderId: 'system',
          senderNickname: 'RoomZero',
          text: `⏰ Time's up! The word was "${data.word}".`,
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

    socket.on('story-updated', (data: { story?: Room['story']; scores: ScoreUpdate[] }) => {
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

    socket.on('nhie-revealed', (data: { nhie?: Room['nhie']; scores: ScoreUpdate[] }) => {
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
  const callState = useWebRTC({ socket, roomId });

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
    if (confirm('Leave room?')) {
      router.push('/');
    }
  };

  // Find partner details
  const partnerUser = roomState ? Object.values(roomState.users).find((u) => u.id !== userId) : null;
  const partnerNickname = partnerUser?.nickname || 'Guest';

  return (
    <ThemeWrapper theme={roomState?.theme || 'space'}>
      {/* Nickname Modal */}
      <AnimatePresence>
        {needNickname && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm p-6 bg-gray-900/90 rounded-2xl border border-gray-800">
              <h2 className="text-xl font-bold mb-2 text-white">Join Room</h2>
              <p className="text-xs text-gray-400 mb-6">Pick a nickname</p>
              <form onSubmit={handleNicknameSubmit} className="space-y-4">
                <input
                  type="text"
                  maxLength={15}
                  placeholder="Your name"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  className="w-full glass-input"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Room */}
      {!needNickname && (
        <div className="flex flex-col h-screen">
          {/* Header */}
          <header className="p-4 border-b border-gray-800 bg-black/30 backdrop-blur-md">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  RoomZero
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Users className="w-3.5 h-3.5" />
                  <span>{roomState ? Object.keys(roomState.users).length : 0}/2</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800/50 text-xs text-gray-300 hover:text-white transition-all"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Copy Code</span>
                  <span className="sm:hidden font-mono">{roomId}</span>
                </button>

                {/* Theme Selector */}
                <div ref={themeDropdownRef} className="relative">
                  <button 
                    onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                    className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    <Palette className="w-4 h-4" />
                  </button>
                  {showThemeDropdown && (
                    <div className="absolute right-0 top-11 w-32 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-1 z-40">
                      {(['space', 'ocean', 'arcade', 'sakura', 'carnival'] as ThemeType[]).map((thm) => (
                        <button
                          key={thm}
                          onClick={() => {
                            changeTheme(thm);
                            setShowThemeDropdown(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                            roomState?.theme === thm ? 'text-violet-400 bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                        >
                          {thm}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLeaveRoom}
                  className="p-2 rounded-lg bg-red-900/20 text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden max-w-2xl mx-auto w-full">
            {/* Call Panel */}
            <WebRTCCall callState={callState} otherUserNickname={partnerNickname} />

            {/* Chat */}
            <div className="flex-1 bg-gray-900/30 border border-gray-800 rounded-2xl flex flex-col min-h-0 overflow-hidden">
              <ChatSection
                socket={socket}
                userId={userId}
                users={roomState?.users || {}}
                messages={messages}
                setMessages={setMessages}
              />
            </div>
          </div>

          {/* Game Button */}
          <div className="p-4">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setShowGame(true)}
                className={`w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all ${
                  roomState?.activeGame
                    ? 'bg-rose-600 hover:bg-rose-700 animate-pulse'
                    : 'bg-violet-600 hover:bg-violet-700'
                }`}
              >
                <Gamepad2 className="w-5 h-5" />
                <span>{roomState?.activeGame ? 'Active Game' : 'Play Activity'}</span>
              </button>
            </div>
          </div>

          {/* Game Overlay */}
          <AnimatePresence>
            {showGame && (
              <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
                <div className="p-4 flex items-center justify-between border-b border-gray-800">
                  <h2 className="text-lg font-bold text-white">Activities</h2>
                  <button
                    onClick={() => setShowGame(false)}
                    className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <GameArea
                    socket={socket}
                    userId={userId}
                    roomState={roomState}
                  />
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </ThemeWrapper>
  );
}
