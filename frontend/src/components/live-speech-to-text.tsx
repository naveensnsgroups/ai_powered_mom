
// 'use client';

// import React, { useState, useRef, useCallback, useEffect } from 'react';
// import { Calendar, Clock, Users, CheckSquare, AlertTriangle, FileText, User, Target, Flag, Mic, Play, Square, RotateCcw } from 'lucide-react';

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
//   };
// }

// interface SingleTranscriptionResult {
//   transcript: string;
//   audio_info: {
//     duration: number;
//     sample_rate: number;
//     samples: number;
//     max_amplitude: number;
//   };
// }

// export default function EnhancedLiveTranscription() {
//   const [isRecording, setIsRecording] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [transcription, setTranscription] = useState<EnhancedTranscriptionResult | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
//   const [activeTab, setActiveTab] = useState<string>('transcript');
//   const [recordingTime, setRecordingTime] = useState(0);
//   const [audioLevel, setAudioLevel] = useState(0);

//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const recordedChunksRef = useRef<Blob[]>([]);
//   const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const analyserRef = useRef<AnalyserNode | null>(null);
//   const animationFrameRef = useRef<number | null>(null);

//   const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

//   const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//   };

//   const startTimer = useCallback(() => {
//     setRecordingTime(0);
//     timerIntervalRef.current = setInterval(() => {
//       setRecordingTime(prev => prev + 1);
//     }, 1000);
//   }, []);

//   const stopTimer = useCallback(() => {
//     if (timerIntervalRef.current) {
//       clearInterval(timerIntervalRef.current);
//       timerIntervalRef.current = null;
//     }
//   }, []);

//   const initAudioLevelMonitoring = useCallback((stream: MediaStream) => {
//     try {
//       const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
//       audioContextRef.current = audioContext;

//       const analyser = audioContext.createAnalyser();
//       analyser.fftSize = 256;
//       analyserRef.current = analyser;

//       const source = audioContext.createMediaStreamSource(stream);
//       source.connect(analyser);

//       const dataArray = new Uint8Array(analyser.frequencyBinCount);

//       const updateAudioLevel = () => {
//         if (!analyserRef.current) return;

//         analyser.getByteFrequencyData(dataArray);

//         const sum = dataArray.reduce((a, b) => a + b, 0);
//         const average = sum / dataArray.length;
//         const normalizedLevel = Math.min(100, (average / 255) * 100);

//         setAudioLevel(normalizedLevel);

//         animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
//       };

//       updateAudioLevel();
//     } catch (error) {
//       console.error('Failed to initialize audio level monitoring:', error);
//     }
//   }, []);

//   const stopAudioLevelMonitoring = useCallback(() => {
//     if (animationFrameRef.current) {
//       cancelAnimationFrame(animationFrameRef.current);
//       animationFrameRef.current = null;
//     }

//     if (audioContextRef.current) {
//       audioContextRef.current.close();
//       audioContextRef.current = null;
//     }

//     analyserRef.current = null;
//     setAudioLevel(0);
//   }, []);

//   const initializeRecorder = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           channelCount: 1,
//           sampleRate: 44100,
//           sampleSize: 16,
//           echoCancellation: true,
//           noiseSuppression: false,
//           autoGainControl: true,
//           volume: 1.0
//         }
//       });

//       streamRef.current = stream;
//       initAudioLevelMonitoring(stream);

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
//         console.log('Recording started');
//         setIsRecording(true);
//         setAudioChunks([]);
//         recordedChunksRef.current = [];
//         setError(null);
//         startTimer();
//       };

//       mediaRecorder.onstop = () => {
//         console.log('Recording stopped');
//         setIsRecording(false);
//         stopTimer();
//         stopAudioLevelMonitoring();

//         if (recordedChunksRef.current.length > 0) {
//           const completeBlob = new Blob(recordedChunksRef.current, { type: selectedMimeType });

//           console.log(`Complete recording: ${completeBlob.size} bytes`);

//           const chunk: AudioChunk = {
//             data: completeBlob,
//             timestamp: Date.now(),
//             index: 0,
//             size: completeBlob.size
//           };

//           setAudioChunks([chunk]);
//         } else {
//           console.warn('No audio data recorded');
//           setError('No audio data was recorded. Please check microphone permissions.');
//         }
//       };

//       mediaRecorder.onerror = (error) => {
//         console.error('MediaRecorder error:', error);
//         setError('Recording error occurred');
//         stopTimer();
//         stopAudioLevelMonitoring();
//       };

//       mediaRecorderRef.current = mediaRecorder;
//       return true;

//     } catch (error) {
//       console.error('Failed to initialize recorder:', error);
//       setError(`Failed to initialize recorder: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       return false;
//     }
//   }, [initAudioLevelMonitoring, startTimer, stopTimer, stopAudioLevelMonitoring]);

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

//       if (chunk.size < 1000) {
//         throw new Error('Audio file too small. Please record for longer duration.');
//       }

//       const formData = new FormData();
//       formData.append('files', chunk.data, 'complete_recording.webm');

//       const response = await fetch(`${BACKEND_URL}/live-speech-to-text/live-chunks`, {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         let errorData;
//         try {
//           errorData = JSON.parse(errorText);
//         } catch {
//           errorData = { detail: errorText || 'Unknown error' };
//         }

//         throw new Error(`HTTP ${response.status}: ${errorData.detail || 'Request failed'}`);
//       }

//       const result: EnhancedTranscriptionResult = await response.json();

//       if (!result.transcript || result.transcript.trim() === '') {
//         setError('No speech was detected in the recording. Please try recording again and speak clearly.');
//       } else {
//         setTranscription(result);
//         setActiveTab('transcript');
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

//       alert(`Chunk ${chunkIndex} transcript: "${result.transcript}"\nDuration: ${result.audio_info.duration.toFixed(2)}s`);

//     } catch (error) {
//       alert(`Failed to test chunk ${chunkIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }, [audioChunks, BACKEND_URL]);

//   const cleanup = useCallback(() => {
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach(track => track.stop());
//       streamRef.current = null;
//     }
//     if (mediaRecorderRef.current) {
//       mediaRecorderRef.current = null;
//     }
//     recordedChunksRef.current = [];
//     setIsRecording(false);
//     setAudioChunks([]);
//     setTranscription(null);
//     setError(null);
//     setActiveTab('transcript');
//     stopTimer();
//     stopAudioLevelMonitoring();
//     setRecordingTime(0);
//   }, [stopTimer, stopAudioLevelMonitoring]);

//   const testMicrophone = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       stream.getTracks().forEach(track => track.stop());
//       alert('Microphone access granted! You can now start recording.');
//     } catch (error) {
//       console.error('Microphone test failed:', error);
//       setError(`Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }, []);

//   useEffect(() => {
//     return () => {
//       cleanup();
//     };
//   }, [cleanup]);

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
//       { id: 'transcript', label: 'Transcript', icon: FileText },
//       { id: 'overview', label: 'Meeting Overview', icon: Calendar },
//       { id: 'attendance', label: 'Attendance', icon: Users },
//       { id: 'actions', label: 'Action Items', icon: CheckSquare },
//       { id: 'decisions', label: 'Decisions', icon: Target },
//       { id: 'followup', label: 'Follow-up', icon: Clock },
//       { id: 'risks', label: 'Risks & Blockers', icon: AlertTriangle }
//     ];

//     return (
//       <div className="border-b mb-6" style={{ borderColor: '#E5E7EB' }}>
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
//                 className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
//                 style={{
//                   borderColor: isActive ? '#1E3A8A' : 'transparent',
//                   color: isActive ? '#1E3A8A' : '#6B7280'
//                 }}
//                 onMouseEnter={(e) => {
//                   if (!isActive) {
//                     e.currentTarget.style.color = '#374151';
//                     e.currentTarget.style.borderColor = '#D1D5DB';
//                   }
//                 }}
//                 onMouseLeave={(e) => {
//                   if (!isActive) {
//                     e.currentTarget.style.color = '#6B7280';
//                     e.currentTarget.style.borderColor = 'transparent';
//                   }
//                 }}
//               >
//                 <Icon className="w-4 h-4" />
//                 {tab.label}
//                 {badge && (
//                   <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
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
//     <div className="w-full">
//       {/* Recording Controls */}
//       <div className="bg-white rounded-xl p-6 mb-6 border" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
//         <h2 className="text-xl font-semibold mb-4" style={{ color: '#1E3A8A' }}>Recording Controls</h2>

//         <div className="flex gap-3 mb-4">
//           <button
//             onClick={testMicrophone}
//             disabled={isRecording || isProcessing}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#1E3A8A' }}
//             onMouseEnter={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#1e40af';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#1E3A8A';
//               }
//             }}
//           >
//             <Mic className="w-5 h-5" />
//             Test Microphone
//           </button>

//           <button
//             onClick={startRecording}
//             disabled={isRecording || isProcessing}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#059669' }}
//             onMouseEnter={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#047857';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#059669';
//               }
//             }}
//           >
//             <Play className="w-5 h-5" />
//           </button>

//           <button
//             onClick={stopRecording}
//             disabled={!isRecording || isProcessing}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: !isRecording || isProcessing ? '#9CA3AF' : '#DC2626' }}
//             onMouseEnter={(e) => {
//               if (!(!isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#B91C1C';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(!isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#DC2626';
//               }
//             }}
//           >
//             <Square className="w-5 h-5" />
//           </button>

//           <button
//             onClick={processAudioChunks}
//             disabled={isRecording || isProcessing || audioChunks.length === 0}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: isRecording || isProcessing || audioChunks.length === 0 ? '#9CA3AF' : '#1E3A8A' }}
//             onMouseEnter={(e) => {
//               if (!(isRecording || isProcessing || audioChunks.length === 0)) {
//                 e.currentTarget.style.backgroundColor = '#1e40af';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(isRecording || isProcessing || audioChunks.length === 0)) {
//                 e.currentTarget.style.backgroundColor = '#1E3A8A';
//               }
//             }}
//           >
//             {isProcessing ? (
//               <>
//                 <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
//                 </svg>
//                 Processing...
//               </>
//             ) : 'Generate Meeting Minutes'}
//           </button>

//           <button
//             onClick={cleanup}
//             disabled={isRecording || isProcessing}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#6B7280' }}
//             onMouseEnter={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#4B5563';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#6B7280';
//               }
//             }}
//           >
//             <RotateCcw className="w-5 h-5" />
//           </button>
//         </div>

