'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, LogOut, ArrowRight, Download, Sparkles, Wand2 } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { StoryBuilderSession } from '@/lib/types';

interface StoryBuilderGameProps {
  socket: Socket | null;
  userId: string;
  session: StoryBuilderSession | null;
  onQuit: () => void;
}

export default function StoryBuilderGame({
  socket,
  userId,
  session,
  onQuit
}: StoryBuilderGameProps) {
  const [sentence, setSentence] = useState('');
  const storyEndRef = useRef<HTMLDivElement>(null);

  const isMyTurn = session?.turnUserId === userId;
  const sentenceList = session?.sentences || [];

  // Scroll to bottom on new story additions
  useEffect(() => {
    storyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sentenceList]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentence.trim() || !socket || !isMyTurn) return;

    socket.emit('story-submit', sentence.trim());
    setSentence('');
  };

  const handleExportStory = () => {
    if (sentenceList.length === 0) return;

    // Compile formatting
    const header = `=========================================\n       ROOMZERO COLLABORATIVE STORY      \n=========================================\n\n`;
    const body = sentenceList
      .map((s, index) => `${index + 1}. [${s.nickname}]:\n   "${s.text}"`)
      .join('\n\n');
    const footer = `\n\n=========================================\n       Thank you for writing with us!    \n=========================================\n`;

    const compiledText = header + body + footer;
    
    // Create download
    const blob = new Blob([compiledText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RoomZero_Story_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col p-4 min-h-0">
      
      {/* Header: Turn Info, Export and Quit buttons */}
      <div className="flex justify-between items-center mb-3 bg-black/10 p-2 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-gray-300">Story Builder</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportStory}
            disabled={sentenceList.length === 0}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-xs flex items-center gap-1 disabled:opacity-40"
            title="Download compiled story as TXT"
          >
            <Download className="w-3.5 h-3.5" />
            Export Story
          </button>
          <button
            onClick={onQuit}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors text-xs flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Quit
          </button>
        </div>
      </div>

      {/* Narrative book layout */}
      <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-black/40 border border-gray-800 space-y-4 mb-3 min-h-0 flex flex-col">
        {sentenceList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <Wand2 className="w-8 h-8 text-gray-700 mb-2 animate-bounce" />
            <p className="text-xs">Once upon a time...</p>
            <p className="text-[10px] text-gray-600 mt-1">
              Take turns adding sentences. The server will throw random twists!
            </p>
          </div>
        ) : (
          <div className="space-y-4 flex-1">
            {sentenceList.map((item, idx) => {
              const isMe = item.userId === userId;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${isMe ? 'items-end text-right' : 'items-start text-left'}`}
                >
                  <span className="text-[10px] text-gray-500 mb-1">{item.nickname}</span>
                  <div className="p-3.5 rounded-xl border border-gray-800 bg-gray-900/60 max-w-[85%] relative overflow-hidden">
                    <p className="text-xs md:text-sm font-light italic leading-relaxed text-gray-200">
                      &ldquo;{item.text}&rdquo;
                    </p>
                  </div>
                </motion.div>
              );
            })}
            <div ref={storyEndRef} />
          </div>
        )}
      </div>

      {/* Plot Twist overlay widget */}
      <AnimatePresence>
        {isMyTurn && session?.currentTwist && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-3 p-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 text-cyan-300 text-xs font-semibold relative overflow-hidden flex items-start gap-2.5"
          >
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-[10px] uppercase font-black tracking-wider text-cyan-400 mb-0.5">Automated Plot Twist</p>
              <p className="font-light italic text-gray-200">&ldquo;{session.currentTwist}&rdquo;</p>
              <p className="text-[9px] text-cyan-500 mt-1 font-medium">Incorporate this development in your next sentence!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn indicator status & Input form */}
      <div className="bg-black/20 p-3 rounded-xl border border-gray-800/60 flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 font-medium">
            Status:{' '}
            <span className={isMyTurn ? 'text-cyan-400 font-bold' : 'text-gray-500'}>
              {isMyTurn ? 'Your Turn' : 'Partner Writing...'}
            </span>
          </span>
          <span className="text-gray-600 text-[10px]">{sentenceList.length} sentences compiled</span>
        </div>

        {isMyTurn ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder={session?.currentTwist ? 'Incorporate the twist...' : 'Write the next sentence...'}
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              className="flex-1 glass-input py-2 text-sm"
              maxLength={150}
              required
            />
            <button
              type="submit"
              disabled={!sentence.trim()}
              className="px-5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
            >
              Add
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="py-2.5 text-center text-xs text-gray-500 italic">
            Waiting for your partner to add their line to the scroll...
          </div>
        )}
      </div>

    </div>
  );
}
