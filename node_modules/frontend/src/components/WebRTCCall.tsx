'use client';

import React, { useEffect, useRef } from 'react';
import { Phone, Video, PhoneOff, Mic, MicOff, VideoOff, Loader2, UserCheck, Shield } from 'lucide-react';
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

export default function WebRTCCall({ callState, otherUserNickname }: WebRTCCallProps) {
  const {
    localStream,
    remoteStream,
    callStatus,
    callType,
    incomingCallRequest,
    isAudioMuted,
    isVideoMuted,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo
  } = callState;

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Hook streams up to video/audio tags
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
    if (remoteAudioRef.current && remoteStream && callType === 'voice') {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType, callStatus]);

  return (
    <div className="w-full relative z-20">
      <AnimatePresence mode="wait">
        
        {/* IDLE state - display initial call choices */}
        {callStatus === 'idle' && (
          <motion.div
            key="idle-buttons"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-3 glass-panel bg-opacity-20 justify-center"
          >
            <span className="text-xs text-gray-400 font-medium mr-2 flex items-center gap-1.5 select-none">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
              Call Partner (Consent required):
            </span>
            <button
              onClick={() => startCall('voice')}
              className="neon-button py-2 px-3 text-xs bg-violet-600/30 border-violet-500/20 hover:border-violet-500 hover:bg-violet-600/50 flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              Voice Call
            </button>
            <button
              onClick={() => startCall('video')}
              className="neon-button py-2 px-3 text-xs bg-cyan-600/30 border-cyan-500/20 hover:border-cyan-500 hover:bg-cyan-600/50 flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              Video Call
            </button>
          </motion.div>
        )}

        {/* OFFERING state - waiting for remote response */}
        {callStatus === 'offering' && (
          <motion.div
            key="offering"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-4 glass-panel border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Requesting call consent...</p>
                <p className="text-xs text-gray-500">Waiting for {otherUserNickname} to accept the {callType} call.</p>
              </div>
            </div>
            <button
              onClick={endCall}
              className="neon-button py-1.5 px-4 text-xs bg-red-950/40 border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              Cancel
            </button>
          </motion.div>
        )}

        {/* RECEIVING state - consent modal */}
        {callStatus === 'receiving' && incomingCallRequest && (
          <motion.div
            key="receiving-consent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-5 glass-panel border-violet-500/40 shadow-2xl relative overflow-hidden bg-violet-950/20"
          >
            {/* Ambient indicator */}
            <div className="absolute -inset-10 bg-radial-gradient from-violet-500/10 to-transparent pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-600/30 flex items-center justify-center border border-violet-500/30 animate-pulse">
                  {incomingCallRequest.type === 'video' ? (
                    <Video className="w-5 h-5 text-violet-400" />
                  ) : (
                    <Phone className="w-5 h-5 text-violet-400" />
                  )}
                </div>
                <div className="text-center md:text-left">
                  <p className="text-sm font-bold text-white">Incoming {incomingCallRequest.type} call</p>
                  <p className="text-xs text-gray-400">
                    {otherUserNickname} wants to connect with you. Consent is required.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-center">
                <button
                  onClick={declineCall}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors w-24 md:w-auto"
                >
                  Decline
                </button>
                <button
                  onClick={acceptCall}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/50 transition-all w-24 md:w-auto flex items-center justify-center gap-1.5 border border-emerald-500/30"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Accept
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* CONNECTING state */}
        {callStatus === 'connecting' && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 glass-panel border-cyan-500/30 flex items-center justify-center gap-3"
          >
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-sm font-semibold text-cyan-300">Connecting peer streams safely...</span>
          </motion.div>
        )}

        {/* ACTIVE call layout */}
        {callStatus === 'active' && (
          <motion.div
            key="active-call"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 p-4 glass-panel bg-black/40 border-violet-500/30 relative"
          >
            {callType === 'video' ? (
              /* Video call display: split/grid overlay */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64 md:h-80 relative rounded-xl overflow-hidden bg-black/60 border border-gray-800">
                {/* Remote Stream */}
                <div className="relative w-full h-full flex items-center justify-center bg-gray-950">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-gray-300 font-semibold border border-gray-800">
                    {otherUserNickname}
                  </div>
                </div>

                {/* Local Stream */}
                <div className="relative w-full h-full flex items-center justify-center bg-gray-950 border-t md:border-t-0 md:border-l border-gray-800">
                  {isVideoMuted ? (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <VideoOff className="w-8 h-8 text-gray-600" />
                      <span className="text-[10px] text-gray-500">Camera Off</span>
                    </div>
                  ) : (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-gray-300 font-semibold border border-gray-800">
                    You (Local)
                  </div>
                </div>
              </div>
            ) : (
              /* Voice call display: avatar panel and audio wave indicators */
              <div className="flex flex-col items-center justify-center py-6 bg-black/45 rounded-xl border border-gray-800">
                {/* Invisible element to hook remote audio track */}
                <audio ref={remoteAudioRef} autoPlay />

                <div className="flex items-center gap-6 mb-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-lg font-bold text-violet-400">
                      You
                    </div>
                    {isAudioMuted && (
                      <div className="absolute -bottom-1 -right-1 bg-red-600 p-1 rounded-full border border-black">
                        <MicOff className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Bouncing call waves */}
                  <div className="flex gap-1.5 items-center h-8">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-violet-400 rounded-full"
                        animate={{ height: isAudioMuted ? 4 : [8, 24, 8] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.12,
                          ease: 'easeInOut'
                        }}
                      />
                    ))}
                  </div>

                  <div className="w-14 h-14 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-lg font-bold text-cyan-400">
                    {otherUserNickname.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-400">Voice call active with {otherUserNickname}</p>
              </div>
            )}

            {/* In-Call Controls bar */}
            <div className="flex justify-center items-center gap-4 border-t border-gray-800/60 pt-3">
              {/* Mic Toggler */}
              <button
                onClick={toggleAudio}
                className={`p-3 rounded-full border transition-all ${
                  isAudioMuted
                    ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                    : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
                title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Video Toggler */}
              {callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-full border transition-all ${
                    isVideoMuted
                      ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                      : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                  title={isVideoMuted ? 'Turn camera on' : 'Turn camera off'}
                >
                  {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
              )}

              {/* End Call Button */}
              <button
                onClick={endCall}
                className="p-3 rounded-full bg-red-600 hover:bg-red-700 border border-red-500/40 text-white transition-all shadow-lg shadow-red-950/30"
                title="Hang up call"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
