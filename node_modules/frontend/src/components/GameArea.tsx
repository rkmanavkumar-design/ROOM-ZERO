'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Trophy, Compass, Sparkles } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Room, GameType, User } from '@/lib/types';
import ScribbleGame from './ScribbleGame';
import StoryBuilderGame from './StoryBuilderGame';
import NeverHaveIEverGame from './NeverHaveIEverGame';

interface GameAreaProps {
  socket: Socket | null;
  roomId: string;
  userId: string;
  roomState: Room | null;
}

const CONVERSATION_STARTERS = [
  'If you could have any superpower for exactly 24 hours, what would it be and why?',
  'What is the most unusual or memorable food you have ever tried?',
  'If you could teleport to any place in the world right now, where would you go?',
  'What is a song that instantly makes you want to dance or puts you in a good mood?',
  'What was your favorite cartoon or book character growing up?',
  'Would you rather travel 100 years into the past or 100 years into the future?',
  'What is the best piece of advice you have ever received from someone?',
  'If you could swap lives with any animal for a day, which one would you choose?'
];

const CULTURAL_PROMPTS = [
  'What is a traditional festival or celebration in your hometown/country that you love?',
  'Is there a popular local slang or saying where you live? What does it mean?',
  'What is a typical comfort food or breakfast in your culture/region?',
  'What is one stereotype about your country or region that is actually true or false?',
  'If I visited your home city, what is the first place you would take me to see?'
];

