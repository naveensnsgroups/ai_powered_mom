# AI-Powered Minutes of Meeting (MoM) - Frontend

## Overview

A modern, responsive Next.js application that provides an intuitive interface for uploading audio files, generating AI-powered meeting minutes, and exporting them in multiple formats. Built with React, TypeScript, and Tailwind CSS.

## Features

- **Drag & Drop Upload**: Intuitive file upload with drag-and-drop support
- **Real-time Processing**: Live progress indicators during transcription
- **Interactive Editing**: Edit transcript and MoM data before export
- **Multiple Export Formats**: Download as PDF or DOCX
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Toast Notifications**: Real-time feedback for all user actions
- **File Validation**: Client-side validation for file type and size
- **Clean UI/UX**: Modern, accessible interface with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Tailwind
- **Notifications**: React Toastify
- **HTTP Client**: Native Fetch API

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx                    # Home page
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── components/
│   └── SpeechToTxtAgent.tsx        # Main audio processing component
├── public/                         # Static assets
├── .env.local                      # Environment variables (not in repo)
├── next.config.js                  # Next.js configuration
├── tailwind.config.js              # Tailwind CSS configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # Dependencies
└── README.md                       # This file
```

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn or pnpm

### Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd frontend
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the frontend root:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. **Run the development server**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. **Open in browser**

Navigate to [http://localhost:3000](http://localhost:3000)

## Configuration

### API Configuration

The API URL is configured via environment variable. Update `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, update to your production API URL:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### File Upload Limits

Configured in `SpeechToTxtAgent.tsx`:

```typescript
const ALLOWED_FILE_TYPES = ["audio/mpeg", "audio/wav", "audio/mp3", "video/mp4"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
```

## Component Structure

### Main Component: SpeechToTxtAgent

The primary component handling all audio processing functionality:

**Key Features:**
- File upload with drag-and-drop
- File validation (type & size)
- API communication
- MoM data editing
- Export functionality
- Toast notifications

**State Management:**
```typescript
interface MoMType {
  title: string;
  summary: { overview: string; detailed: string } | string;
  overview: string;
  attendees: string[];
  tasks: ActionItem[];
  action_items: string[];
  decisions: Decision[];
  risks: string[];
  data_points: string[];
}
```

## Usage Guide

### 1. Upload Audio File

**Option A: Drag & Drop**
- Drag an audio/video file into the upload area
- Supported formats: MP3, WAV, MP4
- Max size: 50MB

**Option B: Click to Browse**
- Click the upload area
- Select file from file picker

### 2. Choose Export Format

Select export format from dropdown:
- **None**: No automatic export
- **PDF**: Export as PDF document
- **DOCX**: Export as Word document

### 3. Process File

Click "Transcribe & Generate MoM" button to:
- Upload file to backend
- Transcribe audio using Whisper AI
- Generate structured MoM using Gemini AI
- Optionally export to selected format

### 4. Review & Edit

**Edit Transcript:**
- Click "Edit" button in transcript section
- Modify text as needed
- Click "Save" to apply changes

**Edit MoM:**
- Click "Edit" button in MoM section
- Modify any field:
  - Title
  - Summary (Overview & Detailed)
  - Attendees (one per line)
  - Tasks (add/remove/edit)
  - Action Items
  - Decisions (add/remove/edit)
  - Risks
  - Data Points

### 5. Export

**Original MoM:**
- Click "Download PDF/DOCX" button (if format selected during upload)

**Edited MoM:**
- After editing, click "Export as PDF" or "Export as DOCX"
- File downloads automatically

## API Integration

### Endpoints Used

**1. Transcribe Audio**
```typescript
POST /speech-to-text/transcribe
- FormData with file and export_format
- Returns transcript and MoM data
```

**2. Export Edited MoM**
```typescript
POST /speech-to-text/export-edited
- JSON body with mom and export_format
- Returns export_file path
```

**3. Download File**
```typescript
GET /download?file_path={path}
- Downloads exported file
```

**4. Cleanup**
```typescript
POST /speech-to-text/cleanup
- Removes temporary files
```

## Styling

### Tailwind CSS Classes

The application uses Tailwind CSS utility classes for styling:

**Color Palette:**
- Primary: Blue (600-700)
- Secondary: Purple (600-700)
- Success: Green (50-700)
- Warning: Yellow (50-700)
- Error: Red (50-700)
- Neutral: Slate (50-800)

**Key Components:**
- Gradient backgrounds: `bg-gradient-to-r from-blue-600 to-purple-600`
- Rounded corners: `rounded-xl`
- Shadows: `shadow-sm`
- Hover effects: `hover:bg-blue-700`

### Responsive Design

Breakpoints:
- Mobile: Default (< 640px)
- Tablet: `sm:` (≥ 640px)
- Desktop: `md:` (≥ 768px)
- Large: `lg:` (≥ 1024px)

