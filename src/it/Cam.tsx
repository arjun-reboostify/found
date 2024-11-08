import React, { useEffect, useRef, useState } from 'react';
import { 
  Camera, XCircle, Download, Trash, Video, Mic, 
  Settings, Image as ImageIcon, Sparkles, Layout, 
  Maximize2, Volume2, VolumeX, RefreshCcw, Pause,
  Play, Square, Sliders, SunMoon, Layers, Save
} from 'lucide-react';

interface CapturedMedia {
  id: string;
  type: 'image' | 'video' | 'audio';
  data: string;
  timestamp: string;
  duration?: number;
  thumbnail?: string;
}

interface FilterOption {
  name: string;
  class: string;
}

const MediaCaptureSuite = () => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // State for media handling
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [error, setError] = useState<string>('');
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<CapturedMedia | null>(null);
  
  // UI States
  const [selectedTab, setSelectedTab] = useState<'photo' | 'video' | 'audio'>('photo');
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Camera Settings
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [resolution, setResolution] = useState({ width: 1920, height: 1080 });
  const [frameRate, setFrameRate] = useState(30);
  
  // Effects and Filters
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const filters: FilterOption[] = [
    { name: 'Normal', class: '' },
    { name: 'Grayscale', class: 'grayscale' },
    { name: 'Sepia', class: 'sepia' },
    { name: 'Invert', class: 'invert' },
    { name: 'Blur', class: 'blur-sm' },
    { name: 'Vintage', class: 'sepia brightness-75' },
    { name: 'Cold', class: 'brightness-110 hue-rotate-180' },
    { name: 'Warm', class: 'brightness-110 hue-rotate-30' },
  ];

  // Device enumeration
  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
    }
  };

  // Start media stream
  const startStream = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedTab !== 'audio' ? {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          width: { ideal: resolution.width },
          height: { ideal: resolution.height },
          frameRate: { ideal: frameRate }
        } : false,
        audio: selectedTab !== 'photo'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current && !isAudioOnly) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
      setError('');
    } catch (err) {
      setError('Failed to access media devices. Please check permissions.');
      console.error('Error accessing media devices:', err);
    }
  };

  // Stop media stream
  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsRecording(false);
  };

  // Capture photo
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Apply custom filters using canvas operations
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/png');
        
        const newMedia: CapturedMedia = {
          id: Date.now().toString(),
          type: 'image',
          data: imageData,
          timestamp: new Date().toLocaleString()
        };
        
        saveToStorage(newMedia);
      }
    }
  };

  // Start recording (video or audio)
  const startRecording = () => {
    if (videoRef.current?.srcObject) {
      chunksRef.current = [];
      const stream = videoRef.current.srcObject as MediaStream;
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      
      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
      } catch (e) {
        mediaRecorderRef.current = new MediaRecorder(stream);
      }

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const newMedia: CapturedMedia = {
            id: Date.now().toString(),
            type: isAudioOnly ? 'audio' : 'video',
            data: reader.result as string,
            timestamp: new Date().toLocaleString(),
            duration: 0 // You would calculate actual duration here
          };
          saveToStorage(newMedia);
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Save to localStorage
  const saveToStorage = (newMedia: CapturedMedia) => {
    setCapturedMedia(prev => {
      const updated = [newMedia, ...prev];
      localStorage.setItem('capturedMedia', JSON.stringify(updated));
      return updated;
    });
  };

  // Delete media
  const deleteMedia = (id: string) => {
    setCapturedMedia(prev => {
      const updated = prev.filter(media => media.id !== id);
      localStorage.setItem('capturedMedia', JSON.stringify(updated));
      return updated;
    });
    setSelectedMedia(null);
  };

  // Download media
  const downloadMedia = (media: CapturedMedia) => {
    const link = document.createElement('a');
    link.href = media.data;
    link.download = `capture-${media.type}-${Date.now()}.${
      media.type === 'image' ? 'png' : media.type === 'video' ? 'webm' : 'wav'
    }`;
    link.click();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Effects
  useEffect(() => {
    enumerateDevices();
    const savedMedia = localStorage.getItem('capturedMedia');
    if (savedMedia) {
      setCapturedMedia(JSON.parse(savedMedia));
    }

    return () => {
      stopStream();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 p-6">
      {/* Main Control Bar */}
      <div className="flex justify-between items-center mb-6 bg-white rounded-lg p-4 shadow-lg">
        <div className="flex space-x-4">
          <button
            onClick={() => setSelectedTab('photo')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              selectedTab === 'photo' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            <Camera size={20} />
            <span>Photo</span>
          </button>
          <button
            onClick={() => setSelectedTab('video')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              selectedTab === 'video' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            <Video size={20} />
            <span>Video</span>
          </button>
          <button
            onClick={() => setSelectedTab('audio')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              selectedTab === 'audio' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            <Mic size={20} />
            <span>Audio</span>
          </button>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Maximize2 size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 space-x-6">
        {/* Camera/Recording View */}
        <div className="flex-1">
          <div className="relative bg-white rounded-lg shadow-xl overflow-hidden">
            {error && (
              <div className="absolute top-0 left-0 right-0 bg-red-100 p-4 text-red-700 z-10">
                {error}
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              className={`w-full h-full object-cover ${activeFilter}`}
              style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
              }}
            />

            {/* Control Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
              {/* Main Controls */}
              <div className="flex space-x-4">
                {!isStreaming ? (
                  <button
                    onClick={startStream}
                    className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors shadow-lg"
                  >
                    <Play size={20} />
                    <span>Start</span>
                  </button>
                ) : (
                  <>
                    {selectedTab === 'photo' ? (
                      <button
                        onClick={capturePhoto}
                        className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition-colors shadow-lg"
                      >
                        <Camera size={20} />
                        <span>Capture</span>
                      </button>
                    ) : (
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`flex items-center space-x-2 ${
                          isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                        } text-white px-6 py-3 rounded-lg transition-colors shadow-lg`}
                      >
                        {isRecording ? <Square size={20} /> : <Play size={20} />}
                        <span>{isRecording ? 'Stop' : 'Record'}</span>
                      </button>
                    )}
                    <button
                      onClick={stopStream}
                      className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg transition-colors shadow-lg"
                    >
                      <XCircle size={20} />
                      <span>Stop</span>
                    </button>
                  </>
                )}
              </div>

              {/* Filter Controls */}
              <div className="flex items-center space-x-4">
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className="bg-white bg-opacity-80 rounded-lg px-3 py-2"
                >
                  {filters.map((filter) => (
                    <option key={filter.name} value={filter.class}>
                      {filter.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

    {/* Settings Panel (continued) */}
    {showSettings && (
          <div className="w-80 bg-white rounded-lg shadow-lg p-4 space-y-6">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Settings size={20} />
              <span>Settings</span>
            </h3>

            {/* Camera Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Camera Device</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                {availableDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
            </div>

            {/* Resolution Settings */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Resolution</label>
              <select
                value={`${resolution.width}x${resolution.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  setResolution({ width, height });
                }}
                className="w-full p-2 border rounded-lg"
              >
                <option value="3840x2160">4K (3840x2160)</option>
                <option value="1920x1080">Full HD (1920x1080)</option>
                <option value="1280x720">HD (1280x720)</option>
                <option value="854x480">SD (854x480)</option>
              </select>
            </div>

            {/* Frame Rate Settings */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Frame Rate</label>
              <select
                value={frameRate}
                onChange={(e) => setFrameRate(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
              >
                <option value="60">60 fps</option>
                <option value="30">30 fps</option>
                <option value="24">24 fps</option>
              </select>
            </div>

            {/* Image Adjustments */}
            <div className="space-y-4">
              <h4 className="font-medium">Image Adjustments</h4>
              
              <div className="space-y-2">
                <label className="block text-sm">Brightness</label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm">Contrast</label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm">Saturation</label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => {
                setBrightness(100);
                setContrast(100);
                setSaturation(100);
                setActiveFilter('');
              }}
              className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCcw size={16} />
              <span>Reset Adjustments</span>
            </button>
          </div>
        )}

        {/* Media Gallery */}
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-4">Captured Media</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {capturedMedia.map((media) => (
              <div
                key={media.id}
                className="relative group bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                {media.type === 'image' ? (
                  <img
                    src={media.data}
                    alt={`Captured at ${media.timestamp}`}
                    className="w-full h-48 object-cover cursor-pointer"
                    onClick={() => setSelectedMedia(media)}
                  />
                ) : media.type === 'video' ? (
                  <video
                    src={media.data}
                    className="w-full h-48 object-cover cursor-pointer"
                    onClick={() => setSelectedMedia(media)}
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center cursor-pointer"
                       onClick={() => setSelectedMedia(media)}>
                    <Mic size={48} className="text-gray-400" />
                  </div>
                )}

                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                  <button
                    onClick={() => downloadMedia(media)}
                    className="p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
                  >
                    <Download size={20} className="text-white" />
                  </button>
                  <button
                    onClick={() => deleteMedia(media.id)}
                    className="p-2 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <Trash size={20} className="text-white" />
                  </button>
                </div>

                {/* Media Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-sm p-2">
                  <div>{new Date(media.timestamp).toLocaleString()}</div>
                  <div className="flex items-center space-x-1">
                    {media.type === 'image' ? (
                      <ImageIcon size={14} />
                    ) : media.type === 'video' ? (
                      <Video size={14} />
                    ) : (
                      <Mic size={14} />
                    )}
                    <span className="capitalize">{media.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Media Preview Modal */}
        {selectedMedia && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedMedia(null)}
          >
            <div className="max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-lg p-4">
              {selectedMedia.type === 'image' ? (
                <img
                  src={selectedMedia.data}
                  alt="Preview"
                  className="max-w-full h-auto rounded-lg"
                />
              ) : selectedMedia.type === 'video' ? (
                <video
                  src={selectedMedia.data}
                  controls
                  className="max-w-full h-auto rounded-lg"
                />
              ) : (
                <audio
                  src={selectedMedia.data}
                  controls
                  className="w-full"
                />
              )}
              <div className="mt-4 flex justify-end space-x-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadMedia(selectedMedia);
                  }}
                  className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Download size={20} />
                  <span>Download</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMedia(selectedMedia.id);
                  }}
                  className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Trash size={20} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden Canvas for Photo Capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default MediaCaptureSuite;