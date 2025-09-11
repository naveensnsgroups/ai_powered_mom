
'use client';

import React, { useState, useRef, useCallback } from 'react';

interface AudioChunk {
  data: Blob;
  timestamp: number;
  index: number;
  size: number;
}

interface TranscriptionResult {
  transcript: string;
  mom: {
    summary: {
      overview: string;
      detailed: string;
    };
    action_items: Array<{
      task: string;
      assigned_to: string;
      deadline: string;
    }>;
    decisions: Array<{
      decision: string;
      participant: string;
    }>;
  };
  processing_info?: {
    total_files: number;
    successful_files: number;
    processing_time: number;
    transcription_time: number;
  };
}

interface SingleTranscriptionResult {
  transcript: string;
  audio_info: {
    duration: number;
    sample_rate: number;
    samples: number;
    max_amplitude: number;
  };
}

export default function LiveTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // Update the initializeRecorder function in your TSX component

const initializeRecorder = useCallback(async () => {
  try {
    // Request higher quality audio settings
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 44100, // Higher sample rate initially
        sampleSize: 16,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        volume: 1.0 // Maximum volume
      }
    });

    streamRef.current = stream;

    // Prefer WAV or higher quality formats
    const mimeTypes = [
      'audio/wav',
      'audio/webm;codecs=pcm',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus'
    ];

    let selectedMimeType = null;
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        console.log(`Using MIME type: ${mimeType}`);
        break;
      }
    }

    if (!selectedMimeType) {
      throw new Error('No supported audio MIME type found');
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType,
      audioBitsPerSecond: 128000 // Higher bitrate for better quality
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 1000) { // Increased minimum size
        const chunk: AudioChunk = {
          data: event.data,
          timestamp: Date.now(),
          index: chunkIndexRef.current++,
          size: event.data.size
        };
        
        setAudioChunks(prev => [...prev, chunk]);
        console.log(`Audio chunk ${chunk.index}: ${chunk.size} bytes (${selectedMimeType})`);
        
        // Log audio analysis
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result instanceof ArrayBuffer) {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContext.decodeAudioData(e.target.result.slice(0))
              .then(audioBuffer => {
                const channelData = audioBuffer.getChannelData(0);
                const maxAmplitude = Math.max(...channelData.map(Math.abs));
                const rms = Math.sqrt(channelData.reduce((sum, val) => sum + val * val, 0) / channelData.length);
                console.log(`Chunk ${chunk.index} - Duration: ${audioBuffer.duration.toFixed(2)}s, Max: ${maxAmplitude.toFixed(4)}, RMS: ${rms.toFixed(4)}`);
                
                if (maxAmplitude < 0.01) {
                  console.warn(`Chunk ${chunk.index} is very quiet - check microphone levels`);
                }
              })
              .catch(err => console.log('Could not analyze audio:', err));
          }
        };
        reader.readAsArrayBuffer(event.data);
      } else {
        console.warn(`Skipping tiny chunk: ${event.data?.size || 0} bytes`);
      }
    };

    // Rest of the recorder setup remains the same...
    mediaRecorder.onstart = () => {
      console.log('Recording started with settings:', {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000,
        chunkDuration: '5000ms'
      });
      setIsRecording(true);
      setAudioChunks([]);
      chunkIndexRef.current = 0;
      setError(null);
    };

    mediaRecorder.onstop = () => {
      console.log('Recording stopped');
      setIsRecording(false);
    };

    mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      setError('Recording error occurred');
    };

    mediaRecorderRef.current = mediaRecorder;
    return true;

  } catch (error) {
    console.error('Failed to initialize recorder:', error);
    setError(`Failed to initialize recorder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}, []);

  // Update the startRecording function
const startRecording = useCallback(async () => {
  if (!mediaRecorderRef.current) {
    const initialized = await initializeRecorder();
    if (!initialized) return;
  }

  try {
    // Use 5-second chunks for better audio quality
    mediaRecorderRef.current?.start(5000);
  } catch (error) {
    console.error('Failed to start recording:', error);
    setError('Failed to start recording');
  }
}, [initializeRecorder]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const processAudioChunks = useCallback(async () => {
    if (audioChunks.length === 0) {
      setError('No audio chunks to process');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      
      audioChunks.forEach((chunk) => {
        const filename = `chunk_${chunk.index}.webm`;
        formData.append('files', chunk.data, filename);
      });

      console.log(`Sending ${audioChunks.length} chunks to backend...`);

      const response = await fetch(`${BACKEND_URL}/live-speech-to-text/live-chunks`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || 'Request failed'}`);
      }

      const result: TranscriptionResult = await response.json();
      console.log('Backend response:', result);

      setTranscription(result);
      setAudioChunks([]); // Clear chunks after successful processing

    } catch (error) {
      console.error('Failed to process audio chunks:', error);
      setError(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [audioChunks, BACKEND_URL]);

  const testSingleChunk = useCallback(async (chunkIndex: number) => {
    const chunk = audioChunks[chunkIndex];
    if (!chunk) return;

    try {
      const formData = new FormData();
      formData.append('file', chunk.data, `test_chunk_${chunk.index}.webm`);

      const response = await fetch(`${BACKEND_URL}/live-speech-to-text/live-single`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`HTTP ${response.status}: ${errorData.detail}`);
      }

      const result: SingleTranscriptionResult = await response.json();
      console.log(`Single chunk ${chunkIndex} result:`, result);
      
      // Show result in alert for testing
      alert(`Chunk ${chunkIndex} transcript: "${result.transcript}"\nDuration: ${result.audio_info.duration.toFixed(2)}s`);

    } catch (error) {
      console.error(`Failed to test chunk ${chunkIndex}:`, error);
      alert(`Failed to test chunk ${chunkIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [audioChunks, BACKEND_URL]);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setAudioChunks([]);
    setTranscription(null);
    setError(null);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Live Audio Transcription</h1>
      
      {/* Recording Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recording Controls</h2>
        
        <div className="flex gap-4 mb-4">
          <button
            onClick={startRecording}
            disabled={isRecording || isProcessing}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isRecording ? 'Recording...' : 'Start Recording'}
          </button>
          
          <button
            onClick={stopRecording}
            disabled={!isRecording || isProcessing}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Stop Recording
          </button>
          
          <button
            onClick={processAudioChunks}
            disabled={isRecording || isProcessing || audioChunks.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Process Audio'}
          </button>
          
          <button
            onClick={cleanup}
            disabled={isRecording || isProcessing}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>

        {/* Audio Chunks Info */}
        {audioChunks.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-700 mb-2">
              Audio Chunks: {audioChunks.length} 
              (Total: {(audioChunks.reduce((sum, chunk) => sum + chunk.size, 0) / 1024).toFixed(1)} KB)
            </h3>
            <div className="flex flex-wrap gap-2">
              {audioChunks.slice(0, 10).map((chunk, index) => (
                <button
                  key={chunk.index}
                  onClick={() => testSingleChunk(index)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                  title={`Test chunk ${chunk.index} (${(chunk.size / 1024).toFixed(1)} KB)`}
                >
                  Chunk {chunk.index}
                </button>
              ))}
              {audioChunks.length > 10 && (
                <span className="px-3 py-1 text-sm text-gray-500">
                  +{audioChunks.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="text-red-400">⚠</div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-blue-700">Processing audio chunks...</p>
          </div>
        </div>
      )}

      {/* Transcription Results */}
      {transcription && (
        <div className="space-y-6">
          {/* Processing Info */}
          {transcription.processing_info && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Files Processed:</span>
                  <br />
                  {transcription.processing_info.successful_files}/{transcription.processing_info.total_files}
                </div>
                <div>
                  <span className="font-medium">Processing Time:</span>
                  <br />
                  {transcription.processing_info.processing_time?.toFixed(2)}s
                </div>
                <div>
                  <span className="font-medium">Transcription Time:</span>
                  <br />
                  {transcription.processing_info.transcription_time?.toFixed(2)}s
                </div>
              </div>
            </div>
          )}

          {/* Transcript */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Transcript</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed">
                {transcription.transcript || 'No transcript available'}
              </p>
            </div>
          </div>

          {/* Minutes of Meeting */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Minutes of Meeting</h3>
            
            {/* Summary */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-700 mb-2">Summary</h4>
              <div className="bg-blue-50 rounded-lg p-4 mb-3">
                <h5 className="font-medium text-blue-900 mb-2">Overview</h5>
                <p className="text-blue-800">{transcription.mom.summary.overview}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-2">Detailed Notes</h5>
                <p className="text-gray-700">{transcription.mom.summary.detailed}</p>
              </div>
            </div>

            {/* Action Items */}
            {transcription.mom.action_items.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-700 mb-3">Action Items</h4>
                <div className="space-y-3">
                  {transcription.mom.action_items.map((item, index) => (
                    <div key={index} className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <p className="font-medium text-yellow-900">{item.task}</p>
                      {item.assigned_to && (
                        <p className="text-sm text-yellow-700 mt-1">
                          Assigned to: {item.assigned_to}
                        </p>
                      )}
                      {item.deadline && item.deadline !== 'N/A' && (
                        <p className="text-sm text-yellow-700 mt-1">
                          Deadline: {item.deadline}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decisions */}
            {transcription.mom.decisions.length > 0 && (
              <div>
                <h4 className="text-lg font-medium text-gray-700 mb-3">Decisions</h4>
                <div className="space-y-3">
                  {transcription.mom.decisions.map((decision, index) => (
                    <div key={index} className="bg-green-50 border-l-4 border-green-400 p-4">
                      <p className="font-medium text-green-900">{decision.decision}</p>
                      {decision.participant && (
                        <p className="text-sm text-green-700 mt-1">
                          Responsible: {decision.participant}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transcription.mom.action_items.length === 0 && transcription.mom.decisions.length === 0 && (
              <p className="text-gray-500 italic">No action items or decisions identified.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}