//         {/* Recording Status with Enhanced Audio Level */}
//         {isRecording && (
//           <div className="mb-4 space-y-4">
//             <div className="p-4 rounded-lg border" style={{ backgroundColor: '#D1FAE5', borderColor: '#10B981' }}>
//               <div className="flex items-center justify-between mb-3">
//                 <div className="flex items-center gap-3">
//                   <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#DC2626' }}></div>
//                   <span className="font-medium" style={{ color: '#047857' }}>Recording in progress...</span>
//                   <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border" style={{ borderColor: '#10B981' }}>
//                     <Clock className="w-4 h-4" style={{ color: '#059669' }} />
//                     <span className="font-mono font-semibold" style={{ color: '#047857' }}>{formatTime(recordingTime)}</span>
//                   </div>
//                 </div>
//                 <Mic className="w-5 h-5" style={{ color: '#059669' }} />
//               </div>

//               {/* Enhanced Audio Level Visualizer */}
//               <div className="space-y-2">
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center gap-2">
//                     <Mic className="w-4 h-4" style={{ color: '#047857' }} />
//                     <span className="text-sm font-medium" style={{ color: '#047857' }}>Audio Level</span>
//                   </div>
//                   <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#ECFDF5', color: '#047857' }}>
//                     {audioLevel.toFixed(0)}%
//                   </span>
//                 </div>

//                 {/* Waveform-style bars */}
//                 <div className="flex items-end gap-1 h-16 bg-white rounded-lg p-2 border" style={{ borderColor: '#10B981' }}>
//                   {[...Array(40)].map((_, i) => {
//                     const barHeight = Math.max(10, Math.sin((i + audioLevel) * 0.3) * audioLevel * 0.6 + Math.random() * 20);
//                     const color = audioLevel > 70 ? '#059669' : audioLevel > 30 ? '#F59E0B' : '#DC2626';
//                     return (
//                       <div
//                         key={i}
//                         className="flex-1 rounded-t transition-all duration-100"
//                         style={{
//                           height: `${barHeight}%`,
//                           backgroundColor: color,
//                           opacity: 0.7
//                         }}
//                       />
//                     );
//                   })}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Audio Chunks Info */}
//         {audioChunks.length > 0 && !isRecording && (
//           <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
//             <h3 className="font-medium mb-2" style={{ color: '#374151' }}>
//               Recorded Audio: {audioChunks.length} file · Duration: {formatTime(recordingTime)}
//               · Size: {(audioChunks.reduce((sum, chunk) => sum + chunk.size, 0) / 1024).toFixed(1)} KB
//             </h3>
//             <div className="flex flex-wrap gap-2">
//               {audioChunks.map((chunk, index) => (
//                 <button
//                   key={chunk.index}
//                   onClick={() => testSingleChunk(index)}
//                   className="px-3 py-1 text-sm rounded font-medium transition-colors"
//                   style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}
//                   title={`Test recording (${(chunk.size / 1024).toFixed(1)} KB)`}
//                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DBEAFE'}
//                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
//                 >
//                   Test Audio
//                 </button>
//               ))}
//             </div>
//             <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
//               Click "Generate Meeting Minutes" to transcribe and create comprehensive meeting minutes
//             </p>
//           </div>
//         )}
//       </div>

//       {/* Error Display */}
//       {error && (
//         <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
//           <div className="flex">
//             <AlertTriangle className="w-5 h-5" style={{ color: '#DC2626' }} />
//             <div className="ml-3">
//               <h3 className="text-sm font-medium" style={{ color: '#991B1B' }}>Error</h3>
//               <p className="mt-1 text-sm" style={{ color: '#DC2626' }}>{error}</p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Processing Status */}
//       {isProcessing && (
//         <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
//           <div className="flex items-center">
//             <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#1E3A8A' }}></div>
//             <p className="ml-3" style={{ color: '#1E3A8A' }}>Processing audio and generating comprehensive meeting minutes...</p>
//           </div>
//         </div>
//       )}

//       {/* Instructions */}
//       <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }}>
//         <h3 className="text-lg font-medium mb-2" style={{ color: '#92400E' }}>Enhanced Features</h3>
//         <div className="grid md:grid-cols-2 gap-4">
//           <div>
//             <h4 className="font-medium mb-2" style={{ color: '#92400E' }}>How to Use:</h4>
//             <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: '#B45309' }}>
//               <li>Test microphone access</li>
//               <li>Start recording your meeting</li>
//               <li>Monitor audio level and recording time</li>
//               <li>Speak clearly, mention names and roles</li>
//               <li>Stop recording when finished</li>
//               <li>Generate comprehensive meeting minutes</li>
//             </ol>
//           </div>
//           <div>
//             <h4 className="font-medium mb-2" style={{ color: '#92400E' }}>New Features:</h4>
//             <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: '#B45309' }}>
//               <li>⏱️ Real-time recording timer</li>
//               <li>🎤 Live audio level visualization</li>
//               <li>👥 Automatic participant detection</li>
//               <li>📋 Enhanced action items with priorities</li>
//               <li>✅ Decision tracking with rationale</li>
//               <li>⚠️ Risk and blocker identification</li>
//             </ul>
//           </div>
//         </div>
//       </div>

//       {/* Tab Navigation */}
//       {renderTabNavigation()}

//       {/* Results Display */}
//       {transcription && (
//         <div className="space-y-6">
//           {/* Processing Info */}
//           {transcription.processing_info && (
//             <div className="rounded-lg p-4 border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
//               <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E3A8A' }}>Processing Information</h3>
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
//                 <div>
//                   <span className="font-medium" style={{ color: '#374151' }}>Files Processed:</span>
//                   <br />
//                   <span style={{ color: '#6B7280' }}>
//                     {transcription.processing_info.successful_files}/{transcription.processing_info.total_files}
//                   </span>
//                 </div>
//                 <div>
//                   <span className="font-medium" style={{ color: '#374151' }}>Processing Time:</span>
//                   <br />
//                   <span style={{ color: '#6B7280' }}>
//                     {transcription.processing_info.processing_time?.toFixed(2)}s
//                   </span>
//                 </div>
//                 <div>
//                   <span className="font-medium" style={{ color: '#374151' }}>Transcription Time:</span>
//                   <br />
//                   <span style={{ color: '#6B7280' }}>
//                     {transcription.processing_info.transcription_time?.toFixed(2)}s
//                   </span>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Tab Content */}
//           <div className="bg-white rounded-lg p-6 border" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
//             {/* Transcript Tab */}
//             {activeTab === 'transcript' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <FileText className="w-5 h-5" />
//                   Transcript
//                 </h3>
//                 <div className="rounded-lg p-4" style={{ backgroundColor: '#F9FAFB' }}>
//                   <p className="leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>
//                     {transcription.transcript || 'No transcript available'}
//                   </p>
//                 </div>
//               </div>
//             )}

//             {/* Meeting Overview Tab */}
//             {activeTab === 'overview' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <Calendar className="w-5 h-5" />
//                   Meeting Overview
//                 </h3>

//                 <div className="grid md:grid-cols-2 gap-6">
//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#EFF6FF' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#1E3A8A' }}>Meeting Details</h4>
//                     <div className="space-y-2 text-sm">
//                       <div className="flex justify-between">
//                         <span style={{ color: '#1E3A8A' }}>Date:</span>
//                         <span className="font-medium" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.date}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span style={{ color: '#1E3A8A' }}>Time/Duration:</span>
//                         <span className="font-medium" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.time}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span style={{ color: '#1E3A8A' }}>Type:</span>
//                         <span className="font-medium capitalize" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.meeting_type}</span>
//                       </div>
//                     </div>
//                   </div>

//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#D1FAE5' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#047857' }}>Key Topics</h4>
//                     {transcription.mom.summary.key_topics.length > 0 ? (
//                       <div className="flex flex-wrap gap-2">
//                         {transcription.mom.summary.key_topics.map((topic, index) => (
//                           <span key={index} className="px-2 py-1 rounded text-sm" style={{ backgroundColor: '#A7F3D0', color: '#065F46' }}>
//                             {topic}
//                           </span>
//                         ))}
//                       </div>
//                     ) : (
//                       <p className="text-sm" style={{ color: '#059669' }}>No key topics identified</p>
//                     )}
//                   </div>
//                 </div>

//                 <div className="mt-6">
//                   <div className="rounded-lg p-4 mb-3" style={{ backgroundColor: '#EFF6FF' }}>
//                     <h4 className="font-medium mb-2" style={{ color: '#1E3A8A' }}>Overview</h4>
//                     <p style={{ color: '#1E3A8A' }}>{transcription.mom.summary.overview}</p>
//                   </div>
//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#F9FAFB' }}>
//                     <h4 className="font-medium mb-2" style={{ color: '#1F2937' }}>Detailed Notes</h4>
//                     <p className="whitespace-pre-wrap" style={{ color: '#374151' }}>{transcription.mom.summary.detailed}</p>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Attendance Tab */}
//             {activeTab === 'attendance' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <Users className="w-5 h-5" />
//                   Meeting Attendance ({transcription.mom.attendance.total_participants})
//                 </h3>

//                 {transcription.mom.attendance.participants.length > 0 ? (
//                   <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
//                     {transcription.mom.attendance.participants.map((participant, index) => (
//                       <div key={index} className="rounded-lg p-4 border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
//                         <div className="flex items-start gap-3">
//                           <User className="w-8 h-8 mt-1" style={{ color: '#9CA3AF' }} />
//                           <div className="flex-1">
//                             <h4 className="font-medium" style={{ color: '#1F2937' }}>{participant.name}</h4>
//                             {participant.role && participant.role !== 'Not specified' && (
//                               <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{participant.role}</p>
//                             )}
//                             <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${participant.attendance_status === 'present'
//                               ? 'bg-green-100 text-green-800'
//                               : 'bg-yellow-100 text-yellow-800'
//                               }`}>
//                               {participant.attendance_status}
//                             </span>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8">
//                     <Users className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
//                     <p style={{ color: '#6B7280' }}>No participants identified in the transcript</p>
//                     <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Try mentioning names and roles during the meeting</p>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Action Items Tab */}
//             {activeTab === 'actions' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <CheckSquare className="w-5 h-5" />
//                   Action Items ({transcription.mom.action_items.length})
//                 </h3>