## Error Handling

### Client-Side Validation

**File Type:**
```typescript
if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
  toast.error("Invalid file type");
  return;
}
```

**File Size:**
```typescript
if (selectedFile.size > MAX_FILE_SIZE) {
  toast.error("File size exceeds 50MB limit");
  return;
}
```

### API Error Handling

All API calls include try-catch blocks with user-friendly error messages:

```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail);
  }
  // Handle success
} catch (err: any) {
  toast.error(err.message || "An error occurred");
  console.error(err);
}
```

## Accessibility

- Semantic HTML elements
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus states for all interactive elements
- Screen reader friendly

```tsx
<input
  aria-label="Select audio or video file"
  role="button"
  tabIndex={0}
/>
```

## Performance Optimization

- Lazy loading for large components
- Debounced API calls
- Optimized re-renders with React state
- Efficient file handling
- Cleanup of temporary resources

## Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type checking
npm run type-check
```

### Adding New Features

1. Create new component in `components/`
2. Import in appropriate page
3. Update TypeScript interfaces if needed
4. Add corresponding API calls
5. Test thoroughly

### Code Style

- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Implement proper error handling
- Add meaningful comments

## Troubleshooting

### Common Issues

**1. API Connection Failed**
```
Error: Failed to fetch
Solution: 
- Check NEXT_PUBLIC_API_URL in .env.local
- Ensure backend is running on correct port
- Check CORS configuration
```

**2. File Upload Fails**
```
Error: Audio too short to transcribe
Solution:
- Ensure audio contains speech
- Check file is not corrupted
- Verify file size is within limits
```

**3. MoM Not Displaying**
```
Error: Received empty MoM data
Solution:
- Check backend logs for errors
- Verify API response structure
- Check network tab in browser DevTools
```

**4. Export Not Working**
```
Error: Failed to download file
Solution:
- Check backend export endpoints
- Verify file path in API response
- Check browser download permissions
```
# Enhanced Meeting Live Transcription & Minutes Generator

An AI-powered meeting transcription system with automatic speaker detection, action item tracking, and comprehensive meeting analysis. This application records live audio, processes it through a backend API, and generates structured meeting minutes with insights.

## Features

### Core Capabilities
- **Live Audio Recording** - High-quality audio capture with configurable sample rates
- **Automatic Speaker Detection** - AI-powered identification of meeting participants
- **Real-time Transcription** - Convert speech to text with noise reduction
- **Meeting Minutes Generation** - Automatic creation of structured MoM documents
- **Action Item Tracking** - Identification and categorization of tasks with priorities
- **Decision Documentation** - Capture decisions with rationale and impact analysis
- **Risk & Blocker Identification** - Automatic detection of issues and obstacles
- **Export Functionality** - Generate PDF or DOCX reports

### Enhanced Features
- Multi-tab interface for organized information display
- Audio quality analysis and testing
- Real-time recording duration tracking
- Processing time metrics and statistics
- Noise reduction and audio enhancement
- Participant attendance tracking with roles
- Follow-up planning with next meeting scheduling
- Required approvals tracking

## Tech Stack

- **Frontend**: React 18+ with TypeScript
- **UI Framework**: Next.js (Client Components)
- **Icons**: Lucide React
- **Audio Processing**: MediaRecorder API
- **Backend Communication**: Fetch API
- **State Management**: React Hooks (useState, useRef, useCallback)

## Prerequisites

- Node.js 16+ and npm/yarn
- Modern browser with MediaRecorder API support
- Microphone access permissions
- Backend API server running (see Backend Setup section)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd enhanced-meeting-transcription
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure environment variables:
```bash
# Create .env.local file
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Backend Setup

This frontend requires a compatible backend API. The backend should provide these endpoints:

### Required API Endpoints

**1. Live Chunks Processing**
```
POST /live-speech-to-text/live-chunks
Content-Type: multipart/form-data

Body: { files: [audio files] }

Response: EnhancedTranscriptionResult (see interfaces below)
```

**2. Single Chunk Testing**
```
POST /live-speech-to-text/live-single
Content-Type: multipart/form-data

Body: { file: audio file }

Response: SingleTranscriptionResult
```

**3. Export MoM**
```
POST /live-speech-to-text/export-enhanced
Content-Type: application/json

Body: { mom: MoMObject, format: "pdf" | "docx" }

Response: { export_file: string, enhanced_features: string[] }
```

**4. File Download**
```
GET /download?file_path=<path>

Response: File blob
```

## Usage Guide

### Recording a Meeting

1. **Test Microphone**
   - Click "Test Microphone" to verify audio access
   - Grant browser permissions when prompted

2. **Start Recording**
   - Click "Start Recording" to begin capturing audio
   - Speak clearly and mention participant names
   - Recording duration displays in real-time

