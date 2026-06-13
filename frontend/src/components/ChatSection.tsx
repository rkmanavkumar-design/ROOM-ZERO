'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, EyeOff, Smile, Flame, ShieldAlert, Sparkles } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Message, User } from '@/lib/types';

interface ChatSectionProps {
  socket: Socket | null;
  userId: string;
  users: Record<string, User>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export default function ChatSection({
  socket,
  userId,
  users,
  messages,
  setMessages
}: ChatSectionProps) {
  const [inputText, setInputText] = useState('');
  const [isOneTime, setIsOneTime] = useState(false);
  const [emojiTrayOpen, setEmojiTrayOpen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; left: number }[]>([]);
  const [revealedImages, setRevealedImages] = useState<Record<string, boolean>>({});
  const [imageTimers, setImageTimers] = useState<Record<string, number>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emojis = ['❤️', '😂', '🔥', '🎉', '😮', '😢', '👾', '👑'];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen to remote emoji reactions
  useEffect(() => {
    if (!socket) return;

    socket.on('emoji-received', (emoji: string) => {
      triggerFloatingEmoji(emoji);
    });

    return () => {
      socket.off('emoji-received');
    };
  }, [socket]);

  const triggerFloatingEmoji = (emoji: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    // Random horizontal position around the chat bottom
    const left = Math.floor(Math.random() * 60) + 20; // 20% to 80% width
    setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);

    // Auto-remove floating emoji after animation
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket) return;