//                 {transcription.mom.action_items.length > 0 ? (
//                   <div className="space-y-4">
//                     {transcription.mom.action_items.map((item) => (
//                       <div key={item.id} className="border-l-4 p-4 rounded-r-lg" style={{ backgroundColor: '#F9FAFB', borderColor: '#1E3A8A' }}>
//                         <div className="flex items-start justify-between gap-4">
//                           <div className="flex-1">
//                             <div className="flex items-center gap-2 mb-2">
//                               <span className="text-sm font-medium" style={{ color: '#6B7280' }}>#{item.id}</span>
//                               <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}>
//                                 <Flag className="w-3 h-3 inline mr-1" />
//                                 {item.priority} priority
//                               </span>
//                               <span className="px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
//                                 {item.category}
//                               </span>
//                             </div>
//                             <p className="font-medium mb-2" style={{ color: '#1E3A8A' }}>{item.task}</p>
//                             <div className="text-sm space-y-1" style={{ color: '#374151' }}>
//                               {item.assigned_to && item.assigned_to !== 'Not specified' && (
//                                 <p>
//                                   <User className="w-4 h-4 inline mr-1" />
//                                   Assigned to: <span className="font-medium">{item.assigned_to}</span>
//                                 </p>
//                               )}
//                               {item.deadline && item.deadline !== 'N/A' && item.deadline !== 'Not specified' && (
//                                 <p>
//                                   <Calendar className="w-4 h-4 inline mr-1" />
//                                   Deadline: <span className="font-medium">{item.deadline}</span>
//                                 </p>
//                               )}
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8">
//                     <CheckSquare className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
//                     <p style={{ color: '#6B7280' }}>No action items identified</p>
//                     <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Action items will be automatically detected from meeting discussions</p>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Decisions Tab */}
//             {activeTab === 'decisions' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <Target className="w-5 h-5" />
//                   Decisions ({transcription.mom.decisions.length})
//                 </h3>

//                 {transcription.mom.decisions.length > 0 ? (
//                   <div className="space-y-4">
//                     {transcription.mom.decisions.map((decision) => (
//                       <div key={decision.id} className="border rounded-lg p-4" style={{ backgroundColor: '#D1FAE5', borderColor: '#10B981' }}>
//                         <div className="mb-3">
//                           <div className="flex items-center gap-2 mb-2">
//                             <span className="text-sm font-medium" style={{ color: '#6B7280' }}>Decision #{decision.id}</span>
//                           </div>
//                           <h4 className="font-medium text-lg" style={{ color: '#047857' }}>{decision.decision}</h4>
//                         </div>

//                         <div className="grid md:grid-cols-2 gap-4 mt-4">
//                           {decision.rationale && (
//                             <div className="bg-white rounded p-3">
//                               <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Rationale</h5>
//                               <p className="text-sm" style={{ color: '#047857' }}>{decision.rationale}</p>
//                             </div>
//                           )}

//                           {decision.impact && (
//                             <div className="bg-white rounded p-3">
//                               <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Impact</h5>
//                               <p className="text-sm" style={{ color: '#047857' }}>{decision.impact}</p>
//                             </div>
//                           )}

//                           {decision.responsible_party && decision.responsible_party !== 'Not specified' && (
//                             <div className="bg-white rounded p-3">
//                               <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Responsible Party</h5>
//                               <p className="text-sm" style={{ color: '#047857' }}>
//                                 <User className="w-4 h-4 inline mr-1" />
//                                 {decision.responsible_party}
//                               </p>
//                             </div>
//                           )}

//                           {decision.timeline && decision.timeline !== 'Not specified' && (
//                             <div className="bg-white rounded p-3">
//                               <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Timeline</h5>
//                               <p className="text-sm" style={{ color: '#047857' }}>
//                                 <Clock className="w-4 h-4 inline mr-1" />
//                                 {decision.timeline}
//                               </p>
//                             </div>
//                           )}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8">
//                     <Target className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
//                     <p style={{ color: '#6B7280' }}>No decisions identified</p>
//                     <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Decisions will be automatically detected from meeting discussions</p>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Follow-up Tab */}
//             {activeTab === 'followup' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <Clock className="w-5 h-5" />
//                   Follow-up Planning
//                 </h3>

//                 <div className="grid md:grid-cols-3 gap-6">
//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#EFF6FF' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#1E3A8A' }}>Next Meeting</h4>
//                     <p style={{ color: '#1E3A8A' }}>
//                       {transcription.mom.follow_up.next_meeting !== 'TBD' && transcription.mom.follow_up.next_meeting !== 'Not specified'
//                         ? transcription.mom.follow_up.next_meeting
//                         : 'To be determined'}
//                     </p>
//                   </div>

//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#FED7AA' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#9A3412' }}>Pending Items ({transcription.mom.follow_up.pending_items.length})</h4>
//                     {transcription.mom.follow_up.pending_items.length > 0 ? (
//                       <ul className="text-sm space-y-1" style={{ color: '#C2410C' }}>
//                         {transcription.mom.follow_up.pending_items.map((item, index) => (
//                           <li key={index} className="flex items-start gap-2">
//                             <span>•</span>
//                             {item}
//                           </li>
//                         ))}
//                       </ul>
//                     ) : (
//                       <p className="text-sm" style={{ color: '#EA580C' }}>No pending items</p>
//                     )}
//                   </div>

//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#E9D5FF' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#581C87' }}>Required Approvals ({transcription.mom.follow_up.required_approvals.length})</h4>
//                     {transcription.mom.follow_up.required_approvals.length > 0 ? (
//                       <ul className="text-sm space-y-1" style={{ color: '#7C3AED' }}>
//                         {transcription.mom.follow_up.required_approvals.map((approval, index) => (
//                           <li key={index} className="flex items-start gap-2">
//                             <span>•</span>
//                             {approval}
//                           </li>
//                         ))}
//                       </ul>
//                     ) : (
//                       <p className="text-sm" style={{ color: '#9333EA' }}>No approvals needed</p>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Risks & Blockers Tab */}
//             {activeTab === 'risks' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <AlertTriangle className="w-5 h-5" />
//                   Risks & Blockers ({transcription.mom.risks_and_blockers.length})
//                 </h3>

//                 {transcription.mom.risks_and_blockers.length > 0 ? (
//                   <div className="space-y-4">
//                     {transcription.mom.risks_and_blockers.map((risk, index) => (
//                       <div key={index} className="border rounded-lg p-4" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
//                         <div className="flex items-start justify-between gap-4">
//                           <div className="flex-1">
//                             <div className="flex items-center gap-2 mb-2">
//                               <AlertTriangle className="w-5 h-5" style={{ color: '#DC2626' }} />
//                               <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(risk.severity)}`}>
//                                 {risk.severity} severity
//                               </span>
//                             </div>
//                             <p className="font-medium mb-2" style={{ color: '#991B1B' }}>{risk.issue}</p>
//                             {risk.owner && risk.owner !== 'Not specified' && (
//                               <p className="text-sm" style={{ color: '#DC2626' }}>
//                                 <User className="w-4 h-4 inline mr-1" />
//                                 Owner: <span className="font-medium">{risk.owner}</span>
//                               </p>
//                             )}
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8">
//                     <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
//                     <p style={{ color: '#6B7280' }}>No risks or blockers identified</p>
//                     <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Risks and blockers will be automatically detected from meeting discussions</p>
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
// 'use client';

// import React, { useState, useRef, useCallback, useEffect } from 'react';
// import { Calendar, Clock, Users, CheckSquare, AlertTriangle, FileText, User, Target, Flag, Mic, Play, Square, RotateCcw, Radio } from 'lucide-react';

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
//   };
// }

// interface SingleTranscriptionResult {
//   transcript: string;
//   audio_info: {
//     duration: number;
//     sample_rate: number;
//     samples: number;
//     max_amplitude: number;
//   };
// }

// // Declare SpeechRecognition types
// declare global {
//   interface Window {
//     SpeechRecognition: any;
//     webkitSpeechRecognition: any;
//   }
// }

// export default function EnhancedLiveTranscription() {
//   const [isRecording, setIsRecording] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [transcription, setTranscription] = useState<EnhancedTranscriptionResult | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
//   const [activeTab, setActiveTab] = useState<string>('transcript');
//   const [recordingTime, setRecordingTime] = useState(0);
//   const [audioLevel, setAudioLevel] = useState(0);
  
//   // Real-time transcription states
//   const [liveTranscript, setLiveTranscript] = useState<string>('');
//   const [interimTranscript, setInterimTranscript] = useState<string>('');
//   const [isListening, setIsListening] = useState(false);
//   const [speechSupported, setSpeechSupported] = useState(true);

//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const recordedChunksRef = useRef<Blob[]>([]);
//   const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const analyserRef = useRef<AnalyserNode | null>(null);
//   const animationFrameRef = useRef<number | null>(null);
//   const recognitionRef = useRef<any>(null);

//   const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

//   // Check for Speech Recognition support
//   useEffect(() => {
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//     if (!SpeechRecognition) {
//       setSpeechSupported(false);
//       console.warn('Speech Recognition API not supported in this browser');
//     }
//   }, []);

//   const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//   };

//   const startTimer = useCallback(() => {
//     setRecordingTime(0);
//     timerIntervalRef.current = setInterval(() => {
//       setRecordingTime(prev => prev + 1);
//     }, 1000);
//   }, []);

//   const stopTimer = useCallback(() => {
//     if (timerIntervalRef.current) {
//       clearInterval(timerIntervalRef.current);
//       timerIntervalRef.current = null;
//     }
//   }, []);

//   const initAudioLevelMonitoring = useCallback((stream: MediaStream) => {
//     try {
//       const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
//       audioContextRef.current = audioContext;

//       const analyser = audioContext.createAnalyser();
//       analyser.fftSize = 256;
//       analyserRef.current = analyser;

//       const source = audioContext.createMediaStreamSource(stream);
//       source.connect(analyser);

//       const dataArray = new Uint8Array(analyser.frequencyBinCount);

//       const updateAudioLevel = () => {
//         if (!analyserRef.current) return;

//         analyser.getByteFrequencyData(dataArray);

//         const sum = dataArray.reduce((a, b) => a + b, 0);
//         const average = sum / dataArray.length;
//         const normalizedLevel = Math.min(100, (average / 255) * 100);

//         setAudioLevel(normalizedLevel);

//         animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
//       };

//       updateAudioLevel();
//     } catch (error) {
//       console.error('Failed to initialize audio level monitoring:', error);
//     }
//   }, []);

//   const stopAudioLevelMonitoring = useCallback(() => {
//     if (animationFrameRef.current) {
//       cancelAnimationFrame(animationFrameRef.current);
//       animationFrameRef.current = null;
//     }

//     if (audioContextRef.current) {
//       audioContextRef.current.close();
//       audioContextRef.current = null;
//     }

//     analyserRef.current = null;
//     setAudioLevel(0);
//   }, []);

//   // Initialize Speech Recognition
//   const initSpeechRecognition = useCallback(() => {
//     if (!speechSupported) return;

//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//     const recognition = new SpeechRecognition();

//     recognition.continuous = true;
//     recognition.interimResults = true;
//     recognition.lang = 'en-US';

//     recognition.onstart = () => {
//       console.log('Speech recognition started');
//       setIsListening(true);
//     };

//     recognition.onresult = (event: any) => {
//       let interim = '';
//       let final = '';

//       for (let i = event.resultIndex; i < event.results.length; i++) {
//         const transcript = event.results[i][0].transcript;
//         if (event.results[i].isFinal) {
//           final += transcript + ' ';
//         } else {
//           interim += transcript;
//         }
//       }