export default function GameArea({ socket, roomId, userId, roomState }: GameAreaProps) {
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinDeg, setSpinDeg] = useState(0);
  const [selectedGameFromSpin, setSelectedGameFromSpin] = useState<GameType | null>(null);
  const [promptText, setPromptText] = useState('Click to draw a card!');
  const [promptType, setPromptType] = useState<'conversation' | 'cultural' | null>(null);

  const usersList = roomState ? Object.values(roomState.users) : [];
  const partner = roomState ? Object.values(roomState.users).find((u) => u.id !== userId) : null;
  const isAlone = usersList.length < 2;

  // React to server starting a game
  useEffect(() => {
    if (!roomState) return;

    if (roomState.activeGame) {
      if (roomState.activeGame !== activeGame) {
        // If a new game is activated, trigger the local wheel spin if we are not already spinning
        if (!spinning) {
          triggerWheelSpin(roomState.activeGame);
        }
      }
    } else {
      setActiveGame(null);
    }
  }, [roomState, activeGame, spinning]);

  const triggerWheelSpin = (targetGame: GameType) => {
    setSpinning(true);
    setSelectedGameFromSpin(targetGame);

    // Calculate rotation degree based on chosen game index
    // 0: Scribble, 1: Story Builder, 2: Never Have I Ever
    const gameIndices: Record<GameType, number> = { scribble: 0, story: 1, nhie: 2 };
    const idx = gameIndices[targetGame];
    
    // Add multiple rotations (e.g. 5 full rotations = 1800 deg) + offset
    const segmentAngle = 360 / 3;
    const targetAngle = 1800 + (360 - idx * segmentAngle - segmentAngle / 2);

    setSpinDeg(targetAngle);

    // Wait for wheel animation to finish before displaying game UI
    setTimeout(() => {
      setSpinning(false);
      setActiveGame(targetGame);
      setSelectedGameFromSpin(null);
    }, 2800);
  };

  const handleRequestSpin = () => {
    if (!socket || isAlone || spinning) return;
    const games: GameType[] = ['scribble', 'story', 'nhie'];
    const randomGame = games[Math.floor(Math.random() * games.length)];
    socket.emit('select-game', randomGame);
  };

  const handleDrawPrompt = (type: 'conversation' | 'cultural') => {
    setPromptType(type);
    const deck = type === 'conversation' ? CONVERSATION_STARTERS : CULTURAL_PROMPTS;
    let card = deck[Math.floor(Math.random() * deck.length)];
    while (card === promptText && deck.length > 1) {
      card = deck[Math.floor(Math.random() * deck.length)];
    }
    setPromptText(card);
  };

  const handleQuitGame = () => {
    if (!socket) return;
    socket.emit('select-game', null); // Clears active game
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <AnimatePresence mode="wait">
        
        {/* LOBBY / PRE-GAME UI */}
        {!activeGame && !spinning && (
          <motion.div
            key="pre-game-lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
          >
            {/* Game Selector Wheel block */}
            <div className="glass-panel p-6 flex flex-col items-center justify-center relative overflow-hidden bg-opacity-20">
              <h2 className="text-xl font-bold mb-1 tracking-wide flex items-center gap-1.5 select-none">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Select Activity
              </h2>
              <p className="text-xs text-gray-400 mb-6">Spin the wheel to match on an activity</p>

              {/* Graphical Wheel Container */}
              <div className="relative w-48 h-48 md:w-56 md:h-56 mb-6">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2.5 z-20 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-rose-500 filter drop-shadow-md" />
                
                {/* Visual Wheel Circle */}
                <div className="w-full h-full rounded-full border-[3px] border-gray-700 bg-gray-900/60 overflow-hidden relative shadow-inner">
                  {/* Scribble Segment */}
                  <div className="absolute inset-0 bg-violet-600/10 border-r border-gray-800 origin-center rotate-[60deg]" style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%)' }} />
                  {/* Story Segment */}
                  <div className="absolute inset-0 bg-cyan-600/10 border-r border-gray-800 origin-center rotate-[180deg]" style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%)' }} />
                  {/* NHIE Segment */}
                  <div className="absolute inset-0 bg-emerald-600/10 border-r border-gray-800 origin-center rotate-[300deg]" style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%)' }} />

                  {/* Text labels inside segments */}
                  <div className="absolute top-[20%] left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider text-violet-300">Scribble</div>
                  <div className="absolute bottom-[22%] left-[16%] rotate-[120deg] text-[10px] font-bold tracking-wider text-cyan-300">Story</div>
                  <div className="absolute bottom-[22%] right-[16%] -rotate-[120deg] text-[10px] font-bold tracking-wider text-emerald-300">NHIE</div>

                  {/* Wheel center pin */}
                  <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-black border-[2px] border-gray-600 flex items-center justify-center shadow-lg z-10 text-[10px] font-black">
                    RZ
                  </div>
                </div>
              </div>

              {/* Spin trigger button */}
              <button
                onClick={handleRequestSpin}
                disabled={isAlone}
                className="neon-button py-2.5 px-6 font-bold bg-violet-600 hover:bg-violet-700 hover:border-violet-500 rounded-xl shadow-lg border-violet-500/20"
              >
                {isAlone ? 'Waiting for player...' : 'Spin Activity Wheel'}
              </button>
            </div>

            {/* Conversation Prompts card widget */}
            <div className="glass-panel p-5 bg-opacity-20 border-opacity-20">
              <h3 className="text-sm font-bold tracking-wider uppercase text-gray-300 mb-3 flex items-center gap-1.5 select-none">
                <Compass className="w-4 h-4 text-cyan-400" />
                Icebreaker Prompts
              </h3>
              
              {/* Card display */}
              <div className="min-h-[90px] p-4 rounded-xl border border-gray-800 bg-black/35 flex items-center justify-center text-center text-xs md:text-sm font-light leading-relaxed mb-4">
                {promptText}
              </div>

              {/* Prompts drawers buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDrawPrompt('conversation')}
                  className="flex-1 py-2 rounded-lg border border-gray-700/50 bg-gray-800/30 hover:bg-gray-800 text-xs font-semibold tracking-wide transition-all"
                >
                  Conversation Starter
                </button>
                <button
                  onClick={() => handleDrawPrompt('cultural')}
                  className="flex-1 py-2 rounded-lg border border-gray-700/50 bg-gray-800/30 hover:bg-gray-800 text-xs font-semibold tracking-wide transition-all"
                >
                  Cultural Exchange
                </button>
              </div>
            </div>

            {/* Scoreboard and awards badges */}
            <div className="glass-panel p-5 bg-opacity-20 border-opacity-20">
              <h3 className="text-sm font-bold tracking-wider uppercase text-gray-300 mb-3 flex items-center gap-1.5 select-none">
                <Trophy className="w-4 h-4 text-yellow-500" />
                Scores & Badges
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {usersList.map((user) => (
                  <div key={user.id} className="p-3 rounded-xl border border-gray-800 bg-black/25 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-300 truncate max-w-[70%]">{user.nickname}</span>
                      <span className="text-xs font-black text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-900/30">
                        {user.score} pts
                      </span>
                    </div>
                    {/* Badges list */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.awards.length === 0 ? (
                        <span className="text-[10px] text-gray-600 italic">No achievements yet</span>
                      ) : (
                        user.awards.map((badge) => (
                          <span
                            key={badge}
                            className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md"
                          >
                            🏅 {badge}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

        {/* SPINNING ANIMATION SCREEN */}
        {spinning && (
          <motion.div
            key="spinning-wheel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
          >
            <h2 className="text-2xl font-black mb-10 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 animate-pulse select-none">
              SPINNING WHEEL...
            </h2>

            {/* Animating Wheel */}
            <motion.div
              animate={{ rotate: spinDeg }}
              transition={{ duration: 2.5, ease: [0.15, 0.85, 0.35, 1] }}
              className="relative w-64 h-64 md:w-72 md:h-72"
            >
              {/* Top pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 z-20 w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-rose-500 filter drop-shadow-md" />
              
              <div className="w-full h-full rounded-full border-[4px] border-gray-700 bg-gray-900 overflow-hidden relative shadow-2xl">
                {/* Segments */}
                <div className="absolute inset-0 bg-violet-600/20 border-r border-gray-800 origin-center rotate-[60deg]" style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%)' }} />
                <div className="absolute inset-0 bg-cyan-600/20 border-r border-gray-800 origin-center rotate-[180deg]" style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%)' }} />
                <div className="absolute inset-0 bg-emerald-600/20 border-r border-gray-800 origin-center rotate-[300deg]" style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%)' }} />

                <div className="absolute top-[20%] left-1/2 -translate-x-1/2 text-xs font-black tracking-wider text-violet-300">Scribble</div>
                <div className="absolute bottom-[22%] left-[16%] rotate-[120deg] text-xs font-black tracking-wider text-cyan-300">Story</div>
                <div className="absolute bottom-[22%] right-[16%] -rotate-[120deg] text-xs font-black tracking-wider text-emerald-300">NHIE</div>

                <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black border-[3px] border-gray-600 flex items-center justify-center shadow-lg z-10 text-xs font-black text-gray-300">
                  Room0
                </div>
              </div>
            </motion.div>

            {/* Selection notification popup */}
            {selectedGameFromSpin && (
              <motion.p
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-12 text-sm font-semibold tracking-wider text-gray-300"
              >
                Matching on{' '}
                <span className="text-violet-400 uppercase font-black">
                  {selectedGameFromSpin === 'nhie' ? 'Never Have I Ever' : selectedGameFromSpin}
                </span>
              </motion.p>
            )}
          </motion.div>
        )}

        {/* ACTIVE GAME WRAPPERS */}
        {activeGame && !spinning && (
          <motion.div
            key="active-game-window"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {activeGame === 'scribble' && (
              <ScribbleGame
                socket={socket}
                roomId={roomId}
                userId={userId}
                session={roomState?.scribble || null}
                users={roomState?.users || {}}
                onQuit={handleQuitGame}
              />
            )}
            {activeGame === 'story' && (
              <StoryBuilderGame
                socket={socket}
                roomId={roomId}
                userId={userId}
                session={roomState?.story || null}
                onQuit={handleQuitGame}
              />
            )}
            {activeGame === 'nhie' && (
              <NeverHaveIEverGame
                socket={socket}
                roomId={roomId}
                userId={userId}
                session={roomState?.nhie || null}
                users={roomState?.users || {}}
                onQuit={handleQuitGame}
              />
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