3. **Stop Recording**
   - Click "Stop Recording" when the meeting ends
   - Audio is automatically prepared for processing

4. **Generate Minutes**
   - Click "Generate Meeting Minutes" to process the recording
   - AI analyzes audio for speakers, actions, decisions, and risks
   - Processing typically takes 10-30 seconds

5. **Review & Export**
   - Navigate through tabs to review different sections
   - Select export format (PDF or DOCX)
   - Click "Export" to download the document

### Best Practices for Optimal Results

**For Speaker Detection:**
- Begin meetings with introductions ("Hi, I'm John from Marketing")
- Use names in conversation ("Sarah, what do you think?")
- Mention roles and responsibilities
- Record for at least 15-30 seconds
- Minimize background noise

**For Action Items:**
- Be explicit: "John will handle the client presentation"
- State deadlines clearly: "by Friday" or "end of month"
- Use action verbs: "I'll do", "We need to", "Please complete"
- Assign clear ownership of tasks

**For Decisions:**
- Use decision language: "We decided...", "It was agreed..."
- Explain reasoning behind decisions
- Mention implementation owners
- Include timelines for execution

## Component Structure

### Main Component: `EnhancedLiveTranscription`

**State Management:**
- `isRecording` - Recording status
- `isProcessing` - Processing status
- `transcription` - Complete transcription result with MoM
- `audioChunks` - Recorded audio data
- `activeTab` - Current view tab
- `recordingDuration` - Timer in seconds
- `exportFormat` - Selected export format (pdf/docx)

**Key Functions:**
- `initializeRecorder()` - Sets up MediaRecorder with optimal settings
- `startRecording()` - Begins audio capture
- `stopRecording()` - Ends recording session
- `processAudioChunks()` - Sends audio to backend for analysis
- `exportMoM()` - Generates and downloads meeting minutes
- `testMicrophone()` - Verifies audio permissions

## Data Interfaces

### EnhancedTranscriptionResult
```typescript
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
    enhanced_features: string[];
  };
}
```

## UI Sections

### 1. Meeting Overview
- Meeting metadata (date, time, type)
- Participant count and outcomes summary
- Executive overview and key topics

### 2. Attendance
- Grid view of all participants
- Roles and attendance status
- Auto-detection indicators

### 3. Transcript
- Full meeting transcript
- Word count and quality metrics
- Monospace formatting for clarity

### 4. Action Items
- Priority-based color coding (High/Medium/Low)
- Assigned owners and deadlines
- Category classification
- Task status tracking

### 5. Decisions
- Decision statements with rationale
- Impact analysis
- Implementation owners
- Execution timelines

### 6. Follow-up Planning
- Next meeting scheduling
- Pending items tracking
- Required approvals list

### 7. Risks & Blockers
- Severity-based classification
- Issue descriptions
- Resolution owners

## Audio Configuration

The application uses optimized audio settings:

```javascript
{
  channelCount: 1,           // Mono audio
  sampleRate: 44100,         // CD quality
  sampleSize: 16,            // 16-bit depth
  echoCancellation: true,    // Remove echo
  noiseSuppression: false,   // Backend handles this
  autoGainControl: true,     // Normalize volume
  volume: 1.0               // Full volume
}
```

Supported MIME types (in order of preference):
1. `audio/wav`
2. `audio/webm;codecs=opus`
3. `audio/webm`
4. `audio/ogg;codecs=opus`

## Troubleshooting

### No Audio Recorded
- Check microphone permissions in browser
- Verify microphone is not used by another application
- Test with "Test Microphone" button
- Ensure audio input device is selected in system settings

### Empty Transcript
- Record for at least 15 seconds with clear speech
- Speak louder or closer to microphone
- Reduce background noise
- Check audio chunk size (should be > 2KB)

### No Participants Detected
- Use names explicitly in conversation
- Include introductions at meeting start
- Mention roles and titles
- Ensure multiple speakers are present

### Processing Fails
- Check backend API is running and accessible
- Verify NEXT_PUBLIC_BACKEND_URL is correct
- Check network connectivity
- Review browser console for error details

### Export Issues
- Ensure backend has write permissions for exports
- Check disk space on backend server
- Verify export endpoints are accessible

## Browser Compatibility

- Chrome 60+ 
- Firefox 55+ 
- Safari 14+ 
- Edge 79+ 

**Note**: MediaRecorder API support required. Some mobile browsers may have limitations.

## Security Considerations

- Audio data is transmitted to backend for processing
- No client-side storage of audio recordings
- Ensure backend API uses HTTPS in production
- Implement authentication/authorization as needed
- Consider data retention policies for recordings

## Performance Optimization

- Audio recorded in 1-second chunks
- Lazy loading of UI components
- Efficient state management with useCallback
- Minimal re-renders with proper dependencies
- Audio cleanup on component unmount