//       if (final) {
//         setLiveTranscript(prev => prev + final);
//         setInterimTranscript('');
//       }
      
//       if (interim) {
//         setInterimTranscript(interim);
//       }
//     };

//     recognition.onerror = (event: any) => {
//       console.error('Speech recognition error:', event.error);
//       if (event.error !== 'no-speech') {
//         setError(`Speech recognition error: ${event.error}`);
//       }
//     };

//     recognition.onend = () => {
//       console.log('Speech recognition ended');
//       setIsListening(false);
//       // Auto-restart if still recording
//       if (isRecording) {
//         try {
//           recognition.start();
//         } catch (e) {
//           console.log('Recognition restart failed:', e);
//         }
//       }
//     };

//     recognitionRef.current = recognition;
//   }, [speechSupported, isRecording]);

//   // Start speech recognition
//   const startSpeechRecognition = useCallback(() => {
//     if (!speechSupported || !recognitionRef.current) return;

//     try {
//       setLiveTranscript('');
//       setInterimTranscript('');
//       recognitionRef.current.start();
//     } catch (error) {
//       console.error('Failed to start speech recognition:', error);
//     }
//   }, [speechSupported]);

//   // Stop speech recognition
//   const stopSpeechRecognition = useCallback(() => {
//     if (recognitionRef.current) {
//       try {
//         recognitionRef.current.stop();
//         setIsListening(false);
//       } catch (error) {
//         console.error('Failed to stop speech recognition:', error);
//       }
//     }
//   }, []);

//   const initializeRecorder = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           channelCount: 1,
//           sampleRate: 44100,
//           sampleSize: 16,
//           echoCancellation: true,
//           noiseSuppression: false,
//           autoGainControl: true,
//           volume: 1.0
//         }
//       });

//       streamRef.current = stream;
//       initAudioLevelMonitoring(stream);
//       initSpeechRecognition();

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
//         console.log('Recording started');
//         setIsRecording(true);
//         setAudioChunks([]);
//         recordedChunksRef.current = [];
//         setError(null);
//         startTimer();
//         startSpeechRecognition();
//       };

//       mediaRecorder.onstop = () => {
//         console.log('Recording stopped');
//         setIsRecording(false);
//         stopTimer();
//         stopAudioLevelMonitoring();
//         stopSpeechRecognition();

//         if (recordedChunksRef.current.length > 0) {
//           const completeBlob = new Blob(recordedChunksRef.current, { type: selectedMimeType });

//           console.log(`Complete recording: ${completeBlob.size} bytes`);

//           const chunk: AudioChunk = {
//             data: completeBlob,
//             timestamp: Date.now(),
//             index: 0,
//             size: completeBlob.size
//           };

//           setAudioChunks([chunk]);
//         } else {
//           console.warn('No audio data recorded');
//           setError('No audio data was recorded. Please check microphone permissions.');
//         }
//       };

//       mediaRecorder.onerror = (error) => {
//         console.error('MediaRecorder error:', error);
//         setError('Recording error occurred');
//         stopTimer();
//         stopAudioLevelMonitoring();
//         stopSpeechRecognition();
//       };

//       mediaRecorderRef.current = mediaRecorder;
//       return true;

//     } catch (error) {
//       console.error('Failed to initialize recorder:', error);
//       setError(`Failed to initialize recorder: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       return false;
//     }
//   }, [initAudioLevelMonitoring, initSpeechRecognition, startTimer, stopTimer, stopAudioLevelMonitoring, startSpeechRecognition, stopSpeechRecognition]);

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

//       if (chunk.size < 1000) {
//         throw new Error('Audio file too small. Please record for longer duration.');
//       }

//       const formData = new FormData();
//       formData.append('files', chunk.data, 'complete_recording.webm');

//       const response = await fetch(`${BACKEND_URL}/live-speech-to-text/live-chunks`, {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         let errorData;
//         try {
//           errorData = JSON.parse(errorText);
//         } catch {
//           errorData = { detail: errorText || 'Unknown error' };
//         }

//         throw new Error(`HTTP ${response.status}: ${errorData.detail || 'Request failed'}`);
//       }

//       const result: EnhancedTranscriptionResult = await response.json();

//       if (!result.transcript || result.transcript.trim() === '') {
//         setError('No speech was detected in the recording. Please try recording again and speak clearly.');
//       } else {
//         setTranscription(result);
//         setActiveTab('transcript');
//         // Clear live transcript after backend processing
//         setLiveTranscript('');
//         setInterimTranscript('');
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

//       alert(`Chunk ${chunkIndex} transcript: "${result.transcript}"\nDuration: ${result.audio_info.duration.toFixed(2)}s`);

//     } catch (error) {
//       alert(`Failed to test chunk ${chunkIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }, [audioChunks, BACKEND_URL]);

//   const cleanup = useCallback(() => {
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach(track => track.stop());
//       streamRef.current = null;
//     }
//     if (mediaRecorderRef.current) {
//       mediaRecorderRef.current = null;
//     }
//     stopSpeechRecognition();
//     recordedChunksRef.current = [];
//     setIsRecording(false);
//     setAudioChunks([]);
//     setTranscription(null);
//     setError(null);
//     setActiveTab('transcript');
//     stopTimer();
//     stopAudioLevelMonitoring();
//     setRecordingTime(0);
//     setLiveTranscript('');
//     setInterimTranscript('');
//   }, [stopTimer, stopAudioLevelMonitoring, stopSpeechRecognition]);

//   const testMicrophone = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       stream.getTracks().forEach(track => track.stop());
//       alert('Microphone access granted! You can now start recording.');
//     } catch (error) {
//       console.error('Microphone test failed:', error);
//       setError(`Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }, []);

//   useEffect(() => {
//     return () => {
//       cleanup();
//     };
//   }, [cleanup]);

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
//       { id: 'transcript', label: 'Transcript', icon: FileText },
//       { id: 'overview', label: 'Meeting Overview', icon: Calendar },
//       { id: 'attendance', label: 'Attendance', icon: Users },
//       { id: 'actions', label: 'Action Items', icon: CheckSquare },
//       { id: 'decisions', label: 'Decisions', icon: Target },
//       { id: 'followup', label: 'Follow-up', icon: Clock },
//       { id: 'risks', label: 'Risks & Blockers', icon: AlertTriangle }
//     ];

//     return (
//       <div className="border-b mb-6" style={{ borderColor: '#E5E7EB' }}>
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
//                 className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
//                 style={{
//                   borderColor: isActive ? '#1E3A8A' : 'transparent',
//                   color: isActive ? '#1E3A8A' : '#6B7280'
//                 }}
//                 onMouseEnter={(e) => {
//                   if (!isActive) {
//                     e.currentTarget.style.color = '#374151';
//                     e.currentTarget.style.borderColor = '#D1D5DB';
//                   }
//                 }}
//                 onMouseLeave={(e) => {
//                   if (!isActive) {
//                     e.currentTarget.style.color = '#6B7280';
//                     e.currentTarget.style.borderColor = 'transparent';
//                   }
//                 }}
//               >
//                 <Icon className="w-4 h-4" />
//                 {tab.label}
//                 {badge && (
//                   <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
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
//     <div className="w-full">
//       {/* Recording Controls */}
//       <div className="bg-white rounded-xl p-6 mb-6 border" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
//         <h2 className="text-xl font-semibold mb-4" style={{ color: '#1E3A8A' }}>Recording Controls</h2>

//         <div className="flex gap-3 mb-4">
//           <button
//             onClick={testMicrophone}
//             disabled={isRecording || isProcessing}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#1E3A8A' }}
//             onMouseEnter={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#1e40af';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#1E3A8A';
//               }
//             }}
//           >
//             <Mic className="w-5 h-5" />
//             Test Microphone
//           </button>

//           <button
//             onClick={startRecording}
//             disabled={isRecording || isProcessing}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#059669' }}
//             onMouseEnter={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#047857';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#059669';
//               }
//             }}
//           >
//             <Play className="w-5 h-5" />
//           </button>

//           <button
//             onClick={stopRecording}
//             disabled={!isRecording || isProcessing}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: !isRecording || isProcessing ? '#9CA3AF' : '#DC2626' }}
//             onMouseEnter={(e) => {
//               if (!(!isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#B91C1C';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(!isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#DC2626';
//               }
//             }}
//           >
//             <Square className="w-5 h-5" />
//           </button>

//           <button
//             onClick={processAudioChunks}
//             disabled={isRecording || isProcessing || audioChunks.length === 0}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: isRecording || isProcessing || audioChunks.length === 0 ? '#9CA3AF' : '#1E3A8A' }}
//             onMouseEnter={(e) => {
//               if (!(isRecording || isProcessing || audioChunks.length === 0)) {
//                 e.currentTarget.style.backgroundColor = '#1e40af';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(isRecording || isProcessing || audioChunks.length === 0)) {
//                 e.currentTarget.style.backgroundColor = '#1E3A8A';
//               }
//             }}
//           >
//             {isProcessing ? (
//               <>
//                 <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
//                 </svg>
//                 Processing...
//               </>
//             ) : 'Generate Meeting Minutes'}
//           </button>

//           <button
//             onClick={cleanup}
//             disabled={isRecording || isProcessing}
//             className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
//             style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#6B7280' }}
//             onMouseEnter={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#4B5563';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!(isRecording || isProcessing)) {
//                 e.currentTarget.style.backgroundColor = '#6B7280';
//               }
//             }}
//           >
//             <RotateCcw className="w-5 h-5" />
//           </button>
//         </div>

//         {/* Recording Status with Enhanced Audio Level */}
//         {isRecording && (
//           <div className="mb-4 space-y-4">
//             <div className="p-4 rounded-lg border" style={{ backgroundColor: '#D1FAE5', borderColor: '#10B981' }}>
//               <div className="flex items-center justify-between mb-3">
//                 <div className="flex items-center gap-3">
//                   <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#DC2626' }}></div>
//                   <span className="font-medium" style={{ color: '#047857' }}>Recording in progress...</span>
//                   <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border" style={{ borderColor: '#10B981' }}>
//                     <Clock className="w-4 h-4" style={{ color: '#059669' }} />
//                     <span className="font-mono font-semibold" style={{ color: '#047857' }}>{formatTime(recordingTime)}</span>
//                   </div>
//                 </div>
//                 <Mic className="w-5 h-5" style={{ color: '#059669' }} />
//               </div>

//               {/* Enhanced Audio Level Visualizer */}
//               <div className="space-y-2">
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center gap-2">
//                     <Mic className="w-4 h-4" style={{ color: '#047857' }} />
//                     <span className="text-sm font-medium" style={{ color: '#047857' }}>Audio Level</span>
//                   </div>
//                   <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#ECFDF5', color: '#047857' }}>
//                     {audioLevel.toFixed(0)}%
//                   </span>
//                 </div>