    socket.emit('send-message', {
      text: inputText.trim(),
      isOneTime: false
    });
    setInputText('');
  };

  const handleEmojiClick = (emoji: string) => {
    if (!socket) return;
    socket.emit('emoji-reaction', emoji);
    triggerFloatingEmoji(emoji);
    setEmojiTrayOpen(false);
  };

  // Convert image upload to base64 and send
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    // Check size limit (limit to 2MB for browser socket buffers)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image is too large. Max size is 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      socket.emit('send-message', {
        imageUrl: base64Data,
        isOneTime: isOneTime
      });
      // Reset input file and toggle
      setIsOneTime(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  // Trigger exploding image view
  const revealOneTimeImage = (msgId: string) => {
    if (revealedImages[msgId]) return; // Already revealed or expired

    setRevealedImages((prev) => ({ ...prev, [msgId]: true }));
    setImageTimers((prev) => ({ ...prev, [msgId]: 3 }));

    // Start 3-second countdown
    const interval = setInterval(() => {
      setImageTimers((prev) => {
        const currentVal = prev[msgId];
        if (currentVal <= 1) {
          clearInterval(interval);
          // Purge image from state
          setMessages((prevMsgs) =>
            prevMsgs.map((msg) =>
              msg.id === msgId ? { ...msg, imageUrl: undefined, text: '[Expired Exploding Image]' } : msg
            )
          );
          return { ...prev, [msgId]: 0 };
        }
        return { ...prev, [msgId]: currentVal - 1 };
      });
    }, 1000);
  };

  // Compute social compatibility score based on room metrics
  const getCompatibilityScore = () => {
    const messageCount = messages.length;
    // Sum of both players' points
    const totalScore = Object.values(users).reduce((acc, u) => acc + u.score, 0);
    // Basic score calculation
    const base = 50 + (messageCount * 1.5) + (totalScore * 0.5);
    return Math.min(Math.round(base), 100);
  };

  return (
    <div className="flex flex-col h-full relative">
      
      {/* Dynamic Floating Emojis Animation Layer */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        <AnimatePresence>
          {floatingEmojis.map((item) => (
            <motion.div
              key={item.id}
              initial={{ y: '80%', opacity: 1, scale: 0.8 }}
              animate={{ y: '10%', opacity: 0, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
              style={{ left: `${item.left}%`, position: 'absolute' }}
              className="text-4xl filter drop-shadow-lg"
            >
              {item.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Social Info Header & Compatibility Meter */}
      <div className="p-3 border-b border-gray-800 bg-black/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
          <span className="text-sm font-semibold tracking-wide">Compatibility Index</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 bg-gray-800 h-2.5 rounded-full overflow-hidden border border-gray-700">
            <motion.div
              className="bg-gradient-to-r from-amber-500 to-rose-500 h-full"
              initial={{ width: '50%' }}
              animate={{ width: `${getCompatibilityScore()}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs font-bold text-amber-400">{getCompatibilityScore()}%</span>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-black/10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <Sparkles className="w-10 h-10 text-gray-700 mb-2 animate-bounce" />
            <p className="text-sm font-light">Your connection is safe. Write a message or pick an activity above to start playing.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === userId;
            const senderName = users[msg.senderId]?.nickname || msg.senderNickname;

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                {/* Sender Nickname */}
                <span className="text-[10px] text-gray-500 mb-1 px-1">{senderName}</span>

                {/* Message Bubble */}
                <div
                  className={`p-3 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-violet-600/30 border border-violet-500/20 text-white rounded-tr-none'
                      : 'bg-gray-800/40 border border-gray-700/30 text-gray-200 rounded-tl-none'
                  }`}
                >
                  {/* Text content */}
                  {msg.text && <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>}

                  {/* Image Transfer OR Exploding Image */}
                  {msg.imageUrl && (
                    <div className="mt-1 relative rounded-lg overflow-hidden max-w-xs border border-gray-700">
                      {msg.isOneTime ? (
                        // One-time exploding view logic
                        !revealedImages[msg.id] ? (
                          <button
                            onClick={() => revealOneTimeImage(msg.id)}
                            className="bg-red-950/40 hover:bg-red-900/60 p-4 text-xs font-bold text-red-400 flex flex-col items-center gap-2 transition-all w-full min-w-[200px]"
                          >
                            <EyeOff className="w-6 h-6 text-red-400 animate-pulse" />
                            <span>Exploding Media (Click to Reveal)</span>
                          </button>
                        ) : imageTimers[msg.id] > 0 ? (
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.imageUrl}
                              alt="Exploding content"
                              className="w-full object-cover max-h-48"
                            />
                            <div className="absolute top-2 right-2 bg-red-600/90 text-white font-bold text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 animate-spin" />
                              <span>{imageTimers[msg.id]}s</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-950 text-xs text-gray-500 italic flex items-center gap-2">
                            <EyeOff className="w-4 h-4" />
                            <span>Expired Exploding Image</span>
                          </div>
                        )
                      ) : (
                        // Normal image sharing
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.imageUrl}
                          alt="Shared content"
                          className="w-full object-cover max-h-60 rounded"
                        />
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-gray-600 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Panel Controls */}
      <div className="p-3 border-t border-gray-800 bg-black/30 flex flex-col gap-2 relative">
        
        {/* Emoji Tray Overlay */}
        <AnimatePresence>
          {emojiTrayOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-16 left-3 p-2 rounded-xl bg-gray-900 border border-gray-800 shadow-2xl flex gap-1.5 z-40"
            >
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-2xl hover:scale-130 active:scale-95 transition-transform p-1.5"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendText} className="flex items-center gap-2">
          {/* Reaction Tray Button */}
          <button
            type="button"
            onClick={() => setEmojiTrayOpen(!emojiTrayOpen)}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Image Uploader Interface */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 glass-input py-2 text-sm"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Media Option Settings */}
        <div className="flex items-center justify-between px-1 text-xs text-gray-500">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isOneTime}
              onChange={(e) => setIsOneTime(e.target.checked)}
              className="accent-red-500 scale-95"
            />
            <span className={`transition-colors flex items-center gap-1 ${isOneTime ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
              <EyeOff className="w-3.5 h-3.5" />
              One-Time View Image (Explodes in 5s)
            </span>
          </label>
          <span className="text-[10px] text-gray-600 font-light">RAM-only transmission</span>
        </div>
      </div>
    </div>
  );
}
