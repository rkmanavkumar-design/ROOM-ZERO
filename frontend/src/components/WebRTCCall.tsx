'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Phone, Video, PhoneOff, Mic, MicOff, VideoOff,
  Loader2, UserCheck, Shield, Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WebRTCCallProps {
  callState: {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    callStatus: 'idle' | 'offering' | 'receiving' | 'connecting' | 'active';
    callType: 'voice' | 'video' | null;
    incomingCallRequest: { senderId: string; type: 'voice' | 'video' } | null;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
    startCall: (type: 'voice' | 'video') => Promise<void>;
    acceptCall: () => Promise<void>;
    declineCall: () => void;
    endCall: () => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
  };
  otherUserNickname: string;
}

function useCallTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function WebRTCCall({ callState, otherUserNickname }: WebRTCCallProps) {
  const {
    localStream, remoteStream, callStatus, callType,
    incomingCallRequest, isAudioMuted, isVideoMuted,
    startCall, acceptCall, declineCall, endCall, toggleAudio, toggleVideo
  } = callState;

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timer = useCallTimer(callStatus === 'active');

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && callType === 'video') {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType, callStatus]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  const isCallActive = callStatus !== 'idle';

  /* ── Idle: call initiation buttons (only when no call active) ── */
  if (callStatus === 'idle') {
    return (
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 glass-panel bg-opacity-20 justify-center flex-wrap"
        >
          <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 select-none w-full justify-center mb-1">
            <Shield className="w-3 h-3 text-violet-400" />
            Consent required before connecting
          </span>
          <button
            id="start-voice-call-btn"
            onClick={() => startCall('voice')}
            className="neon-button py-2.5 px-4 text-xs bg-violet-600/25 border-violet-500/20 hover:border-violet-500 hover:bg-violet-600/40 flex-1"
          >
            <Phone className="w-4 h-4" /> Voice Call
          </button>
          <button
            id="start-video-call-btn"
            onClick={() => startCall('video')}
            className="neon-button py-2.5 px-4 text-xs bg-cyan-600/25 border-cyan-500/20 hover:border-cyan-500 hover:bg-cyan-600/40 flex-1"
          >
            <Video className="w-4 h-4" /> Video Call
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Full-screen overlay for everything else ── */
  return (
    <AnimatePresence>
      {isCallActive && (
        <motion.div
          key="call-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`call-overlay ${callType === 'video' && callStatus === 'active' ? 'call-overlay-video' : ''}`}
        >
          {/* Hidden audio — works for both voice and video */}
          <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

          {/* ── OFFERING ── */}
          {callStatus === 'offering' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-violet-600/20 border-2 border-violet-500/30 flex items-center justify-center text-4xl font-black text-violet-300">
                  {otherUserNickname.substring(0, 2).toUpperCase()}
                </div>
                <div className="absolute inset-0 rounded-full ring-pulse border-2 border-violet-400/40" />
                <div className="absolute inset-0 rounded-full ring-pulse-2 border-2 border-violet-400/20" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-white font-bold text-xl">{otherUserNickname}</p>
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Waiting for {callType === 'video' ? 'video' : 'voice'} call consent…</span>
                </div>
              </div>
              <button
                id="cancel-call-btn"
                onClick={endCall}
                className="mt-8 w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-2xl shadow-red-900/40 active:scale-95 transition-all"
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <p className="text-xs text-gray-600">Tap to cancel</p>
            </div>
          )}

          {/* ── RECEIVING (incoming call) ── */}
          {callStatus === 'receiving' && incomingCallRequest && (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-600/30 to-cyan-600/30 border-2 border-violet-500/40 flex items-center justify-center text-5xl font-black text-white">
                  {otherUserNickname.substring(0, 2).toUpperCase()}
                </div>
                <div className="absolute inset-0 rounded-full ring-pulse border-2 border-violet-400/50" />
                <div className="absolute inset-0 rounded-full ring-pulse-2 border-2 border-violet-400/30" />
                <div className="absolute inset-0 rounded-full ring-pulse-3 border-2 border-violet-400/15" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-white font-bold text-2xl">{otherUserNickname}</p>
                <p className="text-gray-400 text-sm flex items-center gap-1.5 justify-center">
                  {incomingCallRequest.type === 'video'
                    ? <><Video className="w-4 h-4" /> Incoming video call</>
                    : <><Phone className="w-4 h-4" /> Incoming voice call</>}
                </p>
              </div>

              {/* Accept / Decline */}
              <div className="flex items-center gap-16">
                <div className="flex flex-col items-center gap-2">
                  <button
                    id="decline-call-btn"
                    onClick={declineCall}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-2xl shadow-red-900/40 active:scale-95 transition-all"
                  >
                    <PhoneOff className="w-7 h-7 text-white" />
                  </button>
                  <span className="text-xs text-gray-500">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button
                    id="accept-call-btn"
                    onClick={acceptCall}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-900/40 active:scale-95 transition-all"
                  >
                    <UserCheck className="w-7 h-7 text-white" />
                  </button>
                  <span className="text-xs text-gray-500">Accept</span>
                </div>
              </div>
            </div>
          )}

          {/* ── CONNECTING ── */}
          {callStatus === 'connecting' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
              <p className="text-cyan-300 font-semibold text-lg">Connecting…</p>
              <p className="text-gray-500 text-sm text-center">Establishing encrypted peer connection</p>
            </div>
          )}

          {/* ── ACTIVE: VIDEO ── */}
          {callStatus === 'active' && callType === 'video' && (
            <div className="flex-1 relative bg-black overflow-hidden">
              {/* Remote (full screen) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Remote name tag */}
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/60 text-xs text-white font-semibold backdrop-blur-sm border border-white/10">
                {otherUserNickname}
              </div>

              {/* Local PiP — bottom right */}
              <div className="absolute bottom-24 right-4 w-28 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gray-900">
                {isVideoMuted ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <VideoOff className="w-6 h-6 text-gray-600" />
                  </div>
                ) : (
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-white/70 font-semibold">
                  You
                </div>
              </div>

              {/* Timer */}
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 text-xs text-white font-mono backdrop-blur-sm border border-white/10">
                {timer}
              </div>

              {/* Controls bar */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center gap-5 pb-safe p-5 bg-gradient-to-t from-black/80 to-transparent">
                <CallButton id="toggle-mic-video" onClick={toggleAudio} active={!isAudioMuted} danger={isAudioMuted} label={isAudioMuted ? 'Unmute' : 'Mute'}>
                  {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </CallButton>
                <button
                  id="end-video-call-btn"
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-2xl active:scale-90 transition-all"
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <CallButton id="toggle-cam-btn" onClick={toggleVideo} active={!isVideoMuted} danger={isVideoMuted} label={isVideoMuted ? 'Camera On' : 'Camera Off'}>
                  {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </CallButton>
              </div>
            </div>
          )}

          {/* ── ACTIVE: VOICE ── */}
          {callStatus === 'active' && callType === 'voice' && (
            <div className="flex-1 flex flex-col items-center justify-between p-8 bg-gradient-to-b from-[#05040f] via-[#0d0b26] to-[#05040f]">
              <div />
              {/* Avatar & status */}
              <div className="flex flex-col items-center gap-5">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-700/40 to-cyan-700/30 border-2 border-violet-500/30 flex items-center justify-center text-5xl font-black text-white shadow-2xl float-anim">
                    {otherUserNickname.substring(0, 2).toUpperCase()}
                  </div>
                  {/* Glow rings when not muted */}
                  {!isAudioMuted && (
                    <>
                      <div className="absolute inset-0 rounded-full ring-pulse border border-violet-400/30" />
                      <div className="absolute inset-0 rounded-full ring-pulse-2 border border-violet-400/15" />
                    </>
                  )}
                </div>
                <div className="text-center space-y-1">
                  <p className="text-white font-bold text-2xl">{otherUserNickname}</p>
                  <p className="text-violet-300 text-sm font-mono">{timer}</p>
                  <p className="text-gray-500 text-xs">Voice call active</p>
                </div>

                {/* Audio bars */}
                <div className="flex gap-1.5 items-center h-8">
                  {[1,2,3,4,5,6,7].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-violet-400 rounded-full"
                      animate={{ height: isAudioMuted ? 4 : [6, 20, 10, 26, 8, 22, 6][i - 1] || 8 }}
                      transition={{ duration: 0.6 + i * 0.05, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                    />
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-10 mb-4">
                <CallButton id="toggle-speaker-btn" onClick={() => {}} active={true} label="Speaker">
                  <Volume2 className="w-5 h-5" />
                </CallButton>
                <button
                  id="end-voice-call-btn"
                  onClick={endCall}
                  className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-2xl shadow-red-950/60 active:scale-90 transition-all"
                >
                  <PhoneOff className="w-8 h-8 text-white" />
                </button>
                <CallButton id="toggle-mic-voice-btn" onClick={toggleAudio} active={!isAudioMuted} danger={isAudioMuted} label={isAudioMuted ? 'Unmute' : 'Mute'}>
                  {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </CallButton>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Reusable circular call control button ─────────────────────── */
function CallButton({
  children, onClick, active, danger, label, id
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  danger?: boolean;
  label?: string;
  id?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        id={id}
        onClick={onClick}
        className={`w-13 h-13 w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all active:scale-90 border ${
          danger
            ? 'bg-red-500/20 border-red-500/40 text-red-400'
            : active
              ? 'bg-white/10 border-white/15 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400'
        }`}
      >
        {children}
      </button>
      {label && <span className="text-[10px] text-gray-500 font-medium">{label}</span>}
    </div>
  );
}
