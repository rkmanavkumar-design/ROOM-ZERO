'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseWebRTCOptions {
  socket: Socket | null;
  roomId: string;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

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
  // Use a ref for callType so socket event closures always see the latest value
  const callTypeRef = useRef<'voice' | 'video' | null>(null);
  const callStatusRef = useRef<'idle' | 'offering' | 'receiving' | 'connecting' | 'active'>('idle');

  // Keep refs in sync with state
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);

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
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  }, []);

  // Initialize RTCPeerConnection
  const initPeerConnection = useCallback((stream: MediaStream) => {
    // Close any existing connection first
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-signal', { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('PeerConnection state:', pc.connectionState);
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, event.streams[0]);
      setRemoteStream(event.streams[0]);
      setCallStatus('active');
    };

    // Add all local tracks to PeerConnection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    peerConnectionRef.current = pc;
    return pc;
  }, [socket]);

  // Request Call
  const startCall = useCallback(async (type: 'voice' | 'video') => {
    if (!socket) return;
    try {
      setCallStatus('offering');
      setCallType(type);
      callTypeRef.current = type;

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
      callTypeRef.current = type;

      const constraints = {
        audio: true,
        video: type === 'video' ? { facingMode: 'user' } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Initialize connection on acceptor side (waits for offer from caller)
      initPeerConnection(stream);

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

  // Socket signaling listeners — registered ONCE, use refs for live values
  useEffect(() => {
    if (!socket) return;

    // Incoming Call request
    const onCallRequestReceived = ({ senderId, type }: { senderId: string; type: 'voice' | 'video' }) => {
      console.log(`Received call request from ${senderId}`);
      if (callStatusRef.current !== 'idle') {
        socket.emit('call-response', { accepted: false });
        return;
      }
      setIncomingCallRequest({ senderId, type });
      setCallStatus('receiving');
    };

    // Caller receives response from the target peer
    const onCallResponseReceived = async ({ accepted }: { accepted: boolean }) => {
      if (!accepted) {
        alert('Call request declined or busy.');
        closeConnection();
        return;
      }

      setCallStatus('connecting');
      const stream = localStreamRef.current;
      const type = callTypeRef.current; // ✅ use ref, not stale closure

      if (!stream || !type) {
        console.error('No local stream or call type when response received');
        closeConnection();
        return;
      }

      const pc = initPeerConnection(stream);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-signal', { sdp: offer });
        console.log('Offer sent to peer');
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
        closeConnection();
      }
    };

    interface WebRTCSignalData {
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    }

    // Handle SDP Offers/Answers and ICE candidates
    const onWebRTCSignal = async (data: WebRTCSignalData) => {
      try {
        const pc = peerConnectionRef.current;
        if (!pc) {
          console.warn('Received webrtc-signal but no peer connection exists');
          return;
        }

        if (data.sdp) {
          console.log('Received SDP:', data.sdp.type);
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-signal', { sdp: answer });
            console.log('Answer sent to peer');
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('Error handling webrtc signal:', err);
      }
    };

    // Remote peer ended call
    const onCallEnded = () => {
      console.log('Call ended by remote peer');
      closeConnection();
    };

    socket.on('call-request-received', onCallRequestReceived);
    socket.on('call-response-received', onCallResponseReceived);
    socket.on('webrtc-signal-received', onWebRTCSignal);
    socket.on('call-ended', onCallEnded);

    return () => {
      socket.off('call-request-received', onCallRequestReceived);
      socket.off('call-response-received', onCallResponseReceived);
      socket.off('webrtc-signal-received', onWebRTCSignal);
      socket.off('call-ended', onCallEnded);
    };
  }, [socket, initPeerConnection, closeConnection]); // ✅ No callType/callStatus in deps — use refs instead

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
    if (localStreamRef.current && callTypeRef.current === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  }, []);

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