//                 {/* Waveform-style bars */}
//                 <div className="flex items-end gap-1 h-16 bg-white rounded-lg p-2 border" style={{ borderColor: '#10B981' }}>
//                   {[...Array(40)].map((_, i) => {
//                     const barHeight = Math.max(10, Math.sin((i + audioLevel) * 0.3) * audioLevel * 0.6 + Math.random() * 20);
//                     const color = audioLevel > 70 ? '#059669' : audioLevel > 30 ? '#F59E0B' : '#DC2626';
//                     return (
//                       <div
//                         key={i}
//                         className="flex-1 rounded-t transition-all duration-100"
//                         style={{
//                           height: `${barHeight}%`,
//                           backgroundColor: color,
//                           opacity: 0.7
//                         }}
//                       />
//                     );
//                   })}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Live Transcription Display */}
//         {(isRecording || liveTranscript || interimTranscript) && (
//           <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
//             <div className="flex items-center gap-2 mb-3">
//               <Radio className="w-5 h-5 animate-pulse" style={{ color: '#1E3A8A' }} />
//               <h3 className="font-semibold" style={{ color: '#1E3A8A' }}>
//                 Live Transcription
//                 {isListening && (
//                   <span className="ml-2 text-sm font-normal" style={{ color: '#059669' }}>● Listening...</span>
//                 )}
//               </h3>
//               {!speechSupported && (
//                 <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
//                   Browser not supported - using audio recording only
//                 </span>
//               )}
//             </div>
            
//             <div className="rounded-lg p-4 max-h-64 overflow-y-auto" style={{ backgroundColor: 'white', border: '1px solid #BFDBFE' }}>
//               {speechSupported ? (
//                 <>
//                   {liveTranscript || interimTranscript ? (
//                     <div className="space-y-2">
//                       {liveTranscript && (
//                         <p className="leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2937' }}>
//                           {liveTranscript}
//                         </p>
//                       )}
//                       {interimTranscript && (
//                         <p className="leading-relaxed whitespace-pre-wrap italic" style={{ color: '#6B7280' }}>
//                           {interimTranscript}
//                         </p>
//                       )}
//                     </div>
//                   ) : (
//                     <p className="text-center italic" style={{ color: '#9CA3AF' }}>
//                       Start speaking to see your words appear here in real-time...
//                     </p>
//                   )}
//                 </>
//               ) : (
//                 <p className="text-center" style={{ color: '#6B7280' }}>
//                   Real-time transcription not available. Your speech will be transcribed after you stop recording.
//                 </p>
//               )}
//             </div>
            
//             {speechSupported && liveTranscript && (
//               <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
//                 <FileText className="w-4 h-4" />
//                 <span>Word count: {liveTranscript.split(/\s+/).filter(Boolean).length}</span>
//               </div>
//             )}
//           </div>
//         )}

//         {/* Audio Chunks Info */}
//         {audioChunks.length > 0 && !isRecording && (
//           <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
//             <h3 className="font-medium mb-2" style={{ color: '#374151' }}>
//               Recorded Audio: {audioChunks.length} file · Duration: {formatTime(recordingTime)}
//               · Size: {(audioChunks.reduce((sum, chunk) => sum + chunk.size, 0) / 1024).toFixed(1)} KB
//             </h3>
//             <div className="flex flex-wrap gap-2">
//               {audioChunks.map((chunk, index) => (
//                 <button
//                   key={chunk.index}
//                   onClick={() => testSingleChunk(index)}
//                   className="px-3 py-1 text-sm rounded font-medium transition-colors"
//                   style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}
//                   title={`Test recording (${(chunk.size / 1024).toFixed(1)} KB)`}
//                   onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DBEAFE'}
//                   onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
//                 >
//                   Test Audio
//                 </button>
//               ))}
//             </div>
//             <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
//               Click "Generate Meeting Minutes" to transcribe and create comprehensive meeting minutes
//             </p>
//           </div>
//         )}
//       </div>

//       {/* Error Display */}
//       {error && (
//         <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
//           <div className="flex">
//             <AlertTriangle className="w-5 h-5" style={{ color: '#DC2626' }} />
//             <div className="ml-3">
//               <h3 className="text-sm font-medium" style={{ color: '#991B1B' }}>Error</h3>
//               <p className="mt-1 text-sm" style={{ color: '#DC2626' }}>{error}</p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Processing Status */}
//       {isProcessing && (
//         <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
//           <div className="flex items-center">
//             <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#1E3A8A' }}></div>
//             <p className="ml-3" style={{ color: '#1E3A8A' }}>Processing audio and generating comprehensive meeting minutes...</p>
//           </div>
//         </div>
//       )}

//       {/* Instructions */}
//       <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#F9FAFB', borderColor: '#F9FAFB' }}>
//         <div className="grid md:grid-cols-2 gap-4">
//           <div>
//             <h4 className="font-medium mb-2" style={{ color: '#1E3A8A' }}>How to Use:</h4>
//             <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: '#374151' }}>
//               <li>Test microphone access</li>
//               <li>Start recording your meeting</li>
//               <li>Watch your words appear in real-time</li>
//               <li>Monitor audio level and recording time</li>
//               <li>Speak clearly, mention names and roles</li>
//               <li>Stop recording when finished</li>
//               <li>Generate comprehensive meeting minutes</li>
//             </ol>
//           </div>
//         </div>
//       </div>

//       {/* Tab Navigation */}
//       {renderTabNavigation()}

//       {/* Results Display */}
//       {transcription && (
//         <div className="space-y-6">
//           {/* Processing Info */}
//           {transcription.processing_info && (
//             <div className="rounded-lg p-4 border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
//               <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E3A8A' }}>Processing Information</h3>
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
//                 <div>
//                   <span className="font-medium" style={{ color: '#374151' }}>Files Processed:</span>
//                   <br />
//                   <span style={{ color: '#6B7280' }}>
//                     {transcription.processing_info.successful_files}/{transcription.processing_info.total_files}
//                   </span>
//                 </div>
//                 <div>
//                   <span className="font-medium" style={{ color: '#374151' }}>Processing Time:</span>
//                   <br />
//                   <span style={{ color: '#6B7280' }}>
//                     {transcription.processing_info.processing_time?.toFixed(2)}s
//                   </span>
//                 </div>
//                 <div>
//                   <span className="font-medium" style={{ color: '#374151' }}>Transcription Time:</span>
//                   <br />
//                   <span style={{ color: '#6B7280' }}>
//                     {transcription.processing_info.transcription_time?.toFixed(2)}s
//                   </span>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Tab Content */}
//           <div className="bg-white rounded-lg p-6 border" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
//             {/* Transcript Tab */}
//             {activeTab === 'transcript' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <FileText className="w-5 h-5" />
//                   Final Transcript
//                 </h3>
//                 <div className="rounded-lg p-4" style={{ backgroundColor: '#F9FAFB' }}>
//                   <p className="leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>
//                     {transcription.transcript || 'No transcript available'}
//                   </p>
//                 </div>
//               </div>
//             )}

//             {/* Meeting Overview Tab */}
//             {activeTab === 'overview' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <Calendar className="w-5 h-5" />
//                   Meeting Overview
//                 </h3>

//                 <div className="grid md:grid-cols-2 gap-6">
//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#EFF6FF' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#1E3A8A' }}>Meeting Details</h4>
//                     <div className="space-y-2 text-sm">
//                       <div className="flex justify-between">
//                         <span style={{ color: '#1E3A8A' }}>Date:</span>
//                         <span className="font-medium" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.date}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span style={{ color: '#1E3A8A' }}>Time/Duration:</span>
//                         <span className="font-medium" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.time}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <span style={{ color: '#1E3A8A' }}>Type:</span>
//                         <span className="font-medium capitalize" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.meeting_type}</span>
//                       </div>
//                     </div>
//                   </div>

//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#D1FAE5' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#047857' }}>Key Topics</h4>
//                     {transcription.mom.summary.key_topics.length > 0 ? (
//                       <div className="flex flex-wrap gap-2">
//                         {transcription.mom.summary.key_topics.map((topic, index) => (
//                           <span key={index} className="px-2 py-1 rounded text-sm" style={{ backgroundColor: '#A7F3D0', color: '#065F46' }}>
//                             {topic}
//                           </span>
//                         ))}
//                       </div>
//                     ) : (
//                       <p className="text-sm" style={{ color: '#059669' }}>No key topics identified</p>
//                     )}
//                   </div>
//                 </div>

//                 <div className="mt-6">
//                   <div className="rounded-lg p-4 mb-3" style={{ backgroundColor: '#EFF6FF' }}>
//                     <h4 className="font-medium mb-2" style={{ color: '#1E3A8A' }}>Overview</h4>
//                     <p style={{ color: '#1E3A8A' }}>{transcription.mom.summary.overview}</p>
//                   </div>
//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#F9FAFB' }}>
//                     <h4 className="font-medium mb-2" style={{ color: '#1F2937' }}>Detailed Notes</h4>
//                     <p className="whitespace-pre-wrap" style={{ color: '#374151' }}>{transcription.mom.summary.detailed}</p>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Attendance Tab */}
//             {activeTab === 'attendance' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <Users className="w-5 h-5" />
//                   Meeting Attendance ({transcription.mom.attendance.total_participants})
//                 </h3>

//                 {transcription.mom.attendance.participants.length > 0 ? (
//                   <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
//                     {transcription.mom.attendance.participants.map((participant, index) => (
//                       <div key={index} className="rounded-lg p-4 border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
//                         <div className="flex items-start gap-3">
//                           <User className="w-8 h-8 mt-1" style={{ color: '#9CA3AF' }} />
//                           <div className="flex-1">
//                             <h4 className="font-medium" style={{ color: '#1F2937' }}>{participant.name}</h4>
//                             {participant.role && participant.role !== 'Not specified' && (
//                               <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{participant.role}</p>
//                             )}
//                             <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${participant.attendance_status === 'present'
//                               ? 'bg-green-100 text-green-800'
//                               : 'bg-yellow-100 text-yellow-800'
//                               }`}>
//                               {participant.attendance_status}
//                             </span>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8">
//                     <Users className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
//                     <p style={{ color: '#6B7280' }}>No participants identified in the transcript</p>
//                     <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Try mentioning names and roles during the meeting</p>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Action Items Tab */}
//             {activeTab === 'actions' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <CheckSquare className="w-5 h-5" />
//                   Action Items ({transcription.mom.action_items.length})
//                 </h3>

