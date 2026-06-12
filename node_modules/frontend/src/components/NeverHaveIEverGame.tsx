'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, LogOut, ArrowRight, MessageCircle } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { NhieSession, User } from '@/lib/types';

interface NeverHaveIEverGameProps {
  socket: Socket | null;
  userId: string;
  session: NhieSession | null;
  users: Record<string, User>;
  onQuit: () => void;
}

export default function NeverHaveIEverGame({
  socket,
  userId,
  session,
  users,
  onQuit
}: NeverHaveIEverGameProps) {
  const [myAnswer, setMyAnswer] = useState<'have' | 'never' | null>(null);
  const [hasVotedStatus, setHasVotedStatus] = useState<Record<string, boolean>>({});

  const partner = Object.values(users).find((u) => u.id !== userId);

  // Sync vote status and reset on question change
  useEffect(() => {
    if (!session) return;

    const answersKeys = Object.keys(session.answers);
    const updatedStatus: Record<string, boolean> = {};
    answersKeys.forEach((uid) => {
      updatedStatus[uid] = true;
    });
    setHasVotedStatus(updatedStatus);

    // If a new question is loaded, reset local answers
    if (answersKeys.length === 0) {
      setMyAnswer(null);
    }
  }, [session]);

  // Listen for real-time status of other player voting
  useEffect(() => {
    if (!socket) return;

    socket.on('nhie-voted-status', ({ userId: vUid }: { userId: string }) => {
      setHasVotedStatus((prev) => ({ ...prev, [vUid]: true }));
    });

    return () => {
      socket.off('nhie-voted-status');
    };
  }, [socket]);

  const handleVote = (answer: 'have' | 'never') => {
    if (!socket || !session || myAnswer) return;

    setMyAnswer(answer);
    socket.emit('nhie-vote', answer);
  };

  const handleNextQuestion = () => {
    if (!socket) return;
    socket.emit('nhie-next');
  };

  const answersList = session?.answers || {};
  const bothVoted = Object.keys(answersList).length >= 2;

  return (
    <div className="flex-1 flex flex-col p-4 min-h-0 justify-between">
      
      {/* Header bar */}
      <div className="flex justify-between items-center bg-black/10 p-2 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-gray-300">Never Have I Ever</span>
        </div>
        <button
          onClick={onQuit}
          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors text-xs flex items-center gap-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          Quit
        </button>
      </div>

      {/* Main Question Display Card */}
      <div className="flex-1 flex items-center justify-center py-6">
        <motion.div
          key={session?.currentQuestion}
          initial={{ opacity: 0, scale: 0.95, rotateY: -15 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm glass-panel p-6 md:p-8 text-center bg-emerald-950/5 border-emerald-500/20 relative"
        >
          {/* Subtle neon glowing mesh */}
          <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 to-transparent pointer-events-none" />

          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-900/30">
            Card #{session?.history.length || 1}
          </span>
          <h2 className="text-xl md:text-2xl font-light leading-relaxed mt-6 mb-4 text-gray-100">
            &ldquo;{session?.currentQuestion}&rdquo;
          </h2>
        </motion.div>
      </div>

      {/* Results overlay or choice buttons */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          
          {/* REVEAL SCREEN: Both have voted */}
          {bothVoted ? (
            <motion.div
              key="reveal-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Answers grid */}
              <div className="grid grid-cols-2 gap-3">
                {Object.values(users).map((user) => {
                  const ans = answersList[user.id];
                  const isHave = ans === 'have';
                  return (
                    <div
                      key={user.id}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        isHave
                          ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                          : 'bg-cyan-950/20 border-cyan-500/30 text-cyan-300'
                      }`}
                    >
                      <p className="text-[10px] text-gray-500 font-medium mb-2">{user.nickname}</p>
                      <p className="text-lg font-extrabold uppercase tracking-wide">
                        {isHave ? 'I HAVE' : 'I NEVER'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Discussion Prompt */}
              {session?.discussionPrompt && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 rounded-lg border border-violet-500/20 bg-violet-950/20 text-violet-300 text-xs text-center flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 text-violet-400 shrink-0" />
                  <p className="font-light italic">&ldquo;{session.discussionPrompt}&rdquo;</p>
                </motion.div>
              )}

              {/* Next Card Button */}
              <button
                onClick={handleNextQuestion}
                className="w-full neon-button py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-emerald-500/30 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/30"
              >
                Next Card
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            /* VOTING STATUS SCREEN: Waiting for inputs */
            <motion.div
              key="voting-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Option Selection */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleVote('have')}
                  disabled={!!myAnswer}
                  className={`flex-1 py-4 font-black text-sm rounded-xl border transition-all ${
                    myAnswer === 'have'
                      ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-950/50 scale-98'
                      : 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20 text-amber-400'
                  }`}
                >
                  I HAVE
                </button>
                <button
                  onClick={() => handleVote('never')}
                  disabled={!!myAnswer}
                  className={`flex-1 py-4 font-black text-sm rounded-xl border transition-all ${
                    myAnswer === 'never'
                      ? 'bg-cyan-500 border-cyan-400 text-black shadow-lg shadow-cyan-950/50 scale-98'
                      : 'bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 text-cyan-400'
                  }`}
                >
                  I NEVER
                </button>
              </div>

              {/* Voted statuses list */}
              <div className="bg-black/25 p-3 rounded-xl border border-gray-800 text-xs flex justify-around items-center">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${myAnswer ? 'bg-emerald-400' : 'bg-gray-700'}`} />
                  <span className={myAnswer ? 'text-gray-300' : 'text-gray-500'}>You</span>
                </div>
                <div className="w-[1px] h-4 bg-gray-800" />
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${hasVotedStatus[partner?.id || ''] ? 'bg-emerald-400 animate-pulse' : 'bg-gray-700'}`} />
                  <span className={hasVotedStatus[partner?.id || ''] ? 'text-gray-300' : 'text-gray-500'}>
                    {partner?.nickname || 'Partner'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
