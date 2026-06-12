'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseWebRTCOptions {
  socket: Socket | null;
  roomId: string;
}

export function useWebRTC({ socket, roomId }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'offering' | 'receiving' | 'connecting' | 'active'>('idle');
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [incomingCallRequest, setIncomingCallRequest] = useState<{ senderId: string; type: 'voice' | 'video' } | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Close connection helper
  const closeConnection = useCallback(() => {
    console.log('Closing peer connection...');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setCallType(null);
    setIncomingCallRequest(null);
  }, []);

  // Initialize RTCPeerConnection
  const initPeerConnection = useCallback((type: 'voice' | 'video', stream: MediaStream) => {
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-signal', {
          candidate: event.candidate,
          roomId
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.streams[0]);
      setRemoteStream(event.streams[0]);
      setCallStatus('active');
    };

    // Add local tracks to PeerConnection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    peerConnectionRef.current = pc;
    return pc;
  }, [roomId, socket, iceServers]);

  // Request Call
  const startCall = useCallback(async (type: 'voice' | 'video') => {
    if (!socket) return;
    try {
      setCallStatus('offering');
      setCallType(type);

      // Request user media
      const constraints = {
        audio: true,
        video: type === 'video' ? { facingMode: 'user' } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      socket.emit('call-request', { type });
      console.log(`Call requested: ${type}`);
    } catch (err) {
      console.error('Error getting media stream:', err);
      closeConnection();
      alert('Could not access microphone/camera. Please check permissions.');
    }
  }, [socket, closeConnection]);

  // Accept Call
  const acceptCall = useCallback(async () => {
    if (!socket || !incomingCallRequest) return;
    const { type } = incomingCallRequest;

    try {
      setCallStatus('connecting');
      setCallType(type);

      const constraints = {
        audio: true,
        video: type === 'video' ? { facingMode: 'user' } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Initialize connection
      initPeerConnection(type, stream);

      // Respond back to caller
      socket.emit('call-response', { accepted: true });
      setIncomingCallRequest(null);
    } catch (err) {
      console.error('Error accepting call media:', err);
      socket.emit('call-response', { accepted: false });
      closeConnection();
    }
  }, [socket, incomingCallRequest, initPeerConnection, closeConnection]);

  // Decline Call
  const declineCall = useCallback(() => {
    if (socket && incomingCallRequest) {
      socket.emit('call-response', { accepted: false });
    }
    setIncomingCallRequest(null);
    setCallStatus('idle');
  }, [socket, incomingCallRequest]);

  // Hangup
  const endCall = useCallback(() => {
    if (socket) {
      socket.emit('end-call');
    }
    closeConnection();
  }, [socket, closeConnection]);

  // Socket signaling listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming Call request
    socket.on('call-request-received', ({ senderId, type }: { senderId: string; type: 'voice' | 'video' }) => {
      console.log(`Received call request from ${senderId}`);
      if (callStatus !== 'idle') {
        // Automatically busy if in another call
        socket.emit('call-response', { accepted: false });
        return;
      }
      setIncomingCallRequest({ senderId, type });
      setCallStatus('receiving');
    });

    // Caller receives response from the target peer
    socket.on('call-response-received', async ({ accepted }: { accepted: boolean }) => {
      if (!accepted) {
        alert('Call request declined or busy.');
        closeConnection();
        return;
      }

      setCallStatus('connecting');
      const stream = localStreamRef.current;
      if (!stream || !callType) return;

      const pc = initPeerConnection(callType, stream);

      // Create Offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-signal', { sdp: offer });
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
        closeConnection();
      }
    });

    interface WebRTCSignalData {
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    }

    // Handle SDP Offers/Answers and ICE candidates
    socket.on('webrtc-signal-received', async (data: WebRTCSignalData) => {
      try {
        const pc = peerConnectionRef.current;
        if (!pc) return;

        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          // If receiving an offer, create an answer
          if (data.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-signal', { sdp: answer });
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('Error handling signaling signal:', err);
      }
    });

    // Remote peer ended call
    socket.on('call-ended', () => {
      console.log('Call ended by remote peer');
      closeConnection();
    });

    return () => {
      socket.off('call-request-received');
      socket.off('call-response-received');
      socket.off('webrtc-signal-received');
      socket.off('call-ended');
    };
  }, [socket, callStatus, callType, initPeerConnection, closeConnection]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current && callType === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  }, [callType]);

  return {
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
  };
}