//                 {transcription.mom.action_items.length > 0 ? (
//                   <div className="space-y-4">
//                     {transcription.mom.action_items.map((item) => (
//                       <div key={item.id} className="border-l-4 p-4 rounded-r-lg" style={{ backgroundColor: '#F9FAFB', borderColor: '#1E3A8A' }}>
//                         <div className="flex items-start justify-between gap-4">
//                           <div className="flex-1">
//                             <div className="flex items-center gap-2 mb-2">
//                               <span className="text-sm font-medium" style={{ color: '#6B7280' }}>#{item.id}</span>
//                               <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}>
//                                 <Flag className="w-3 h-3 inline mr-1" />
//                                 {item.priority} priority
//                               </span>
//                               <span className="px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
//                                 {item.category}
//                               </span>
//                             </div>
//                             <p className="font-medium mb-2" style={{ color: '#1E3A8A' }}>{item.task}</p>
//                             <div className="text-sm space-y-1" style={{ color: '#374151' }}>
//                               {item.assigned_to && item.assigned_to !== 'Not specified' && (
//                                 <p>
//                                   <User className="w-4 h-4 inline mr-1" />
//                                   Assigned to: <span className="font-medium">{item.assigned_to}</span>
//                                 </p>
//                               )}
//                               {item.deadline && item.deadline !== 'N/A' && item.deadline !== 'Not specified' && (
//                                 <p>
//                                   <Calendar className="w-4 h-4 inline mr-1" />
//                                   Deadline: <span className="font-medium">{item.deadline}</span>
//                                 </p>
//                               )}
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8">
//                     <CheckSquare className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
//                     <p style={{ color: '#6B7280' }}>No action items identified</p>
//                     <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Action items will be automatically detected from meeting discussions</p>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Decisions Tab */}
//             {activeTab === 'decisions' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <Target className="w-5 h-5" />
//                   Decisions ({transcription.mom.decisions.length})
//                 </h3>

//                 {transcription.mom.decisions.length > 0 ? (
//                   <div className="space-y-4">
//                     {transcription.mom.decisions.map((decision) => (
//                       <div key={decision.id} className="border rounded-lg p-4" style={{ backgroundColor: '#D1FAE5', borderColor: '#10B981' }}>
//                         <div className="mb-3">
//                           <div className="flex items-center gap-2 mb-2">
//                             <span className="text-sm font-medium" style={{ color: '#6B7280' }}>Decision #{decision.id}</span>
//                           </div>
//                           <h4 className="font-medium text-lg" style={{ color: '#047857' }}>{decision.decision}</h4>
//                         </div>

//                         <div className="grid md:grid-cols-2 gap-4 mt-4">
//                           {decision.rationale && (
//                             <div className="bg-white rounded p-3">
//                               <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Rationale</h5>
//                               <p className="text-sm" style={{ color: '#047857' }}>{decision.rationale}</p>
//                             </div>
//                           )}

//                           {decision.impact && (
//                             <div className="bg-white rounded p-3">
//                               <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Impact</h5>
//                               <p className="text-sm" style={{ color: '#047857' }}>{decision.impact}</p>
//                             </div>
//                           )}

//                           {decision.responsible_party && decision.responsible_party !== 'Not specified' && (
//                             <div className="bg-white rounded p-3">
//                               <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Responsible Party</h5>
//                               <p className="text-sm" style={{ color: '#047857' }}>
//                                 <User className="w-4 h-4 inline mr-1" />
//                                 {decision.responsible_party}
//                               </p>
//                             </div>
//                           )}

//                           {decision.timeline && decision.timeline !== 'Not specified' && (
//                             <div className="bg-white rounded p-3">
//                               <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Timeline</h5>
//                               <p className="text-sm" style={{ color: '#047857' }}>
//                                 <Clock className="w-4 h-4 inline mr-1" />
//                                 {decision.timeline}
//                               </p>
//                             </div>
//                           )}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8">
//                     <Target className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
//                     <p style={{ color: '#6B7280' }}>No decisions identified</p>
//                     <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Decisions will be automatically detected from meeting discussions</p>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* Follow-up Tab */}
//             {activeTab === 'followup' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <Clock className="w-5 h-5" />
//                   Follow-up Planning
//                 </h3>

//                 <div className="grid md:grid-cols-3 gap-6">
//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#EFF6FF' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#1E3A8A' }}>Next Meeting</h4>
//                     <p style={{ color: '#1E3A8A' }}>
//                       {transcription.mom.follow_up.next_meeting !== 'TBD' && transcription.mom.follow_up.next_meeting !== 'Not specified'
//                         ? transcription.mom.follow_up.next_meeting
//                         : 'To be determined'}
//                     </p>
//                   </div>

//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#FED7AA' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#9A3412' }}>Pending Items ({transcription.mom.follow_up.pending_items.length})</h4>
//                     {transcription.mom.follow_up.pending_items.length > 0 ? (
//                       <ul className="text-sm space-y-1" style={{ color: '#C2410C' }}>
//                         {transcription.mom.follow_up.pending_items.map((item, index) => (
//                           <li key={index} className="flex items-start gap-2">
//                             <span>•</span>
//                             {item}
//                           </li>
//                         ))}
//                       </ul>
//                     ) : (
//                       <p className="text-sm" style={{ color: '#EA580C' }}>No pending items</p>
//                     )}
//                   </div>

//                   <div className="rounded-lg p-4" style={{ backgroundColor: '#E9D5FF' }}>
//                     <h4 className="font-medium mb-3" style={{ color: '#581C87' }}>Required Approvals ({transcription.mom.follow_up.required_approvals.length})</h4>
//                     {transcription.mom.follow_up.required_approvals.length > 0 ? (
//                       <ul className="text-sm space-y-1" style={{ color: '#7C3AED' }}>
//                         {transcription.mom.follow_up.required_approvals.map((approval, index) => (
//                           <li key={index} className="flex items-start gap-2">
//                             <span>•</span>
//                             {approval}
//                           </li>
//                         ))}
//                       </ul>
//                     ) : (
//                       <p className="text-sm" style={{ color: '#9333EA' }}>No approvals needed</p>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Risks & Blockers Tab */}
//             {activeTab === 'risks' && (
//               <div>
//                 <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
//                   <AlertTriangle className="w-5 h-5" />
//                   Risks & Blockers ({transcription.mom.risks_and_blockers.length})
//                 </h3>

//                 {transcription.mom.risks_and_blockers.length > 0 ? (
//                   <div className="space-y-4">
//                     {transcription.mom.risks_and_blockers.map((risk, index) => (
//                       <div key={index} className="border rounded-lg p-4" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
//                         <div className="flex items-start justify-between gap-4">
//                           <div className="flex-1">
//                             <div className="flex items-center gap-2 mb-2">
//                               <AlertTriangle className="w-5 h-5" style={{ color: '#DC2626' }} />
//                               <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(risk.severity)}`}>
//                                 {risk.severity} severity
//                               </span>
//                             </div>
//                             <p className="font-medium mb-2" style={{ color: '#991B1B' }}>{risk.issue}</p>
//                             {risk.owner && risk.owner !== 'Not specified' && (
//                               <p className="text-sm" style={{ color: '#DC2626' }}>
//                                 <User className="w-4 h-4 inline mr-1" />
//                                 Owner: <span className="font-medium">{risk.owner}</span>
//                               </p>
//                             )}
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8">
//                     <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
//                     <p style={{ color: '#6B7280' }}>No risks or blockers identified</p>
//                     <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Risks and blockers will be automatically detected from meeting discussions</p>
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
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Calendar, Clock, Users, CheckSquare, AlertTriangle, FileText, User, Target, Flag, Mic, Play, Square, RotateCcw, Radio } from 'lucide-react';

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

