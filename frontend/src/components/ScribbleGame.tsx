'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, LogOut, ShieldAlert, Timer } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { ScribbleSession, User } from '@/lib/types';

interface ScribbleGameProps {
  socket: Socket | null;
  userId: string;
  session: ScribbleSession | null;
  users: Record<string, User>;
  onQuit: () => void;
}

interface DrawingData {
  x: number;
  y: number;
  color: string;
  size: number;
  circlesOnly: boolean;
  prevX?: number;
  prevY?: number;
}

interface CanvasWithPrevCoords extends HTMLCanvasElement {
  prevCoords?: { x: number; y: number };
}

export default function ScribbleGame({
  socket,
  userId,
  session,
  users,
  onQuit
}: ScribbleGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#8b5cf6'); // Default violet
  const [brushSize, setBrushSize] = useState(5);
  const [guess, setGuess] = useState('');
  const [hasLiftingOccurred, setHasLiftingOccurred] = useState(false);
  
  const isDrawer = session?.drawerId === userId;
  const drawerNickname = session ? users[session.drawerId]?.nickname : '';

  // Resize canvas helper
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set dimensions based on bounding container
    const rect = canvas.parentElement?.getBoundingClientRect();
    canvas.width = rect?.width || 500;
    canvas.height = rect?.height || 300;

    // Canvas styling defaults
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
  }, [color, brushSize]);

  useEffect(() => {
    initializeCanvas();
    window.addEventListener('resize', initializeCanvas);
    return () => window.removeEventListener('resize', initializeCanvas);
  }, [initializeCanvas]);

  // Handle drawings from the drawer on the guesser's screen
  useEffect(() => {
    if (!socket || isDrawer) return;

    const handleDrawingData = (data: DrawingData) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      ctx.save();
      ctx.lineWidth = data.size;
      ctx.strokeStyle = data.color;
      ctx.fillStyle = data.color;

      if (data.circlesOnly) {
        // Draw circle point
        ctx.beginPath();
        ctx.arc(data.x, data.y, data.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (data.prevX !== undefined && data.prevY !== undefined) {
        // Standard path drawing
        ctx.beginPath();
        ctx.moveTo(data.prevX, data.prevY);
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const handleCleared = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    socket.on('scribble-drawing', handleDrawingData);
    socket.on('scribble-cleared', handleCleared);

    return () => {
      socket.off('scribble-drawing', handleDrawingData);
      socket.off('scribble-cleared', handleCleared);
    };
  }, [socket, isDrawer]);

  // Clear Canvas (Drawer only)
  const clearCanvas = () => {
    if (!isDrawer || !socket) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      socket.emit('scribble-clear');
    }
  };

  // Canvas Drawing logic (Mouse / Touch)
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !session) return;

    // Check One Line Chaos Modifier
    if (session.chaosModifier === 'one-line' && hasLiftingOccurred) {
      return;
    }

    const coords = getCoordinates(e);
    if (!coords) return;

    setDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.fillStyle = color;

      if (session.chaosModifier === 'circles-only') {
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2);
        ctx.fill();

        if (socket) {
          socket.emit('scribble-draw', {
            x: coords.x,
            y: coords.y,
            color,
            size: brushSize,
            circlesOnly: true
          });
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
      }
      ctx.restore();
    }
    
    // Store coordinate reference
    (e.currentTarget as CanvasWithPrevCoords).prevCoords = coords;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing || !isDrawer || !session) return;
    if (session.chaosModifier === 'one-line' && hasLiftingOccurred) return;

    const coords = getCoordinates(e);
    const prevCoords = (e.currentTarget as CanvasWithPrevCoords).prevCoords;
    if (!coords || !prevCoords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.fillStyle = color;

      if (session.chaosModifier === 'circles-only') {
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2);
        ctx.fill();

        if (socket) {
          socket.emit('scribble-draw', {
            x: coords.x,
            y: coords.y,
            color,
            size: brushSize,
            circlesOnly: true
          });
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(prevCoords.x, prevCoords.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        if (socket) {
          socket.emit('scribble-draw', {
            x: coords.x,
            y: coords.y,
            prevX: prevCoords.x,
            prevY: prevCoords.y,
            color,
            size: brushSize,
            circlesOnly: false
          });
        }
      }
      ctx.restore();
    }

    (e.currentTarget as CanvasWithPrevCoords).prevCoords = coords;
  };

  const stopDrawing = () => {
    if (!drawing) return;
    setDrawing(false);

    if (isDrawer && session?.chaosModifier === 'one-line') {
      setHasLiftingOccurred(true);
    }
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !socket) return;
    socket.emit('scribble-guess', guess.trim());
    setGuess('');
  };

  return (
    <div className="flex-1 flex flex-col p-4 min-h-0">
      
      {/* Header bar: Timer, Modifier info, Quit button */}
      <div className="flex justify-between items-center mb-3 bg-black/10 p-2 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-rose-400 animate-pulse" />
          <span className="text-sm font-bold text-rose-300">{session?.timer}s remaining</span>
        </div>
        <button
          onClick={onQuit}
          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors text-xs flex items-center gap-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          Quit Activity
        </button>
      </div>

      {/* Chaos Modifier alert header */}
      <AnimatePresence>
        {session?.chaosModifier && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs font-semibold flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              {session.chaosModifier === 'opposite-hand' && 'CHAOS ACTIVE: Opposite hand challenge! Draw with your non-dominant hand.'}
              {session.chaosModifier === 'circles-only' && 'CHAOS ACTIVE: Circles only! Standard lines are blocked.'}
              {session.chaosModifier === 'one-line' && 'CHAOS ACTIVE: One-line challenge! Once you release the cursor, drawing locks.'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Instructions banner */}
      <div className="text-center mb-3">
        {isDrawer ? (
          <p className="text-sm">
            You are the Drawer. Draw this secret word: <span className="font-extrabold text-violet-400 text-lg uppercase tracking-widest">{session?.word}</span>
          </p>
        ) : (
          <p className="text-sm">
            You are the Guesser. Watch <span className="font-bold text-cyan-400">{drawerNickname}</span> draw and guess the secret word!
          </p>
        )}
      </div>

      {/* Drawing Arena Canvas container */}
      <div className="flex-1 min-h-[220px] relative rounded-xl overflow-hidden bg-black/40 border border-gray-800 flex flex-col">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full flex-1 ${isDrawer ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
        />

        {/* Drawer's Tools menu overlay */}
        {isDrawer && (
          <div className="absolute bottom-3 left-3 right-3 p-2 bg-gray-950/85 backdrop-blur-md rounded-xl border border-gray-800 flex items-center justify-between gap-3 flex-wrap">
            {/* Color Swatches */}
            <div className="flex gap-1.5">
              {['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ffffff'].map((colorHex) => (
                <button
                  key={colorHex}
                  onClick={() => setColor(colorHex)}
                  style={{ backgroundColor: colorHex }}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    color === colorHex ? 'scale-120 border-white ring-2 ring-violet-500/50' : 'border-black/50 hover:scale-110'
                  }`}
                />
              ))}
            </div>

            {/* Brush sizes */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">Size:</span>
              <input
                type="range"
                min="2"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-16 h-1 accent-violet-500 rounded bg-gray-800"
              />
            </div>

            {/* Clear Button */}
            <button
              onClick={clearCanvas}
              disabled={session?.chaosModifier === 'one-line' && hasLiftingOccurred}
              className="p-1.5 bg-red-950/50 hover:bg-red-900/60 border border-red-500/20 rounded-lg text-red-400 hover:text-red-300 text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Canvas
            </button>
          </div>
        )}

        {/* Guesser's drawings locks screen */}
        {isDrawer && session?.chaosModifier === 'one-line' && hasLiftingOccurred && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-center p-4">
            <div className="max-w-xs p-4 rounded-xl border border-amber-500/30 bg-gray-900 shadow-2xl">
              <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto mb-2 animate-bounce" />
              <p className="text-xs text-gray-300 font-semibold">One-Line Challenge Locked!</p>
              <p className="text-[10px] text-gray-500 mt-1">You lifted the brush. No further drawing is allowed this round.</p>
            </div>
          </div>
        )}
      </div>

      {/* Guesser input box */}
      {!isDrawer && (
        <form onSubmit={handleGuessSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Type your guess here..."
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            className="flex-1 glass-input py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!guess.trim()}
            className="px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Submit Guess
          </button>
        </form>
      )}

    </div>
  );
}
