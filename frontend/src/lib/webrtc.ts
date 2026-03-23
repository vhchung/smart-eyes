import { api } from './api';

export interface WebRTCConnection {
  peerConnection: RTCPeerConnection;
  cameraId: string;
  onTrack: (track: MediaStreamTrack) => void;
  onError: (error: Error) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export async function createWebRTCConnection(
  cameraId: string,
  onTrack: (track: MediaStreamTrack) => void,
  onError: (error: Error) => void
): Promise<WebRTCConnection | null> {
  const peerConnection = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    iceTransportPolicy: 'all',
  });

  let connection: WebRTCConnection | null = null;
  connection = { peerConnection, cameraId, onTrack, onError };

  peerConnection.ontrack = (event) => {
    const [track] = event.streams[0].getVideoTracks();
    if (track && connection) {
      connection.onTrack(track);
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state for ${cameraId}:`, peerConnection.iceConnectionState);
    if (
      peerConnection.iceConnectionState === 'failed' ||
      peerConnection.iceConnectionState === 'disconnected'
    ) {
      if (connection) {
        connection.onError(new Error(`ICE connection ${peerConnection.iceConnectionState}`));
      }
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`ICE candidate for ${cameraId}:`, event.candidate);
    }
  };

  peerConnection.onerror = (event) => {
    console.error(`WebRTC error for ${cameraId}:`, event);
    if (connection) {
      connection.onError(new Error(`WebRTC error: ${event}`));
    }
  };

  try {
    // Get SDP offer from backend
    const { camera_id, offer } = await api.streaming.getWebRTC(cameraId);
    console.log(`Received offer for ${camera_id}, SDP length:`, offer.length);

    // Set remote description (offer from server)
    await peerConnection.setRemoteDescription({
      type: 'offer',
      sdp: offer,
    });
    console.log(`Set remote description for ${cameraId}`);

    // Create answer
    const answer = await peerConnection.createAnswer();
    console.log(`Created answer for ${cameraId}`);
    await peerConnection.setLocalDescription(answer);
    console.log(`Set local description for ${cameraId}`);

    // Submit answer to backend
    const result = await api.streaming.submitAnswer(camera_id, answer.sdp || '');
    console.log(`Submit answer result for ${camera_id}:`, result);

    return connection;
  } catch (error) {
    console.error(`Error creating WebRTC connection for ${cameraId}:`, error);
    onError(error instanceof Error ? error : new Error(String(error)));
    closeWebRTCConnection(connection);
    return null;
  }
}

export function closeWebRTCConnection(connection: WebRTCConnection | null): void {
  if (!connection) return;

  const { peerConnection, cameraId } = connection;

  // Close the peer connection
  peerConnection.close();

  // Notify backend to close the connection
  api.streaming.closeConnection(cameraId).catch(console.error);
}

export function createMediaStream(track: MediaStreamTrack): MediaStream {
  const stream = new MediaStream();
  stream.addTrack(track);
  return stream;
}