// Declare SpeechRecognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function EnhancedLiveTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<EnhancedTranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [activeTab, setActiveTab] = useState<string>('transcript');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Real-time transcription states
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // Check for Speech Recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      console.warn('Speech Recognition API not supported in this browser');
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = useCallback(() => {
    setRecordingTime(0);
    timerIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const initAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateAudioLevel = () => {
        if (!analyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);

        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 255) * 100);

        setAudioLevel(normalizedLevel);

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (error) {
      console.error('Failed to initialize audio level monitoring:', error);
    }
  }, []);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Initialize Speech Recognition with enhanced continuous listening
  const initSpeechRecognition = useCallback(() => {
    if (!speechSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // Enhanced settings for longer continuous listening
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let restartTimeout: NodeJS.Timeout;
    let silenceTimeout: NodeJS.Timeout;
    let lastSpeechTime = Date.now();

    recognition.onstart = () => {
      console.log('✅ Speech recognition started');
      setIsListening(true);
      lastSpeechTime = Date.now();
    };

    recognition.onspeechstart = () => {
      console.log('🗣️ Speech detected - user started speaking');
    };

    recognition.onspeechend = () => {
      console.log('🔇 Speech ended - user stopped speaking');
    };

    recognition.onaudiostart = () => {
      console.log('🎵 Audio capture started');
    };

    recognition.onaudioend = () => {
      console.log('🔇 Audio capture ended');
    };

    recognition.onsoundstart = () => {
      console.log('🔊 Sound detected');
    };

    recognition.onsoundend = () => {
      console.log('🔇 Sound ended');
    };

    recognition.onresult = (event: any) => {
      console.log('🎤 Speech result received:', event.results.length, 'results');
      
      let interim = '';
      let final = '';

      // Update last speech time when we get results
      lastSpeechTime = Date.now();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        
        console.log(`Result ${i}: "${transcript}" (final: ${event.results[i].isFinal}, confidence: ${confidence})`);
        
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      console.log('Final text:', final, '| Interim text:', interim);

      if (final) {
        console.log('✅ Adding final text to transcript');
        setLiveTranscript(prev => {
          const newTranscript = prev + final;
          console.log('Updated transcript length:', newTranscript.length);
          return newTranscript;
        });
        setInterimTranscript('');
      }
      
      if (interim) {
        console.log('⏳ Showing interim text');
        setInterimTranscript(interim);
      }

      // Clear and reset silence timeout
      clearTimeout(silenceTimeout);
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error, event);
      
      // Handle different error types
      if (event.error === 'no-speech') {
        console.log('⚠️ No speech detected, will auto-restart');
      } else if (event.error === 'audio-capture') {
        setError('Microphone error. Please check your microphone.');
        console.error('Audio capture failed');
      } else if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
        console.error('Microphone permission denied');
      } else if (event.error === 'network') {
        console.log('⚠️ Network error, will auto-restart');
      } else if (event.error === 'aborted') {
        console.log('⚠️ Recognition aborted, will auto-restart');
      } else {
        console.log(`⚠️ Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('🔴 Speech recognition ended');
      setIsListening(false);
      
      // Auto-restart if still recording
      if (isRecording && recognitionRef.current) {
        console.log('🔄 Auto-restarting speech recognition...');
        
        // Clear any existing restart timeout
        clearTimeout(restartTimeout);
        
        // Restart after a short delay to prevent rapid restart loops
        restartTimeout = setTimeout(() => {
          try {
            if (isRecording && recognitionRef.current) {
              recognitionRef.current.start();
              console.log('✅ Speech recognition restarted successfully');
            }
          } catch (e: any) {
            console.log('⚠️ Recognition restart failed:', e.message);
            // If restart fails, try again after a longer delay
            setTimeout(() => {
              try {
                if (isRecording && recognitionRef.current) {
                  recognitionRef.current.start();
                  console.log('✅ Speech recognition restarted on second attempt');
                }
              } catch (err) {
                console.error('❌ Failed to restart recognition on second attempt:', err);
              }
            }, 1000);
          }
        }, 300); // Short delay to prevent immediate restart
      } else {
        console.log('ℹ️ Not restarting - recording stopped');
      }
    };

    recognitionRef.current = recognition;

    // Cleanup function for timeouts
    return () => {
      clearTimeout(restartTimeout);
      clearTimeout(silenceTimeout);
    };
  }, [speechSupported, isRecording]);

  // Start speech recognition
  const startSpeechRecognition = useCallback(() => {
    if (!speechSupported || !recognitionRef.current) return;

    try {
      setLiveTranscript('');
      setInterimTranscript('');
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
    }
  }, [speechSupported]);

  // Stop speech recognition
  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (error) {
        console.error('Failed to stop speech recognition:', error);
      }
    }
  }, []);

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
      initAudioLevelMonitoring(stream);
      initSpeechRecognition();

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
        console.log('Recording started');
        setIsRecording(true);
        setAudioChunks([]);
        recordedChunksRef.current = [];
        setError(null);
        startTimer();
        startSpeechRecognition();
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
        setIsRecording(false);
        stopTimer();
        stopAudioLevelMonitoring();
        stopSpeechRecognition();

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
        stopTimer();
        stopAudioLevelMonitoring();
        stopSpeechRecognition();
      };

      mediaRecorderRef.current = mediaRecorder;
      return true;

    } catch (error) {
      console.error('Failed to initialize recorder:', error);
      setError(`Failed to initialize recorder: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [initAudioLevelMonitoring, initSpeechRecognition, startTimer, stopTimer, stopAudioLevelMonitoring, startSpeechRecognition, stopSpeechRecognition]);

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

      const formData = new FormData();
      formData.append('files', chunk.data, 'complete_recording.webm');

      const response = await fetch(`${BACKEND_URL}/live-speech-to-text/live-chunks`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || 'Unknown error' };
        }

        throw new Error(`HTTP ${response.status}: ${errorData.detail || 'Request failed'}`);
      }

      const result: EnhancedTranscriptionResult = await response.json();

      if (!result.transcript || result.transcript.trim() === '') {
        setError('No speech was detected in the recording. Please try recording again and speak clearly.');
      } else {
        setTranscription(result);
        setActiveTab('transcript');
        // Clear live transcript after backend processing
        setLiveTranscript('');
        setInterimTranscript('');
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

      alert(`Chunk ${chunkIndex} transcript: "${result.transcript}"\nDuration: ${result.audio_info.duration.toFixed(2)}s`);

    } catch (error) {
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
    stopSpeechRecognition();
    recordedChunksRef.current = [];
    setIsRecording(false);
    setAudioChunks([]);
    setTranscription(null);
    setError(null);
    setActiveTab('transcript');
    stopTimer();
    stopAudioLevelMonitoring();
    setRecordingTime(0);
    setLiveTranscript('');
    setInterimTranscript('');
  }, [stopTimer, stopAudioLevelMonitoring, stopSpeechRecognition]);

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

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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
      <div className="border-b mb-6" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

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
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
                style={{
                  borderColor: isActive ? '#1E3A8A' : 'transparent',
                  color: isActive ? '#1E3A8A' : '#6B7280'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#6B7280';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {badge && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
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
    <div className="w-full">
      {/* Recording Controls */}
      <div className="bg-white rounded-xl p-6 mb-6 border" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#1E3A8A' }}>Recording Controls</h2>

        <div className="flex gap-3 mb-4">
          <button
            onClick={testMicrophone}
            disabled={isRecording || isProcessing}
            className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#1E3A8A' }}
            onMouseEnter={(e) => {
              if (!(isRecording || isProcessing)) {
                e.currentTarget.style.backgroundColor = '#1e40af';
              }
            }}
            onMouseLeave={(e) => {
              if (!(isRecording || isProcessing)) {
                e.currentTarget.style.backgroundColor = '#1E3A8A';
              }
            }}
          >
            <Mic className="w-5 h-5" />
            Test Microphone
          </button>

          <button
            onClick={startRecording}
            disabled={isRecording || isProcessing}
            className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#059669' }}
            onMouseEnter={(e) => {
              if (!(isRecording || isProcessing)) {
                e.currentTarget.style.backgroundColor = '#047857';
              }
            }}
            onMouseLeave={(e) => {
              if (!(isRecording || isProcessing)) {
                e.currentTarget.style.backgroundColor = '#059669';
              }
            }}
          >
            <Play className="w-5 h-5" />
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording || isProcessing}
            className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: !isRecording || isProcessing ? '#9CA3AF' : '#DC2626' }}
            onMouseEnter={(e) => {
              if (!(!isRecording || isProcessing)) {
                e.currentTarget.style.backgroundColor = '#B91C1C';
              }
            }}
            onMouseLeave={(e) => {
              if (!(!isRecording || isProcessing)) {
                e.currentTarget.style.backgroundColor = '#DC2626';
              }
            }}
          >
            <Square className="w-5 h-5" />
          </button>

          <button
            onClick={processAudioChunks}
            disabled={isRecording || isProcessing || audioChunks.length === 0}
            className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: isRecording || isProcessing || audioChunks.length === 0 ? '#9CA3AF' : '#1E3A8A' }}
            onMouseEnter={(e) => {
              if (!(isRecording || isProcessing || audioChunks.length === 0)) {
                e.currentTarget.style.backgroundColor = '#1e40af';
              }
            }}
            onMouseLeave={(e) => {
              if (!(isRecording || isProcessing || audioChunks.length === 0)) {
                e.currentTarget.style.backgroundColor = '#1E3A8A';
              }
            }}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : 'Generate Meeting Minutes'}
          </button>

          <button
            onClick={cleanup}
            disabled={isRecording || isProcessing}
            className="px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: isRecording || isProcessing ? '#9CA3AF' : '#6B7280' }}
            onMouseEnter={(e) => {
              if (!(isRecording || isProcessing)) {
                e.currentTarget.style.backgroundColor = '#4B5563';
              }
            }}
            onMouseLeave={(e) => {
              if (!(isRecording || isProcessing)) {
                e.currentTarget.style.backgroundColor = '#6B7280';
              }
            }}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Recording Status with Enhanced Audio Level */}
        {isRecording && (
          <div className="mb-4 space-y-4">
            <div className="p-4 rounded-lg border" style={{ backgroundColor: '#D1FAE5', borderColor: '#10B981' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#DC2626' }}></div>
                  <span className="font-medium" style={{ color: '#047857' }}>Recording in progress...</span>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border" style={{ borderColor: '#10B981' }}>
                    <Clock className="w-4 h-4" style={{ color: '#059669' }} />
                    <span className="font-mono font-semibold" style={{ color: '#047857' }}>{formatTime(recordingTime)}</span>
                  </div>
                </div>
                <Mic className="w-5 h-5" style={{ color: '#059669' }} />
              </div>

              {/* Enhanced Audio Level Visualizer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" style={{ color: '#047857' }} />
                    <span className="text-sm font-medium" style={{ color: '#047857' }}>Audio Level</span>
                  </div>
                  <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#ECFDF5', color: '#047857' }}>
                    {audioLevel.toFixed(0)}%
                  </span>
                </div>

                {/* Waveform-style bars */}
                <div className="flex items-end gap-1 h-16 bg-white rounded-lg p-2 border" style={{ borderColor: '#10B981' }}>
                  {[...Array(40)].map((_, i) => {
                    const barHeight = Math.max(10, Math.sin((i + audioLevel) * 0.3) * audioLevel * 0.6 + Math.random() * 20);
                    const color = audioLevel > 70 ? '#059669' : audioLevel > 30 ? '#F59E0B' : '#DC2626';
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all duration-100"
                        style={{
                          height: `${barHeight}%`,
                          backgroundColor: color,
                          opacity: 0.7
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Transcription Display */}
        {(isRecording || liveTranscript || interimTranscript) && (
          <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-5 h-5 animate-pulse" style={{ color: '#1E3A8A' }} />
              <h3 className="font-semibold" style={{ color: '#1E3A8A' }}>
                Live Transcription
                {isListening && (
                  <span className="ml-2 text-sm font-normal" style={{ color: '#059669' }}>● Listening...</span>
                )}
              </h3>
              {!speechSupported && (
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                  Browser not supported - using audio recording only
                </span>
              )}
            </div>
            
            <div className="rounded-lg p-4 max-h-64 overflow-y-auto" style={{ backgroundColor: 'white', border: '1px solid #BFDBFE' }}>
              {speechSupported ? (
                <>
                  {liveTranscript || interimTranscript ? (
                    <div className="space-y-2">
                      {liveTranscript && (
                        <p className="leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2937' }}>
                          {liveTranscript}
                        </p>
                      )}
                      {interimTranscript && (
                        <p className="leading-relaxed whitespace-pre-wrap italic" style={{ color: '#6B7280' }}>
                          {interimTranscript}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-center italic" style={{ color: '#9CA3AF' }}>
                      Start speaking to see your words appear here in real-time...
                    </p>
                  )}
                </>
              ) : (
                <p className="text-center" style={{ color: '#6B7280' }}>
                  Real-time transcription not available. Your speech will be transcribed after you stop recording.
                </p>
              )}
            </div>
            
            {speechSupported && liveTranscript && (
              <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
                <FileText className="w-4 h-4" />
                <span>Word count: {liveTranscript.split(/\s+/).filter(Boolean).length}</span>
              </div>
            )}
          </div>
        )}

        {/* Audio Chunks Info */}
        {audioChunks.length > 0 && !isRecording && (
          <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h3 className="font-medium mb-2" style={{ color: '#374151' }}>
              Recorded Audio: {audioChunks.length} file · Duration: {formatTime(recordingTime)}
              · Size: {(audioChunks.reduce((sum, chunk) => sum + chunk.size, 0) / 1024).toFixed(1)} KB
            </h3>
            <div className="flex flex-wrap gap-2">
              {audioChunks.map((chunk, index) => (
                <button
                  key={chunk.index}
                  onClick={() => testSingleChunk(index)}
                  className="px-3 py-1 text-sm rounded font-medium transition-colors"
                  style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}
                  title={`Test recording (${(chunk.size / 1024).toFixed(1)} KB)`}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DBEAFE'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                >
                  Test Audio
                </button>
              ))}
            </div>
            <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
              Click "Generate Meeting Minutes" to transcribe and create comprehensive meeting minutes
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
          <div className="flex">
            <AlertTriangle className="w-5 h-5" style={{ color: '#DC2626' }} />
            <div className="ml-3">
              <h3 className="text-sm font-medium" style={{ color: '#991B1B' }}>Error</h3>
              <p className="mt-1 text-sm" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#1E3A8A' }}></div>
            <p className="ml-3" style={{ color: '#1E3A8A' }}>Processing audio and generating comprehensive meeting minutes...</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: '#F9FAFB', borderColor: '#F9FAFB' }}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2" style={{ color: '#1E3A8A' }}>How to Use:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: '#374151' }}>
              <li>Test microphone access</li>
              <li>Start recording your meeting</li>
              <li>Watch your words appear in real-time</li>
              <li>Monitor audio level and recording time</li>
              <li>Speak clearly, mention names and roles</li>
              <li>Stop recording when finished</li>
              <li>Generate comprehensive meeting minutes</li>
            </ol>
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
            <div className="rounded-lg p-4 border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#1E3A8A' }}>Processing Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium" style={{ color: '#374151' }}>Files Processed:</span>
                  <br />
                  <span style={{ color: '#6B7280' }}>
                    {transcription.processing_info.successful_files}/{transcription.processing_info.total_files}
                  </span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: '#374151' }}>Processing Time:</span>
                  <br />
                  <span style={{ color: '#6B7280' }}>
                    {transcription.processing_info.processing_time?.toFixed(2)}s
                  </span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: '#374151' }}>Transcription Time:</span>
                  <br />
                  <span style={{ color: '#6B7280' }}>
                    {transcription.processing_info.transcription_time?.toFixed(2)}s
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content */}
          <div className="bg-white rounded-lg p-6 border" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
            {/* Transcript Tab */}
            {activeTab === 'transcript' && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
                  <FileText className="w-5 h-5" />
                  Final Transcript
                </h3>
                <div className="rounded-lg p-4" style={{ backgroundColor: '#F9FAFB' }}>
                  <p className="leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>
                    {transcription.transcript || 'No transcript available'}
                  </p>
                </div>
              </div>
            )}

            {/* Meeting Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
                  <Calendar className="w-5 h-5" />
                  Meeting Overview
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="rounded-lg p-4" style={{ backgroundColor: '#EFF6FF' }}>
                    <h4 className="font-medium mb-3" style={{ color: '#1E3A8A' }}>Meeting Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span style={{ color: '#1E3A8A' }}>Date:</span>
                        <span className="font-medium" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#1E3A8A' }}>Time/Duration:</span>
                        <span className="font-medium" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#1E3A8A' }}>Type:</span>
                        <span className="font-medium capitalize" style={{ color: '#1F2937' }}>{transcription.mom.meeting_info.meeting_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg p-4" style={{ backgroundColor: '#D1FAE5' }}>
                    <h4 className="font-medium mb-3" style={{ color: '#047857' }}>Key Topics</h4>
                    {transcription.mom.summary.key_topics.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {transcription.mom.summary.key_topics.map((topic, index) => (
                          <span key={index} className="px-2 py-1 rounded text-sm" style={{ backgroundColor: '#A7F3D0', color: '#065F46' }}>
                            {topic}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: '#059669' }}>No key topics identified</p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="rounded-lg p-4 mb-3" style={{ backgroundColor: '#EFF6FF' }}>
                    <h4 className="font-medium mb-2" style={{ color: '#1E3A8A' }}>Overview</h4>
                    <p style={{ color: '#1E3A8A' }}>{transcription.mom.summary.overview}</p>
                  </div>
                  <div className="rounded-lg p-4" style={{ backgroundColor: '#F9FAFB' }}>
                    <h4 className="font-medium mb-2" style={{ color: '#1F2937' }}>Detailed Notes</h4>
                    <p className="whitespace-pre-wrap" style={{ color: '#374151' }}>{transcription.mom.summary.detailed}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Tab */}
            {activeTab === 'attendance' && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
                  <Users className="w-5 h-5" />
                  Meeting Attendance ({transcription.mom.attendance.total_participants})
                </h3>

                {transcription.mom.attendance.participants.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {transcription.mom.attendance.participants.map((participant, index) => (
                      <div key={index} className="rounded-lg p-4 border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
                        <div className="flex items-start gap-3">
                          <User className="w-8 h-8 mt-1" style={{ color: '#9CA3AF' }} />
                          <div className="flex-1">
                            <h4 className="font-medium" style={{ color: '#1F2937' }}>{participant.name}</h4>
                            {participant.role && participant.role !== 'Not specified' && (
                              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{participant.role}</p>
                            )}
                            <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${participant.attendance_status === 'present'
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
                    <Users className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
                    <p style={{ color: '#6B7280' }}>No participants identified in the transcript</p>
                    <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Try mentioning names and roles during the meeting</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Items Tab */}
            {activeTab === 'actions' && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
                  <CheckSquare className="w-5 h-5" />
                  Action Items ({transcription.mom.action_items.length})
                </h3>

                {transcription.mom.action_items.length > 0 ? (
                  <div className="space-y-4">
                    {transcription.mom.action_items.map((item) => (
                      <div key={item.id} className="border-l-4 p-4 rounded-r-lg" style={{ backgroundColor: '#F9FAFB', borderColor: '#1E3A8A' }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium" style={{ color: '#6B7280' }}>#{item.id}</span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}>
                                <Flag className="w-3 h-3 inline mr-1" />
                                {item.priority} priority
                              </span>
                              <span className="px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
                                {item.category}
                              </span>
                            </div>
                            <p className="font-medium mb-2" style={{ color: '#1E3A8A' }}>{item.task}</p>
                            <div className="text-sm space-y-1" style={{ color: '#374151' }}>
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
                    <CheckSquare className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
                    <p style={{ color: '#6B7280' }}>No action items identified</p>
                    <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Action items will be automatically detected from meeting discussions</p>
                  </div>
                )}
              </div>
            )}

            {/* Decisions Tab */}
            {activeTab === 'decisions' && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
                  <Target className="w-5 h-5" />
                  Decisions ({transcription.mom.decisions.length})
                </h3>

                {transcription.mom.decisions.length > 0 ? (
                  <div className="space-y-4">
                    {transcription.mom.decisions.map((decision) => (
                      <div key={decision.id} className="border rounded-lg p-4" style={{ backgroundColor: '#D1FAE5', borderColor: '#10B981' }}>
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium" style={{ color: '#6B7280' }}>Decision #{decision.id}</span>
                          </div>
                          <h4 className="font-medium text-lg" style={{ color: '#047857' }}>{decision.decision}</h4>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                          {decision.rationale && (
                            <div className="bg-white rounded p-3">
                              <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Rationale</h5>
                              <p className="text-sm" style={{ color: '#047857' }}>{decision.rationale}</p>
                            </div>
                          )}

                          {decision.impact && (
                            <div className="bg-white rounded p-3">
                              <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Impact</h5>
                              <p className="text-sm" style={{ color: '#047857' }}>{decision.impact}</p>
                            </div>
                          )}

                          {decision.responsible_party && decision.responsible_party !== 'Not specified' && (
                            <div className="bg-white rounded p-3">
                              <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Responsible Party</h5>
                              <p className="text-sm" style={{ color: '#047857' }}>
                                <User className="w-4 h-4 inline mr-1" />
                                {decision.responsible_party}
                              </p>
                            </div>
                          )}

                          {decision.timeline && decision.timeline !== 'Not specified' && (
                            <div className="bg-white rounded p-3">
                              <h5 className="font-medium mb-1" style={{ color: '#059669' }}>Timeline</h5>
                              <p className="text-sm" style={{ color: '#047857' }}>
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
                    <Target className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
                    <p style={{ color: '#6B7280' }}>No decisions identified</p>
                    <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Decisions will be automatically detected from meeting discussions</p>
                  </div>
                )}
              </div>
            )}

            {/* Follow-up Tab */}
            {activeTab === 'followup' && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
                  <Clock className="w-5 h-5" />
                  Follow-up Planning
                </h3>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="rounded-lg p-4" style={{ backgroundColor: '#EFF6FF' }}>
                    <h4 className="font-medium mb-3" style={{ color: '#1E3A8A' }}>Next Meeting</h4>
                    <p style={{ color: '#1E3A8A' }}>
                      {transcription.mom.follow_up.next_meeting !== 'TBD' && transcription.mom.follow_up.next_meeting !== 'Not specified'
                        ? transcription.mom.follow_up.next_meeting
                        : 'To be determined'}
                    </p>
                  </div>

                  <div className="rounded-lg p-4" style={{ backgroundColor: '#FED7AA' }}>
                    <h4 className="font-medium mb-3" style={{ color: '#9A3412' }}>Pending Items ({transcription.mom.follow_up.pending_items.length})</h4>
                    {transcription.mom.follow_up.pending_items.length > 0 ? (
                      <ul className="text-sm space-y-1" style={{ color: '#C2410C' }}>
                        {transcription.mom.follow_up.pending_items.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span>•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm" style={{ color: '#EA580C' }}>No pending items</p>
                    )}
                  </div>

                  <div className="rounded-lg p-4" style={{ backgroundColor: '#E9D5FF' }}>
                    <h4 className="font-medium mb-3" style={{ color: '#581C87' }}>Required Approvals ({transcription.mom.follow_up.required_approvals.length})</h4>
                    {transcription.mom.follow_up.required_approvals.length > 0 ? (
                      <ul className="text-sm space-y-1" style={{ color: '#7C3AED' }}>
                        {transcription.mom.follow_up.required_approvals.map((approval, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span>•</span>
                            {approval}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm" style={{ color: '#9333EA' }}>No approvals needed</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Risks & Blockers Tab */}
            {activeTab === 'risks' && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: '#1E3A8A' }}>
                  <AlertTriangle className="w-5 h-5" />
                  Risks & Blockers ({transcription.mom.risks_and_blockers.length})
                </h3>

                {transcription.mom.risks_and_blockers.length > 0 ? (
                  <div className="space-y-4">
                    {transcription.mom.risks_and_blockers.map((risk, index) => (
                      <div key={index} className="border rounded-lg p-4" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-5 h-5" style={{ color: '#DC2626' }} />
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(risk.severity)}`}>
                                {risk.severity} severity
                              </span>
                            </div>
                            <p className="font-medium mb-2" style={{ color: '#991B1B' }}>{risk.issue}</p>
                            {risk.owner && risk.owner !== 'Not specified' && (
                              <p className="text-sm" style={{ color: '#DC2626' }}>
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
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
                    <p style={{ color: '#6B7280' }}>No risks or blockers identified</p>
                    <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>Risks and blockers will be automatically detected from meeting discussions</p>
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