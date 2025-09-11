
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
  const recordedChunksRef = useRef<Blob[]>([]);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  const initializeRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
          volume: 1.0
        }
      });

      streamRef.current = stream;

      const mimeTypes = [
        'audio/wav',
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
        audioBitsPerSecond: 128000
      });

      // Single ondataavailable handler that stores chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log(`Recorded chunk: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('Recording started with settings:', {
          mimeType: selectedMimeType,
          audioBitsPerSecond: 128000
        });
        setIsRecording(true);
        setAudioChunks([]);
        recordedChunksRef.current = []; // Clear previous recordings
        setError(null);
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, processing complete audio...');
        setIsRecording(false);

        // Combine all recorded chunks into one complete audio file
        if (recordedChunksRef.current.length > 0) {
          const completeBlob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
          
          console.log(`Complete recording: ${completeBlob.size} bytes`);
          
          // Create single large chunk for processing
          const chunk: AudioChunk = {
            data: completeBlob,
            timestamp: Date.now(),
            index: 0,
            size: completeBlob.size
          };
          
          setAudioChunks([chunk]);
        } else {
          console.warn('No audio data recorded');
          setError('No audio data was recorded. Please check microphone permissions.');
        }
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

  const startRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) {
      const initialized = await initializeRecorder();
      if (!initialized) return;
    }

    try {
      // Start recording - will collect data until stop is called
      mediaRecorderRef.current?.start(1000); // Collect data every 1 second but don't process yet
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
      const chunk = audioChunks[0];
      
      if (chunk.size < 1000) {
        throw new Error('Audio file too small. Please record for longer duration.');
      }

      console.log(`Processing audio chunk: ${chunk.size} bytes`);

      const formData = new FormData();
      formData.append('files', chunk.data, 'complete_recording.webm');

      console.log('Sending complete recording to backend...');

      const response = await fetch(`${BACKEND_URL}/live-speech-to-text/live-chunks`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || 'Unknown error' };
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.detail || 'Request failed'}`);
      }

      const result: TranscriptionResult = await response.json();
      console.log('Backend response:', result);

      if (!result.transcript || result.transcript.trim() === '') {
        console.warn('Empty transcript received from backend');
        setError('No speech was detected in the recording. Please try recording again and speak clearly.');
      } else {
        setTranscription(result);
      }

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
    recordedChunksRef.current = [];
    setIsRecording(false);
    setAudioChunks([]);
    setTranscription(null);
    setError(null);
  }, []);

  // Test microphone access
  const testMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      alert('Microphone access granted! You can now start recording.');
    } catch (error) {
      console.error('Microphone test failed:', error);
      setError(`Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Live Audio Transcription</h1>
      
      {/* Recording Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recording Controls</h2>
        
        <div className="flex gap-4 mb-4">
          <button
            onClick={testMicrophone}
            disabled={isRecording || isProcessing}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Test Microphone
          </button>
          
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

        {/* Recording Status */}
        {isRecording && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-green-700 font-medium">Recording in progress... Speak clearly into your microphone</span>
            </div>
          </div>
        )}

        {/* Audio Chunks Info */}
        {audioChunks.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-700 mb-2">
              Recorded Audio: {audioChunks.length} file
              (Total: {(audioChunks.reduce((sum, chunk) => sum + chunk.size, 0) / 1024).toFixed(1)} KB)
            </h3>
            <div className="flex flex-wrap gap-2">
              {audioChunks.map((chunk, index) => (
                <button
                  key={chunk.index}
                  onClick={() => testSingleChunk(index)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                  title={`Test recording (${(chunk.size / 1024).toFixed(1)} KB)`}
                >
                  Test Audio
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Click "Process Audio" to transcribe and generate meeting minutes
            </p>
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
            <p className="ml-3 text-blue-700">Processing audio and generating transcript...</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium text-yellow-800 mb-2">How to Use</h3>
        <ol className="list-decimal list-inside text-yellow-700 space-y-1">
          <li>Click "Test Microphone" to ensure audio access</li>
          <li>Click "Start Recording" and speak your meeting content</li>
          <li>Speak clearly and loudly for at least 10-15 seconds</li>
          <li>Click "Stop Recording" when finished</li>
          <li>Click "Process Audio" to generate transcript and meeting minutes</li>
        </ol>
      </div>

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
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
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
                <p className="text-gray-700 whitespace-pre-wrap">{transcription.mom.summary.detailed}</p>
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