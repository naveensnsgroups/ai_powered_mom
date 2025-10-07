
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Calendar, Clock, Users, CheckSquare, AlertTriangle, FileText, User, Target, Flag } from 'lucide-react';

interface AudioChunk {
  data: Blob;
  timestamp: number;
  index: number;
  size: number;
}

interface Participant {
  name: string;
  role: string;
  attendance_status: string;
}

interface ActionItem {
  id: number;
  task: string;
  assigned_to: string;
  deadline: string;
  priority: string;
  status: string;
  category: string;
}

interface Decision {
  id: number;
  decision: string;
  rationale: string;
  impact: string;
  responsible_party: string;
  timeline: string;
}

interface RiskBlocker {
  issue: string;
  severity: string;
  owner: string;
}

interface EnhancedTranscriptionResult {
  transcript: string;
  mom: {
    meeting_info: {
      date: string;
      time: string;
      meeting_type: string;
    };
    attendance: {
      participants: Participant[];
      total_participants: number;
    };
    summary: {
      overview: string;
      detailed: string;
      key_topics: string[];
    };
    action_items: ActionItem[];
    decisions: Decision[];
    follow_up: {
      next_meeting: string;
      pending_items: string[];
      required_approvals: string[];
    };
    risks_and_blockers: RiskBlocker[];
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

export default function EnhancedLiveTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<EnhancedTranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [activeTab, setActiveTab] = useState<string>('transcript');
  
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
        recordedChunksRef.current = [];
        setError(null);
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, processing complete audio...');
        setIsRecording(false);

        if (recordedChunksRef.current.length > 0) {
          const completeBlob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
          
          console.log(`Complete recording: ${completeBlob.size} bytes`);
          
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
      mediaRecorderRef.current?.start(1000);
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

      const result: EnhancedTranscriptionResult = await response.json();
      console.log('Backend response:', result);

      if (!result.transcript || result.transcript.trim() === '') {
        console.warn('Empty transcript received from backend');
        setError('No speech was detected in the recording. Please try recording again and speak clearly.');
      } else {
        setTranscription(result);
        setActiveTab('transcript'); // Reset to first tab
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
    setActiveTab('transcript');
  }, []);

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

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderTabNavigation = () => {
    if (!transcription) return null;

    const tabs = [
      { id: 'transcript', label: 'Transcript', icon: FileText },
      { id: 'overview', label: 'Meeting Overview', icon: Calendar },
      { id: 'attendance', label: 'Attendance', icon: Users },
      { id: 'actions', label: 'Action Items', icon: CheckSquare },
      { id: 'decisions', label: 'Decisions', icon: Target },
      { id: 'followup', label: 'Follow-up', icon: Clock },
      { id: 'risks', label: 'Risks & Blockers', icon: AlertTriangle }
    ];

    return (
      <div className="border-b border-gray-200 mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            // Count badges for relevant tabs
            let badge = null;
            if (tab.id === 'attendance' && transcription.mom.attendance.total_participants > 0) {
              badge = transcription.mom.attendance.total_participants;
            } else if (tab.id === 'actions' && transcription.mom.action_items.length > 0) {
              badge = transcription.mom.action_items.length;
            } else if (tab.id === 'decisions' && transcription.mom.decisions.length > 0) {
              badge = transcription.mom.decisions.length;
            } else if (tab.id === 'risks' && transcription.mom.risks_and_blockers.length > 0) {
              badge = transcription.mom.risks_and_blockers.length;
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {badge && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Enhanced Live Meeting Transcription</h1>
      
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
            {isProcessing ? 'Processing...' : 'Generate Meeting Minutes'}
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
              Click "Generate Meeting Minutes" to transcribe and create comprehensive meeting minutes
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <AlertTriangle className="text-red-400 w-5 h-5" />
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
            <p className="ml-3 text-blue-700">Processing audio and generating comprehensive meeting minutes...</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium text-yellow-800 mb-2">Enhanced Features</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-yellow-800">How to Use:</h4>
            <ol className="list-decimal list-inside text-yellow-700 space-y-1 text-sm">
              <li>Test microphone access</li>
              <li>Start recording your meeting</li>
              <li>Speak clearly, mention names and roles</li>
              <li>Stop recording when finished</li>
              <li>Generate comprehensive meeting minutes</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-yellow-800">New Features:</h4>
            <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm">
              <li>Automatic participant detection</li>
              <li>Enhanced action items with priorities</li>
              <li>Decision tracking with rationale</li>
              <li>Risk and blocker identification</li>
              <li>Follow-up planning</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      {renderTabNavigation()}

      {/* Results Display */}
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

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Transcript Tab */}
            {activeTab === 'transcript' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Transcript
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {transcription.transcript || 'No transcript available'}
                  </p>
                </div>
              </div>
            )}

            {/* Meeting Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Meeting Overview
                </h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-3">Meeting Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Date:</span>
                        <span className="text-blue-900 font-medium">{transcription.mom.meeting_info.date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Time/Duration:</span>
                        <span className="text-blue-900 font-medium">{transcription.mom.meeting_info.time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Type:</span>
                        <span className="text-blue-900 font-medium capitalize">{transcription.mom.meeting_info.meeting_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-3">Key Topics</h4>
                    {transcription.mom.summary.key_topics.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {transcription.mom.summary.key_topics.map((topic, index) => (
                          <span key={index} className="bg-green-200 text-green-800 px-2 py-1 rounded text-sm">
                            {topic}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-green-700 text-sm">No key topics identified</p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="bg-blue-50 rounded-lg p-4 mb-3">
                    <h4 className="font-medium text-blue-900 mb-2">Overview</h4>
                    <p className="text-blue-800">{transcription.mom.summary.overview}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Detailed Notes</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{transcription.mom.summary.detailed}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Tab */}
            {activeTab === 'attendance' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Meeting Attendance ({transcription.mom.attendance.total_participants})
                </h3>

                {transcription.mom.attendance.participants.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {transcription.mom.attendance.participants.map((participant, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start gap-3">
                          <User className="w-8 h-8 text-gray-400 mt-1" />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{participant.name}</h4>
                            {participant.role && participant.role !== 'Not specified' && (
                              <p className="text-sm text-gray-600 mt-1">{participant.role}</p>
                            )}
                            <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${
                              participant.attendance_status === 'present' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {participant.attendance_status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No participants identified in the transcript</p>
                    <p className="text-sm text-gray-400 mt-2">Try mentioning names and roles during the meeting</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Items Tab */}
            {activeTab === 'actions' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckSquare className="w-5 h-5" />
                  Action Items ({transcription.mom.action_items.length})
                </h3>

                {transcription.mom.action_items.length > 0 ? (
                  <div className="space-y-4">
                    {transcription.mom.action_items.map((item, index) => (
                      <div key={item.id} className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-600">#{item.id}</span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}>
                                <Flag className="w-3 h-3 inline mr-1" />
                                {item.priority} priority
                              </span>
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 text-xs font-medium rounded-full">
                                {item.category}
                              </span>
                            </div>
                            <p className="font-medium text-yellow-900 mb-2">{item.task}</p>
                            <div className="text-sm text-yellow-700 space-y-1">
                              {item.assigned_to && item.assigned_to !== 'Not specified' && (
                                <p>
                                  <User className="w-4 h-4 inline mr-1" />
                                  Assigned to: <span className="font-medium">{item.assigned_to}</span>
                                </p>
                              )}
                              {item.deadline && item.deadline !== 'N/A' && item.deadline !== 'Not specified' && (
                                <p>
                                  <Calendar className="w-4 h-4 inline mr-1" />
                                  Deadline: <span className="font-medium">{item.deadline}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No action items identified</p>
                    <p className="text-sm text-gray-400 mt-2">Action items will be automatically detected from meeting discussions</p>
                  </div>
                )}
              </div>
            )}

            {/* Decisions Tab */}
            {activeTab === 'decisions' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Decisions ({transcription.mom.decisions.length})
                </h3>

                {transcription.mom.decisions.length > 0 ? (
                  <div className="space-y-4">
                    {transcription.mom.decisions.map((decision, index) => (
                      <div key={decision.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-600">Decision #{decision.id}</span>
                          </div>
                          <h4 className="font-medium text-green-900 text-lg">{decision.decision}</h4>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                          {decision.rationale && (
                            <div className="bg-white rounded p-3">
                              <h5 className="font-medium text-green-800 mb-1">Rationale</h5>
                              <p className="text-green-700 text-sm">{decision.rationale}</p>
                            </div>
                          )}
                          
                          {decision.impact && (
                            <div className="bg-white rounded p-3">
                              <h5 className="font-medium text-green-800 mb-1">Impact</h5>
                              <p className="text-green-700 text-sm">{decision.impact}</p>
                            </div>
                          )}
                          
                          {decision.responsible_party && decision.responsible_party !== 'Not specified' && (
                            <div className="bg-white rounded p-3">
                              <h5 className="font-medium text-green-800 mb-1">Responsible Party</h5>
                              <p className="text-green-700 text-sm">
                                <User className="w-4 h-4 inline mr-1" />
                                {decision.responsible_party}
                              </p>
                            </div>
                          )}
                          
                          {decision.timeline && decision.timeline !== 'Not specified' && (
                            <div className="bg-white rounded p-3">
                              <h5 className="font-medium text-green-800 mb-1">Timeline</h5>
                              <p className="text-green-700 text-sm">
                                <Clock className="w-4 h-4 inline mr-1" />
                                {decision.timeline}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No decisions identified</p>
                    <p className="text-sm text-gray-400 mt-2">Decisions will be automatically detected from meeting discussions</p>
                  </div>
                )}
              </div>
            )}

            {/* Follow-up Tab */}
            {activeTab === 'followup' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Follow-up Planning
                </h3>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-3">Next Meeting</h4>
                    <p className="text-blue-800">
                      {transcription.mom.follow_up.next_meeting !== 'TBD' && transcription.mom.follow_up.next_meeting !== 'Not specified'
                        ? transcription.mom.follow_up.next_meeting
                        : 'To be determined'}
                    </p>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4">
                    <h4 className="font-medium text-orange-900 mb-3">Pending Items ({transcription.mom.follow_up.pending_items.length})</h4>
                    {transcription.mom.follow_up.pending_items.length > 0 ? (
                      <ul className="text-orange-800 text-sm space-y-1">
                        {transcription.mom.follow_up.pending_items.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-orange-600">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-orange-700 text-sm">No pending items</p>
                    )}
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-3">Required Approvals ({transcription.mom.follow_up.required_approvals.length})</h4>
                    {transcription.mom.follow_up.required_approvals.length > 0 ? (
                      <ul className="text-purple-800 text-sm space-y-1">
                        {transcription.mom.follow_up.required_approvals.map((approval, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-purple-600">•</span>
                            {approval}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-purple-700 text-sm">No approvals needed</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Risks & Blockers Tab */}
            {activeTab === 'risks' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Risks & Blockers ({transcription.mom.risks_and_blockers.length})
                </h3>

                {transcription.mom.risks_and_blockers.length > 0 ? (
                  <div className="space-y-4">
                    {transcription.mom.risks_and_blockers.map((risk, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-5 h-5 text-red-500" />
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(risk.severity)}`}>
                                {risk.severity} severity
                              </span>
                            </div>
                            <p className="font-medium text-red-900 mb-2">{risk.issue}</p>
                            {risk.owner && risk.owner !== 'Not specified' && (
                              <p className="text-sm text-red-700">
                                <User className="w-4 h-4 inline mr-1" />
                                Owner: <span className="font-medium">{risk.owner}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No risks or blockers identified</p>
                    <p className="text-sm text-gray-400 mt-2">Risks and blockers will be automatically detected from meeting discussions</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// 'use client';

// import React, { useState, useRef, useCallback } from 'react';
// import { 
//   Calendar, 
//   Clock, 
//   Users, 
//   CheckSquare, 
//   AlertTriangle, 
//   FileText, 
//   User, 
//   Target, 
//   Flag, 
//   Download,
//   Mic,
//   MicOff,
//   Play,
//   Pause,
//   RotateCcw,
//   Volume2,
//   UserCheck,
//   TrendingUp,
//   FileDown
// } from 'lucide-react';

// interface AudioChunk {
//   data: Blob;
//   timestamp: number;
//   index: number;
//   size: number;
// }

// interface Participant {
//   name: string;
//   role: string;
//   attendance_status: string;
// }

// interface ActionItem {
//   id: number;
//   task: string;
//   assigned_to: string;
//   deadline: string;
//   priority: string;
//   status: string;
//   category: string;
// }

// interface Decision {
//   id: number;
//   decision: string;
//   rationale: string;
//   impact: string;
//   responsible_party: string;
//   timeline: string;
// }

// interface RiskBlocker {
//   issue: string;
//   severity: string;
//   owner: string;
// }

// interface EnhancedTranscriptionResult {
//   transcript: string;
//   mom: {
//     meeting_info: {
//       date: string;
//       time: string;
//       meeting_type: string;
//     };
//     attendance: {
//       participants: Participant[];
//       total_participants: number;
//     };
//     summary: {
//       overview: string;
//       detailed: string;
//       key_topics: string[];
//     };
//     action_items: ActionItem[];
//     decisions: Decision[];
//     follow_up: {
//       next_meeting: string;
//       pending_items: string[];
//       required_approvals: string[];
//     };
//     risks_and_blockers: RiskBlocker[];
//   };
//   processing_info?: {
//     total_files: number;
//     successful_files: number;
//     processing_time: number;
//     transcription_time: number;
//     enhanced_features: string[];
//   };
// }

// interface SingleTranscriptionResult {
//   transcript: string;
//   audio_info: {
//     duration: number;
//     sample_rate: number;
//     samples: number;
//     max_amplitude: number;
//     quality_score: number;
//   };
//   processing_info: {
//     file_size_bytes: number;
//     processing_method: string;
//     noise_reduction_applied: boolean;
//   };
// }

// export default function EnhancedLiveTranscription() {
//   const [isRecording, setIsRecording] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [transcription, setTranscription] = useState<EnhancedTranscriptionResult | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
//   const [activeTab, setActiveTab] = useState<string>('transcript');
//   const [recordingDuration, setRecordingDuration] = useState(0);
//   const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf');
//   const [isExporting, setIsExporting] = useState(false);
  
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const recordedChunksRef = useRef<Blob[]>([]);
//   const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

//   const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

//   const initializeRecorder = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           channelCount: 1,
//           sampleRate: 44100,
//           sampleSize: 16,
//           echoCancellation: true,
//           noiseSuppression: false, // Let our backend handle this
//           autoGainControl: true,
//           volume: 1.0
//         }
//       });

//       streamRef.current = stream;

//       const mimeTypes = [
//         'audio/wav',
//         'audio/webm;codecs=opus',
//         'audio/webm',
//         'audio/ogg;codecs=opus'
//       ];

//       let selectedMimeType = null;
//       for (const mimeType of mimeTypes) {
//         if (MediaRecorder.isTypeSupported(mimeType)) {
//           selectedMimeType = mimeType;
//           console.log(`Using MIME type: ${mimeType}`);
//           break;
//         }
//       }

//       if (!selectedMimeType) {
//         throw new Error('No supported audio MIME type found');
//       }

//       const mediaRecorder = new MediaRecorder(stream, {
//         mimeType: selectedMimeType,
//         audioBitsPerSecond: 128000
//       });

//       mediaRecorder.ondataavailable = (event) => {
//         if (event.data && event.data.size > 0) {
//           recordedChunksRef.current.push(event.data);
//           console.log(`Recorded chunk: ${event.data.size} bytes`);
//         }
//       };

//       mediaRecorder.onstart = () => {
//         console.log('Enhanced recording started with speaker detection optimization');
//         setIsRecording(true);
//         setAudioChunks([]);
//         recordedChunksRef.current = [];
//         setError(null);
//         setRecordingDuration(0);
        
//         // Start timer
//         recordingTimerRef.current = setInterval(() => {
//           setRecordingDuration(prev => prev + 1);
//         }, 1000);
//       };

//       mediaRecorder.onstop = () => {
//         console.log('Recording stopped, processing for speaker detection...');
//         setIsRecording(false);
        
//         // Clear timer
//         if (recordingTimerRef.current) {
//           clearInterval(recordingTimerRef.current);
//           recordingTimerRef.current = null;
//         }

//         if (recordedChunksRef.current.length > 0) {
//           const completeBlob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
          
//           console.log(`Complete recording for speaker analysis: ${completeBlob.size} bytes`);
          
//           const chunk: AudioChunk = {
//             data: completeBlob,
//             timestamp: Date.now(),
//             index: 0,
//             size: completeBlob.size
//           };
          
//           setAudioChunks([chunk]);
//         } else {
//           console.warn('No audio data recorded');
//           setError('No audio data was recorded. Please check microphone permissions and speak clearly.');
//         }
//       };

//       mediaRecorder.onerror = (error) => {
//         console.error('MediaRecorder error:', error);
//         setError('Recording error occurred. Please try again.');
//       };

//       mediaRecorderRef.current = mediaRecorder;
//       return true;

//     } catch (error) {
//       console.error('Failed to initialize recorder:', error);
//       setError(`Failed to initialize recorder: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       return false;
//     }
//   }, []);

//   const startRecording = useCallback(async () => {
//     if (!mediaRecorderRef.current) {
//       const initialized = await initializeRecorder();
//       if (!initialized) return;
//     }

//     try {
//       mediaRecorderRef.current?.start(1000);
//     } catch (error) {
//       console.error('Failed to start recording:', error);
//       setError('Failed to start recording');
//     }
//   }, [initializeRecorder]);

//   const stopRecording = useCallback(() => {
//     if (mediaRecorderRef.current && isRecording) {
//       mediaRecorderRef.current.stop();
//     }
//   }, [isRecording]);

//   const processAudioChunks = useCallback(async () => {
//     if (audioChunks.length === 0) {
//       setError('No audio chunks to process');
//       return;
//     }

//     setIsProcessing(true);
//     setError(null);

//     try {
//       const chunk = audioChunks[0];
      
//       if (chunk.size < 2000) {
//         throw new Error('Audio recording too short for speaker detection. Please record for at least 10-15 seconds with clear speech.');
//       }

//       console.log(`Processing audio for comprehensive MoM with speaker detection: ${chunk.size} bytes`);

//       const formData = new FormData();
//       formData.append('files', chunk.data, 'meeting_recording.webm');

//       console.log('Sending recording for enhanced processing with speaker detection...');

//       const response = await fetch(`${BACKEND_URL}/live-speech-to-text/live-chunks`, {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error('Backend error response:', errorText);
        
//         let errorData;
//         try {
//           errorData = JSON.parse(errorText);
//         } catch {
//           errorData = { detail: errorText || 'Unknown error' };
//         }
        
//         throw new Error(`HTTP ${response.status}: ${errorData.detail || 'Request failed'}`);
//       }

//       const result: EnhancedTranscriptionResult = await response.json();
//       console.log('Enhanced backend response with speaker detection:', result);

//       if (!result.transcript || result.transcript.trim() === '') {
//         console.warn('Empty transcript received from backend');
//         setError('No speech was detected in the recording. For best results: 1) Speak clearly 2) Mention participant names 3) Record for at least 15 seconds 4) Ensure good audio quality');
//       } else {
//         setTranscription(result);
//         setActiveTab('overview');
//         console.log(`Successfully processed with ${result.mom.attendance.total_participants} participants detected`);
//       }

//     } catch (error) {
//       console.error('Failed to process audio chunks:', error);
//       setError(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     } finally {
//       setIsProcessing(false);
//     }
//   }, [audioChunks, BACKEND_URL]);

//   const testSingleChunk = useCallback(async (chunkIndex: number) => {
//     const chunk = audioChunks[chunkIndex];
//     if (!chunk) return;

//     try {
//       const formData = new FormData();
//       formData.append('file', chunk.data, `test_chunk_${chunk.index}.webm`);

//       const response = await fetch(`${BACKEND_URL}/live-speech-to-text/live-single`, {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
//         throw new Error(`HTTP ${response.status}: ${errorData.detail}`);
//       }

//       const result: SingleTranscriptionResult = await response.json();
//       console.log(`Enhanced single chunk ${chunkIndex} result:`, result);
      
//       alert(`Chunk Analysis Results:\n` +
//             `Transcript: "${result.transcript}"\n` +
//             `Duration: ${result.audio_info.duration.toFixed(2)}s\n` +
//             `Quality Score: ${result.audio_info.quality_score.toFixed(2)}\n` +
//             `Processing Method: ${result.processing_info.processing_method}\n` +
//             `Noise Reduction: ${result.processing_info.noise_reduction_applied ? 'Applied' : 'Not needed'}`);

//     } catch (error) {
//       console.error(`Failed to test chunk ${chunkIndex}:`, error);
//       alert(`Failed to test chunk ${chunkIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }, [audioChunks, BACKEND_URL]);

//   const exportMoM = useCallback(async () => {
//     if (!transcription) {
//       setError('No meeting minutes to export');
//       return;
//     }

//     setIsExporting(true);
//     setError(null);

//     try {
//       const response = await fetch(`${BACKEND_URL}/live-speech-to-text/export-enhanced`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           mom: transcription.mom,
//           format: exportFormat
//         }),
//       });

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
//         throw new Error(`Export failed: ${errorData.detail}`);
//       }

//       const result = await response.json();
//       console.log('Export response:', result);

//       // Download the file
//       const downloadResponse = await fetch(`${BACKEND_URL}/download?file_path=${encodeURIComponent(result.export_file)}`);
      
//       if (!downloadResponse.ok) {
//         throw new Error('Download failed');
//       }

//       const blob = await downloadResponse.blob();
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.style.display = 'none';
//       a.href = url;
//       a.download = `meeting_minutes_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(url);
//       document.body.removeChild(a);

//       console.log(`Successfully exported and downloaded ${exportFormat.toUpperCase()} with enhanced features:`, result.enhanced_features);

//     } catch (error) {
//       console.error('Export error:', error);
//       setError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     } finally {
//       setIsExporting(false);
//     }
//   }, [transcription, exportFormat, BACKEND_URL]);

//   const cleanup = useCallback(() => {
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach(track => track.stop());
//       streamRef.current = null;
//     }
//     if (mediaRecorderRef.current) {
//       mediaRecorderRef.current = null;
//     }
//     if (recordingTimerRef.current) {
//       clearInterval(recordingTimerRef.current);
//       recordingTimerRef.current = null;
//     }
//     recordedChunksRef.current = [];
//     setIsRecording(false);
//     setAudioChunks([]);
//     setTranscription(null);
//     setError(null);
//     setActiveTab('transcript');
//     setRecordingDuration(0);
//   }, []);

//   const testMicrophone = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       stream.getTracks().forEach(track => track.stop());
//       alert('Microphone access granted! The system is optimized for speaker detection. For best results:\n\n' +
//             '• Mention participant names during conversations\n' +
//             '• Speak clearly and avoid background noise\n' +
//             '• Record for at least 15-30 seconds\n' +
//             '• Include introductions and role references');
//     } catch (error) {
//       console.error('Microphone test failed:', error);
//       setError(`Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }, []);

//   const formatDuration = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}:${secs.toString().padStart(2, '0')}`;
//   };

//   const getPriorityColor = (priority: string) => {
//     switch (priority.toLowerCase()) {
//       case 'high': return 'bg-red-100 text-red-800 border-red-200';
//       case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
//       case 'low': return 'bg-green-100 text-green-800 border-green-200';
//       default: return 'bg-gray-100 text-gray-800 border-gray-200';
//     }
//   };

//   const getSeverityColor = (severity: string) => {
//     switch (severity.toLowerCase()) {
//       case 'high': return 'bg-red-100 text-red-800 border-red-200';
//       case 'medium': return 'bg-orange-100 text-orange-800 border-orange-200';
//       case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
//       default: return 'bg-gray-100 text-gray-800 border-gray-200';
//     }
//   };

//   const renderTabNavigation = () => {
//     if (!transcription) return null;

//     const tabs = [
//       { id: 'overview', label: 'Meeting Overview', icon: TrendingUp },
//       { id: 'attendance', label: 'Attendance', icon: Users },
//       { id: 'transcript', label: 'Transcript', icon: FileText },
//       { id: 'actions', label: 'Action Items', icon: CheckSquare },
//       { id: 'decisions', label: 'Decisions', icon: Target },
//       { id: 'followup', label: 'Follow-up', icon: Clock },
//       { id: 'risks', label: 'Risks & Blockers', icon: AlertTriangle }
//     ];

//     return (
//       <div className="border-b border-gray-200 mb-6">
//         <div className="flex flex-wrap gap-2">
//           {tabs.map((tab) => {
//             const Icon = tab.icon;
//             const isActive = activeTab === tab.id;
            
//             let badge = null;
//             if (tab.id === 'attendance' && transcription.mom.attendance.total_participants > 0) {
//               badge = transcription.mom.attendance.total_participants;
//             } else if (tab.id === 'actions' && transcription.mom.action_items.length > 0) {
//               badge = transcription.mom.action_items.length;
//             } else if (tab.id === 'decisions' && transcription.mom.decisions.length > 0) {
//               badge = transcription.mom.decisions.length;
//             } else if (tab.id === 'risks' && transcription.mom.risks_and_blockers.length > 0) {
//               badge = transcription.mom.risks_and_blockers.length;
//             }

//             return (
//               <button
//                 key={tab.id}
//                 onClick={() => setActiveTab(tab.id)}
//                 className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
//                   isActive
//                     ? 'border-blue-500 text-blue-600'
//                     : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//                 }`}
//               >
//                 <Icon className="w-4 h-4" />
//                 {tab.label}
//                 {badge && (
//                   <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
//                     {badge}
//                   </span>
//                 )}
//               </button>
//             );
//           })}
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="max-w-6xl mx-auto p-6">
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Meeting Transcription & Minutes</h1>
//         <p className="text-gray-600">AI-powered transcription with automatic speaker detection, action item tracking, and comprehensive meeting analysis</p>
//       </div>
      
//       {/* Recording Controls */}
//       <div className="bg-white rounded-lg shadow-md p-6 mb-6">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-xl font-semibold text-gray-800">Recording Controls</h2>
//           {isRecording && (
//             <div className="flex items-center gap-2 text-red-600">
//               <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
//               <span className="font-mono text-lg">{formatDuration(recordingDuration)}</span>
//             </div>
//           )}
//         </div>
        
//         <div className="flex flex-wrap gap-3 mb-4">
//           <button
//             onClick={testMicrophone}
//             disabled={isRecording || isProcessing}
//             className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
//           >
//             <Volume2 className="w-4 h-4" />
//             Test Microphone
//           </button>
          
//           <button
//             onClick={startRecording}
//             disabled={isRecording || isProcessing}
//             className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
//           >
//             <Mic className="w-4 h-4" />
//             {isRecording ? 'Recording...' : 'Start Recording'}
//           </button>
          
//           <button
//             onClick={stopRecording}
//             disabled={!isRecording || isProcessing}
//             className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
//           >
//             <MicOff className="w-4 h-4" />
//             Stop Recording
//           </button>
          
//           <button
//             onClick={processAudioChunks}
//             disabled={isRecording || isProcessing || audioChunks.length === 0}
//             className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
//           >
//             <TrendingUp className="w-4 h-4" />
//             {isProcessing ? 'Generating Minutes...' : 'Generate Meeting Minutes'}
//           </button>
          
//           <button
//             onClick={cleanup}
//             disabled={isRecording || isProcessing}
//             className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
//           >
//             <RotateCcw className="w-4 h-4" />
//             Reset
//           </button>
//         </div>

//         {/* Export Controls */}
//         {transcription && (
//           <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
//             <span className="text-sm font-medium text-gray-700">Export:</span>
//             <select
//               value={exportFormat}
//               onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'docx')}
//               className="px-3 py-1 border border-gray-300 rounded text-sm"
//               disabled={isExporting}
//             >
//               <option value="pdf">PDF</option>
//               <option value="docx">DOCX</option>
//             </select>
//             <button
//               onClick={exportMoM}
//               disabled={isExporting}
//               className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
//             >
//               <FileDown className="w-4 h-4" />
//               {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
//             </button>
//           </div>
//         )}

//         {/* Recording Status */}
//         {isRecording && (
//           <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
//             <div className="flex items-center justify-between">
//               <div className="flex items-center">
//                 <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-3"></div>
//                 <div>
//                   <span className="text-green-700 font-medium">Recording in progress...</span>
//                   <p className="text-green-600 text-sm mt-1">
//                     Speak clearly and mention participant names for better speaker detection
//                   </p>
//                 </div>
//               </div>
//               <div className="text-right">
//                 <div className="text-2xl font-mono text-green-800">{formatDuration(recordingDuration)}</div>
//                 <div className="text-xs text-green-600">Duration</div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Audio Chunks Info */}
//         {audioChunks.length > 0 && !isRecording && (
//           <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
//             <h3 className="font-medium text-blue-800 mb-2">
//               Recording Complete: {(audioChunks.reduce((sum, chunk) => sum + chunk.size, 0) / 1024 / 1024).toFixed(2)} MB
//             </h3>
//             <div className="flex items-center justify-between">
//               <div className="text-sm text-blue-700">
//                 Ready for speaker detection and comprehensive analysis
//               </div>
//               <button
//                 onClick={() => testSingleChunk(0)}
//                 className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200"
//                 title="Test audio quality and basic transcription"
//               >
//                 Test Audio Quality
//               </button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Error Display */}
//       {error && (
//         <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
//           <div className="flex">
//             <AlertTriangle className="text-red-400 w-5 h-5" />
//             <div className="ml-3">
//               <h3 className="text-sm font-medium text-red-800">Error</h3>
//               <p className="mt-1 text-sm text-red-700">{error}</p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Processing Status */}
//       {isProcessing && (
//         <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
//           <div className="flex items-center">
//             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
//             <div className="ml-3">
//               <p className="text-blue-700 font-medium">Processing meeting audio...</p>
//               <p className="text-blue-600 text-sm">Detecting speakers, generating transcripts, and analyzing meeting content</p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Speaker Detection Guide */}
//       <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
//         <h3 className="text-lg font-medium text-blue-900 mb-3 flex items-center gap-2">
//           <UserCheck className="w-5 h-5" />
//           Enhanced Speaker Detection Tips
//         </h3>
//         <div className="grid md:grid-cols-2 gap-6">
//           <div>
//             <h4 className="font-medium text-blue-800 mb-2">For Better Results:</h4>
//             <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
//               <li>Start with introductions ("Hi, I'm John from Marketing")</li>
//               <li>Use names in conversation ("Sarah, what do you think?")</li>
//               <li>Mention roles and responsibilities</li>
//               <li>Record for at least 15-30 seconds</li>
//               <li>Speak clearly with minimal background noise</li>
//             </ul>
//           </div>
//           <div>
//             <h4 className="font-medium text-blue-800 mb-2">Enhanced Features:</h4>
//             <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
//               <li>Automatic participant detection and tracking</li>
//               <li>Priority-based action item classification</li>
//               <li>Decision rationale and impact analysis</li>
//               <li>Risk and blocker identification</li>
//               <li>Comprehensive follow-up planning</li>
//             </ul>
//           </div>
//         </div>
//       </div>

//       {/* Tab Navigation */}
//       {renderTabNavigation()}

//       {/* Results Display */}
//       {transcription && (
//         <div className="space-y-6">
//           {/* Processing Summary */}
//           {transcription.processing_info && (
//             <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
//               <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
//                 <TrendingUp className="w-5 h-5" />
//                 Processing Summary
//               </h3>
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
//                 <div className="text-center">
//                   <div className="text-2xl font-bold text-blue-600">
//                     {transcription.processing_info.successful_files}/{transcription.processing_info.total_files}
//                   </div>
//                   <div className="text-gray-600">Files Processed</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="text-2xl font-bold text-green-600">
//                     {transcription.processing_info.processing_time?.toFixed(1)}s
//                   </div>
//                   <div className="text-gray-600">Processing Time</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="text-2xl font-bold text-purple-600">
//                     {transcription.mom.attendance.total_participants}
//                   </div>
//                   <div className="text-gray-600">Participants</div>
//                 </div>
//                 <div className="text-center">
//                   <div className="text-2xl font-bold text-orange-600">
//                     {transcription.processing_info.enhanced_features?.length || 0}
//                   </div>
//                   <div className="text-gray-600">AI Features</div>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Tab Content */}
//           <div className="bg-white rounded-lg shadow-md p-6">
//             {/* Meeting Overview Tab */}
//             {activeTab === 'overview' && (
//               <div>
//                 <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
//                   <TrendingUp className="w-5 h-5" />
//                   Meeting Overview
//                 </h3>
                
//                 <div className="grid md:grid-cols-2 gap-6 mb-6">
//                   <div className="bg-blue-50 rounded-lg p-4">
//                     <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
//                       <Calendar className="w-4 h-4" />
//                       Meeting Details
//                     </h4>
//                     <div className="space-y-2 text-sm">
//                       <div className="flex justify-between">
//                         <span className="text-blue-700">Date:</span>
//                         <span className="text-blue-900 font-medium">{transcription.mom.meeting_info.date}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span className="text-blue-700">Duration:</span>
//                         <span className="text-blue-900 font-medium">{transcription.mom.meeting_info.time}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span className="text-blue-700">Type:</span>
//                         <span className="text-blue-900 font-medium capitalize">{transcription.mom.meeting_info.meeting_type}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span className="text-blue-700">Participants:</span>
//                         <span className="text-blue-900 font-medium">{transcription.mom.attendance.total_participants}</span>
//                       </div>
//                     </div>
//                   </div>

//                   <div className="bg-green-50 rounded-lg p-4">
//                     <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
//                       <Target className="w-4 h-4" />
//                       Meeting Outcomes
//                     </h4>
//                     <div className="space-y-2 text-sm">
//                       <div className="flex justify-between">
//                         <span className="text-green-700">Action Items:</span>
//                         <span className="text-green-900 font-medium">{transcription.mom.action_items.length}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span className="text-green-700">Decisions Made:</span>
//                         <span className="text-green-900 font-medium">{transcription.mom.decisions.length}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span className="text-green-700">Key Topics:</span>
//                         <span className="text-green-900 font-medium">{transcription.mom.summary.key_topics.length}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span className="text-green-700">Risks Identified:</span>
//                         <span className="text-green-900 font-medium">{transcription.mom.risks_and_blockers.length}</span>
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="space-y-4">
//                   <div className="bg-blue-50 rounded-lg p-4">
//                     <h4 className="font-medium text-blue-900 mb-2">Executive Overview</h4>
//                     <p className="text-blue-800">{transcription.mom.summary.overview}</p>
//                   </div>
                  
//                   {transcription.mom.summary.key_topics.length > 0 && (
//                     <div className="bg-green-50 rounded-lg p-4">
//                       <h4 className="font-medium text-green-900 mb-3">Key Discussion Topics</h4>
//                       <div className="flex flex-wrap gap-2">
//                         {transcription.mom.summary.key_topics.map((topic, index) => (
//                           <span key={index} className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm">
//                             {topic}
//                           </span>
//                         ))}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}

//             {/* Attendance Tab */}
//             {activeTab === 'attendance' && (
//               <div>
//                 <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
//                   <Users className="w-5 h-5" />
//                   Meeting Attendance ({transcription.mom.attendance.total_participants})
//                 </h3>

//                 {transcription.mom.attendance.participants.length > 0 ? (
//                   <div>
//                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
//                       {transcription.mom.attendance.participants.map((participant, index) => (
//                         <div key={index} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
//                           <div className="flex items-start gap-3">
//                             <div className="bg-blue-100 rounded-full p-2">
//                               <User className="w-6 h-6 text-blue-600" />
//                             </div>
//                             <div className="flex-1">
//                               <h4 className="font-medium text-gray-900">{participant.name}</h4>
//                               {participant.role && participant.role !== 'Not specified' && (
//                                 <p className="text-sm text-gray-600 mt-1">{participant.role}</p>
//                               )}
//                               <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${
//                                 participant.attendance_status === 'present' 
//                                   ? 'bg-green-100 text-green-800' 
//                                   : 'bg-yellow-100 text-yellow-800'
//                               }`}>
//                                 {participant.attendance_status}
//                               </span>
//                             </div>
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                     <div className="text-center text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
//                       Participants were automatically detected from meeting audio using AI analysis
//                     </div>
//                   </div>
//                 ) : (
//                   <div className="text-center py-12">
//                     <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
//                     <h4 className="text-lg font-medium text-gray-900 mb-2">No Participants Detected</h4>
//                     <p className="text-gray-500 mb-4">The AI could not identify specific participants from the audio</p>
//                     <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
//                       <h5 className="font-medium text-yellow-800 mb-2">Tips for Better Detection:</h5>
//                       <ul className="text-sm text-yellow-700 text-left space-y-1">
//                         <li>• Start meetings with introductions</li>
//                         <li>• Use names when addressing others</li>
//                         <li>• Mention roles and titles</li>
//                         <li>• Ensure clear, high-quality audio</li>
//                       </ul>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Transcript Tab */}
//             {activeTab === 'transcript' && (
//               <div>
//                 <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
//                   <FileText className="w-5 h-5" />
//                   Full Transcript
//                 </h3>
//                 <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
//                   <div className="mb-4 flex justify-between items-center">
//                     <span className="text-sm text-gray-600">
//                       Processed with enhanced speaker detection and noise reduction
//                     </span>
//                     <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
//                       {transcription.transcript.split(' ').length} words
//                     </span>
//                   </div>
//                   <div className="prose max-w-none">
//                     <p className="text-gray-700 leading-relaxed whitespace-pre-wrap font-mono text-sm">
//                       {transcription.transcript || 'No transcript available'}
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Action Items Tab */}
//             {activeTab === 'actions' && (
//               <div>
//                 <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
//                   <CheckSquare className="w-5 h-5" />
//                   Action Items ({transcription.mom.action_items.length})
//                 </h3>

//                 {transcription.mom.action_items.length > 0 ? (
//                   <div className="space-y-4">
//                     {transcription.mom.action_items.map((item, index) => (
//                       <div key={item.id} className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 p-6 rounded-r-lg shadow-sm">
//                         <div className="flex items-start justify-between gap-4">
//                           <div className="flex-1">
//                             <div className="flex items-center gap-3 mb-3">
//                               <span className="bg-white text-gray-700 text-sm font-medium px-2 py-1 rounded border">
//                                 #{item.id}
//                               </span>
//                               <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getPriorityColor(item.priority)}`}>
//                                 <Flag className="w-3 h-3 inline mr-1" />
//                                 {item.priority} priority
//                               </span>
//                               <span className="bg-blue-100 text-blue-800 px-3 py-1 text-xs font-medium rounded-full">
//                                 {item.category}
//                               </span>
//                             </div>
//                             <h4 className="font-semibold text-gray-900 mb-3 text-lg">{item.task}</h4>
//                             <div className="grid md:grid-cols-2 gap-4 text-sm">
//                               {item.assigned_to && item.assigned_to !== 'Not specified' && (
//                                 <div className="flex items-center gap-2">
//                                   <User className="w-4 h-4 text-gray-500" />
//                                   <span className="text-gray-600">Assigned to:</span>
//                                   <span className="font-medium text-gray-900">{item.assigned_to}</span>
//                                 </div>
//                               )}
//                               {item.deadline && item.deadline !== 'N/A' && item.deadline !== 'Not specified' && (
//                                 <div className="flex items-center gap-2">
//                                   <Calendar className="w-4 h-4 text-gray-500" />
//                                   <span className="text-gray-600">Deadline:</span>
//                                   <span className="font-medium text-gray-900">{item.deadline}</span>
//                                 </div>
//                               )}
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-12">
//                     <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
//                     <h4 className="text-lg font-medium text-gray-900 mb-2">No Action Items Detected</h4>
//                     <p className="text-gray-500 mb-4">The AI could not identify specific action items from the meeting</p>
//                     <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
//                       <h5 className="font-medium text-blue-800 mb-2">Tips for Better Detection:</h5>
//                       <ul className="text-sm text-blue-700 text-left space-y-1">
//                         <li>• Be explicit about tasks: "John will handle..."</li>
//                         <li>• Mention deadlines and timelines</li>
//                         <li>• Use action words: "I'll do", "We need to"</li>
//                         <li>• Assign clear ownership of tasks</li>
//                       </ul>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Decisions Tab */}
//             {activeTab === 'decisions' && (
//               <div>
//                 <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
//                   <Target className="w-5 h-5" />
//                   Decisions & Agreements ({transcription.mom.decisions.length})
//                 </h3>

//                 {transcription.mom.decisions.length > 0 ? (
//                   <div className="space-y-6">
//                     {transcription.mom.decisions.map((decision, index) => (
//                       <div key={decision.id} className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 shadow-sm">
//                         <div className="mb-4">
//                           <div className="flex items-center gap-3 mb-3">
//                             <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
//                               Decision #{decision.id}
//                             </span>
//                             <Target className="w-5 h-5 text-green-600" />
//                           </div>
//                           <h4 className="font-semibold text-green-900 text-lg mb-3">{decision.decision}</h4>
//                         </div>
                        
//                         <div className="grid md:grid-cols-2 gap-4">
//                           {decision.rationale && (
//                             <div className="bg-white rounded-lg p-4 border border-gray-200">
//                               <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
//                                 <FileText className="w-4 h-4" />
//                                 Rationale
//                               </h5>
//                               <p className="text-gray-700 text-sm">{decision.rationale}</p>
//                             </div>
//                           )}
                          
//                           {decision.impact && (
//                             <div className="bg-white rounded-lg p-4 border border-gray-200">
//                               <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
//                                 <TrendingUp className="w-4 h-4" />
//                                 Impact
//                               </h5>
//                               <p className="text-gray-700 text-sm">{decision.impact}</p>
//                             </div>
//                           )}
                          
//                           {decision.responsible_party && decision.responsible_party !== 'Not specified' && (
//                             <div className="bg-white rounded-lg p-4 border border-gray-200">
//                               <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
//                                 <User className="w-4 h-4" />
//                                 Implementation Owner
//                               </h5>
//                               <p className="text-gray-700 text-sm">{decision.responsible_party}</p>
//                             </div>
//                           )}
                          
//                           {decision.timeline && decision.timeline !== 'Not specified' && (
//                             <div className="bg-white rounded-lg p-4 border border-gray-200">
//                               <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
//                                 <Clock className="w-4 h-4" />
//                                 Timeline
//                               </h5>
//                               <p className="text-gray-700 text-sm">{decision.timeline}</p>
//                             </div>
//                           )}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-12">
//                     <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
//                     <h4 className="text-lg font-medium text-gray-900 mb-2">No Decisions Recorded</h4>
//                     <p className="text-gray-500 mb-4">The AI could not identify specific decisions from the meeting</p>
//                     <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
//                       <h5 className="font-medium text-green-800 mb-2">Tips for Better Detection:</h5>
//                       <ul className="text-sm text-green-700 text-left space-y-1">
//                         <li>• Use decision language: "We decided...", "It was agreed..."</li>
//                         <li>• Explain the reasoning behind decisions</li>
//                         <li>• Mention who will implement the decision</li>
//                         <li>• Include timelines for implementation</li>
//                       </ul>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Follow-up Tab */}
//             {activeTab === 'followup' && (
//               <div>
//                 <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
//                   <Clock className="w-5 h-5" />
//                   Follow-up Planning
//                 </h3>

//                 <div className="grid md:grid-cols-3 gap-6">
//                   <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
//                     <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
//                       <Calendar className="w-5 h-5" />
//                       Next Meeting
//                     </h4>
//                     <div className="bg-white rounded p-3 border border-blue-100">
//                       <p className="text-blue-800 font-medium">
//                         {transcription.mom.follow_up.next_meeting !== 'TBD' && transcription.mom.follow_up.next_meeting !== 'Not specified'
//                           ? transcription.mom.follow_up.next_meeting
//                           : 'To be determined'}
//                       </p>
//                       {transcription.mom.follow_up.next_meeting === 'TBD' && (
//                         <p className="text-blue-600 text-xs mt-1">Schedule follow-up meeting as needed</p>
//                       )}
//                     </div>
//                   </div>

//                   <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
//                     <h4 className="font-medium text-orange-900 mb-3 flex items-center gap-2">
//                       <Clock className="w-5 h-5" />
//                       Pending Items ({transcription.mom.follow_up.pending_items.length})
//                     </h4>
//                     <div className="bg-white rounded p-3 border border-orange-100 max-h-40 overflow-y-auto">
//                       {transcription.mom.follow_up.pending_items.length > 0 ? (
//                         <ul className="text-orange-800 text-sm space-y-2">
//                           {transcription.mom.follow_up.pending_items.map((item, index) => (
//                             <li key={index} className="flex items-start gap-2">
//                               <span className="text-orange-600 mt-1">•</span>
//                               <span>{item}</span>
//                             </li>
//                           ))}
//                         </ul>
//                       ) : (
//                         <p className="text-orange-700 text-sm">No pending items identified</p>
//                       )}
//                     </div>
//                   </div>

//                   <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
//                     <h4 className="font-medium text-purple-900 mb-3 flex items-center gap-2">
//                       <UserCheck className="w-5 h-5" />
//                       Required Approvals ({transcription.mom.follow_up.required_approvals.length})
//                     </h4>
//                     <div className="bg-white rounded p-3 border border-purple-100 max-h-40 overflow-y-auto">
//                       {transcription.mom.follow_up.required_approvals.length > 0 ? (
//                         <ul className="text-purple-800 text-sm space-y-2">
//                           {transcription.mom.follow_up.required_approvals.map((approval, index) => (
//                             <li key={index} className="flex items-start gap-2">
//                               <span className="text-purple-600 mt-1">•</span>
//                               <span>{approval}</span>
//                             </li>
//                           ))}
//                         </ul>
//                       ) : (
//                         <p className="text-purple-700 text-sm">No approvals needed</p>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Risks & Blockers Tab */}
//             {activeTab === 'risks' && (
//               <div>
//                 <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
//                   <AlertTriangle className="w-5 h-5" />
//                   Risks & Blockers ({transcription.mom.risks_and_blockers.length})
//                 </h3>

//                 {transcription.mom.risks_and_blockers.length > 0 ? (
//                   <div className="space-y-4">
//                     {transcription.mom.risks_and_blockers.map((risk, index) => (
//                       <div key={index} className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-6 shadow-sm">
//                         <div className="flex items-start justify-between gap-4">
//                           <div className="flex-1">
//                             <div className="flex items-center gap-3 mb-3">
//                               <AlertTriangle className="w-5 h-5 text-red-500" />
//                               <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getSeverityColor(risk.severity)}`}>
//                                 {risk.severity.toUpperCase()} SEVERITY
//                               </span>
//                             </div>
//                             <h4 className="font-semibold text-red-900 mb-3 text-lg">{risk.issue}</h4>
//                             {risk.owner && risk.owner !== 'Not specified' && (
//                               <div className="flex items-center gap-2 text-sm">
//                                 <User className="w-4 h-4 text-gray-500" />
//                                 <span className="text-gray-600">Responsible for resolution:</span>
//                                 <span className="font-medium text-gray-900">{risk.owner}</span>
//                               </div>
//                             )}
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-12">
//                     <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
//                     <h4 className="text-lg font-medium text-gray-900 mb-2">No Risks or Blockers Identified</h4>
//                     <p className="text-gray-500 mb-4">The AI did not detect any risks or blockers in the meeting</p>
//                     <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
//                       <h5 className="font-medium text-yellow-800 mb-2">This usually means:</h5>
//                       <ul className="text-sm text-yellow-700 text-left space-y-1">
//                         <li>• Meeting focused on positive outcomes</li>
//                         <li>• No significant obstacles discussed</li>
//                         <li>• Risk discussions may need more explicit language</li>
//                         <li>• Consider proactive risk identification in future meetings</li>
//                       </ul>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }