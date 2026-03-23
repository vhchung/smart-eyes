"""
WebRTC service for RTSP to WebRTC streaming using aiortc and PyAV.
"""
import asyncio
import logging
from typing import Optional

import av

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class CameraStreamTrack:
    """Video track that produces frames from an RTSP stream using PyAV."""

    def __init__(self, rtsp_url: str, username: Optional[str] = None, password: Optional[str] = None):
        self.rtsp_url = rtsp_url
        self.username = username
        self.password = password
        self._container: Optional[av.container.InputContainer] = None
        self._stream: Optional[av.stream.Stream] = None
        self._task: Optional[asyncio.Task] = None
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=2)
        self._running = False

    async def _read_frames(self):
        """Read frames from the RTSP stream using PyAV."""
        try:
            # Build RTSP URL with credentials if provided
            stream_url = self.rtsp_url
            if self.username and self.password:
                # Insert credentials into RTSP URL
                if self.rtsp_url.startswith('rtsp://'):
                    stream_url = self.rtsp_url.replace(
                        'rtsp://',
                        f'rtsp://{self.username}:{self.password}@'
                    )

            self._container = av.open(stream_url, format='rtsp', options={
                'rtsp_transport': 'tcp',
                'threads': '2',
                'ffmpeg_global_options': '-threads 2',
            })
            self._stream = self._container.streams.video[0]

            logger.info(f"Connected to RTSP stream: {self.rtsp_url}")
            self._running = True

            while self._running:
                try:
                    for packet in self._container.demux(self._stream):
                        for frame in packet.decode():
                            if frame:
                                try:
                                    self._queue.put_nowait(frame)
                                except asyncio.QueueFull:
                                    pass
                        await asyncio.sleep(0)
                except av.error.InvalidDataError as e:
                    logger.warning(f"Invalid data error, retrying: {e}")
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Error reading from RTSP stream: {e}")
                    break

        except Exception as e:
            logger.error(f"Failed to open RTSP stream: {e}")
        finally:
            self._running = False
            if self._container:
                self._container.close()
                self._container = None

    async def start(self):
        """Start the RTSP stream reader."""
        self._task = asyncio.create_task(self._read_frames())

    async def stop(self):
        """Stop the RTSP stream reader."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._container:
            self._container.close()
            self._container = None

    async def recv(self, frame):
        """Receive the next video frame."""
        try:
            return self._queue.get_nowait()
        except asyncio.QueueEmpty:
            return frame


class WebRTCService:
    """Service to manage WebRTC peer connections for camera streams."""

    def __init__(self):
        self._connections: dict = {}
        self._tracks: dict[str, CameraStreamTrack] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._rtsp_urls: dict[str, tuple[str, Optional[str], Optional[str]]] = {}

    def _get_lock(self, camera_id: str) -> asyncio.Lock:
        """Get or create a lock for a camera."""
        if camera_id not in self._locks:
            self._locks[camera_id] = asyncio.Lock()
        return self._locks[camera_id]

    def add_camera(self, camera_id: str, rtsp_url: str, username: Optional[str] = None, password: Optional[str] = None):
        """Add a camera and prepare its RTSP stream."""
        self._rtsp_urls[camera_id] = (rtsp_url, username, password)
        logger.info(f"Camera {camera_id} added to WebRTC service with URL: {rtsp_url}")

    def remove_camera(self, camera_id: str):
        """Remove a camera and close its peer connection."""
        if camera_id in self._rtsp_urls:
            del self._rtsp_urls[camera_id]

        if camera_id in self._tracks:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self._tracks[camera_id].stop())
                else:
                    loop.run_until_complete(self._tracks[camera_id].stop())
            except Exception as e:
                logger.error(f"Error stopping track for camera {camera_id}: {e}")
            finally:
                del self._tracks[camera_id]

        if camera_id in self._connections:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self._connections[camera_id].close())
                else:
                    loop.run_until_complete(self._connections[camera_id].close())
            except Exception as e:
                logger.error(f"Error closing connection for camera {camera_id}: {e}")
            finally:
                del self._connections[camera_id]

        logger.info(f"Camera {camera_id} removed from WebRTC service")

    async def _cleanup_camera(self, camera_id: str):
        """Clean up resources for a camera."""
        lock = self._get_lock(camera_id)
        async with lock:
            if camera_id in self._tracks:
                await self._tracks[camera_id].stop()
                del self._tracks[camera_id]

            if camera_id in self._connections:
                await self._connections[camera_id].close()
                del self._connections[camera_id]

    async def create_offer(self, camera_id: str) -> tuple[str, str]:
        """
        Create a WebRTC offer for a camera.
        Returns (offer_sdp, camera_id).
        """
        from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack

        logger.debug(f"create_offer called for camera_id={camera_id}")

        # Create a track that can be used with aiortc
        class AioRTCTrack(VideoStreamTrack):
            def __init__(self, camera_track: CameraStreamTrack):
                super().__init__()
                self.camera_track = camera_track

            async def recv(self, frame):
                return await self.camera_track.recv(frame)

        lock = self._get_lock(camera_id)
        async with lock:
            logger.debug(f"Lock acquired for camera_id={camera_id}")
            if camera_id not in self._rtsp_urls:
                logger.error(f"Camera {camera_id} not found in _rtsp_urls. Available: {list(self._rtsp_urls.keys())}")
                raise ValueError(f"Camera {camera_id} not found in WebRTC service")

            # Clean up existing connection if any
            if camera_id in self._connections:
                try:
                    await self._connections[camera_id].close()
                except Exception:
                    pass
                del self._connections[camera_id]

            rtsp_url, username, password = self._rtsp_urls[camera_id]
            logger.debug(f"Camera {camera_id} RTSP URL: {rtsp_url}")

            # Create peer connection with ICE servers configuration
            from aiortc.rtcconfiguration import RTCConfiguration, RTCIceServer
            ice_servers = [
                RTCIceServer(urls="stun:stun.l.google.com:19302"),
                RTCIceServer(urls="stun:stun1.l.google.com:19302"),
            ]
            config = RTCConfiguration(iceServers=ice_servers)
            logger.debug(f"Creating RTCPeerConnection for camera {camera_id}")
            pc = RTCPeerConnection(config)
            self._connections[camera_id] = pc
            logger.debug(f"RTCPeerConnection created for camera {camera_id}")

            # Create and start camera track
            logger.debug(f"Creating CameraStreamTrack for camera {camera_id}")
            track = CameraStreamTrack(rtsp_url, username, password)
            await track.start()
            self._tracks[camera_id] = track
            logger.debug(f"CameraStreamTrack started for camera {camera_id}")

            # Wrap with aiortc VideoStreamTrack
            aiortc_track = AioRTCTrack(track)

            # Add track to peer connection
            logger.debug(f"Adding track to peer connection for camera {camera_id}")
            pc.addTrack(aiortc_track)

            # Create offer
            logger.debug(f"Creating offer for camera {camera_id}")
            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            logger.debug(f"Offer created and setLocalDescription for camera {camera_id}")
            logger.info(f"PC signaling state after setLocalDescription: {pc.signalingState}")

            offer_sdp = pc.localDescription.sdp
            logger.info(f"Created WebRTC offer for camera {camera_id}, SDP length={len(offer_sdp)}")

            return offer_sdp, camera_id

    async def handle_answer(self, camera_id: str, answer_sdp: str):
        """Handle the answer SDP from the client."""
        from aiortc import RTCSessionDescription

        lock = self._get_lock(camera_id)
        async with lock:
            if camera_id not in self._connections:
                logger.warning(f"handle_answer: No peer connection found for camera {camera_id}, ignoring answer")
                # Connection might have been closed already, just ignore
                return {"status": "ignored", "reason": "no_connection"}

            pc = self._connections[camera_id]
            current_state = pc.signalingState
            logger.info(f"handle_answer: signaling state before: {current_state}")

            # If state is already stable, the answer was already processed
            if current_state == "stable":
                logger.warning(f"handle_answer: signaling state already 'stable' for camera {camera_id}, ignoring duplicate answer")
                return {"status": "ignored", "reason": "already_stable"}

            answer = RTCSessionDescription(sdp=answer_sdp, type="answer")
            await pc.setRemoteDescription(answer)
            logger.info(f"Set remote description (answer) for camera {camera_id}, new state: {pc.signalingState}")

    async def _wait_for_ice_gathering(self, pc, timeout: float = 5.0):
        """Wait for ICE gathering to complete."""
        try:
            # In newer aiortc versions, we wait for ICE gathering state to be 'complete'
            start = asyncio.get_event_loop().time()
            while pc.iceGatheringState != 'complete':
                if asyncio.get_event_loop().time() - start > timeout:
                    logger.warning("ICE gathering timed out, continuing anyway")
                    break
                await asyncio.sleep(0.1)
        except Exception as e:
            logger.warning(f"Error waiting for ICE gathering: {e}")

    def get_active_cameras(self) -> list[str]:
        """Get list of active camera IDs."""
        return list(self._connections.keys())

    def is_camera_active(self, camera_id: str) -> bool:
        """Check if a camera has an active connection."""
        return camera_id in self._connections and self._connections[camera_id].connected

    async def close_camera(self, camera_id: str):
        """Close the peer connection for a camera."""
        await self._cleanup_camera(camera_id)
        logger.info(f"Closed WebRTC connection for camera {camera_id}")

    async def close_all(self):
        """Close all peer connections."""
        for camera_id in list(self._connections.keys()):
            await self._cleanup_camera(camera_id)
        logger.info("Closed all WebRTC connections")


# Global WebRTC service instance
webrtc_service = WebRTCService()
