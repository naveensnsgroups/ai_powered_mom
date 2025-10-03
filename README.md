AI-Powered Minutes of Meeting (MoM) - Frontend
Overview
A modern, responsive Next.js application that provides an intuitive interface for uploading audio files, generating AI-powered meeting minutes, and exporting them in multiple formats. Built with React, TypeScript, and Tailwind CSS.
Features

Drag & Drop Upload: Intuitive file upload with drag-and-drop support
Real-time Processing: Live progress indicators during transcription
Interactive Editing: Edit transcript and MoM data before export
Multiple Export Formats: Download as PDF or DOCX
Responsive Design: Works seamlessly on desktop and mobile devices
Toast Notifications: Real-time feedback for all user actions
File Validation: Client-side validation for file type and size
Clean UI/UX: Modern, accessible interface with Tailwind CSS

Tech Stack

Framework: Next.js 14+ (App Router)
Language: TypeScript
Styling: Tailwind CSS
UI Components: Custom components with Tailwind
Notifications: React Toastify
HTTP Client: Native Fetch API

Project Structure
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
Installation
Prerequisites

Node.js 18+
npm or yarn or pnpm

Setup

Clone the repository

bashgit clone <your-repo-url>
cd frontend

Install dependencies

bashnpm install
# or
yarn install
# or
pnpm install

Set up environment variables

Create a .env.local file in the frontend root:
envNEXT_PUBLIC_API_URL=http://localhost:8000

Run the development server

bashnpm run dev
# or
yarn dev
# or
pnpm dev

Open in browser

Navigate to http://localhost:3000
Configuration
API Configuration
The API URL is configured via environment variable. Update .env.local:
envNEXT_PUBLIC_API_URL=http://localhost:8000
For production, update to your production API URL:
envNEXT_PUBLIC_API_URL=https://api.yourdomain.com
File Upload Limits
Configured in SpeechToTxtAgent.tsx:
typescriptconst ALLOWED_FILE_TYPES = ["audio/mpeg", "audio/wav", "audio/mp3", "video/mp4"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
Component Structure
Main Component: SpeechToTxtAgent
The primary component handling all audio processing functionality:
Key Features:

File upload with drag-and-drop
File validation (type & size)
API communication
MoM data editing
Export functionality
Toast notifications

State Management:
typescriptinterface MoMType {
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
Usage Guide
1. Upload Audio File
Option A: Drag & Drop

Drag an audio/video file into the upload area
Supported formats: MP3, WAV, MP4
Max size: 50MB

Option B: Click to Browse

Click the upload area
Select file from file picker

2. Choose Export Format
Select export format from dropdown:

None: No automatic export
PDF: Export as PDF document
DOCX: Export as Word document

3. Process File
Click "Transcribe & Generate MoM" button to:

Upload file to backend
Transcribe audio using Whisper AI
Generate structured MoM using Gemini AI
Optionally export to selected format

4. Review & Edit
Edit Transcript:

Click "Edit" button in transcript section
Modify text as needed
Click "Save" to apply changes

Edit MoM:

Click "Edit" button in MoM section
Modify any field:

Title
Summary (Overview & Detailed)
Attendees (one per line)
Tasks (add/remove/edit)
Action Items
Decisions (add/remove/edit)
Risks
Data Points



5. Export
Original MoM:

Click "Download PDF/DOCX" button (if format selected during upload)

Edited MoM:

After editing, click "Export as PDF" or "Export as DOCX"
File downloads automatically

API Integration
Endpoints Used
1. Transcribe Audio
typescriptPOST /speech-to-text/transcribe
- FormData with file and export_format
- Returns transcript and MoM data
2. Export Edited MoM
typescriptPOST /speech-to-text/export-edited
- JSON body with mom and export_format
- Returns export_file path
3. Download File
typescriptGET /download?file_path={path}
- Downloads exported file
4. Cleanup
typescriptPOST /speech-to-text/cleanup
- Removes temporary files
Styling
Tailwind CSS Classes
The application uses Tailwind CSS utility classes for styling:
Color Palette:

Primary: Blue (600-700)
Secondary: Purple (600-700)
Success: Green (50-700)
Warning: Yellow (50-700)
Error: Red (50-700)
Neutral: Slate (50-800)

Key Components:

Gradient backgrounds: bg-gradient-to-r from-blue-600 to-purple-600
Rounded corners: rounded-xl
Shadows: shadow-sm
Hover effects: hover:bg-blue-700

Responsive Design
Breakpoints:

Mobile: Default (< 640px)
Tablet: sm: (≥ 640px)
Desktop: md: (≥ 768px)
Large: lg: (≥ 1024px)

Error Handling
Client-Side Validation
File Type:
typescriptif (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
  toast.error("Invalid file type");
  return;
}
File Size:
typescriptif (selectedFile.size > MAX_FILE_SIZE) {
  toast.error("File size exceeds 50MB limit");
  return;
}
API Error Handling
All API calls include try-catch blocks with user-friendly error messages:
typescripttry {
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
Accessibility

Semantic HTML elements
ARIA labels for interactive elements
Keyboard navigation support
Focus states for all interactive elements
Screen reader friendly

tsx<input
  aria-label="Select audio or video file"
  role="button"
  tabIndex={0}
/>
Performance Optimization

Lazy loading for large components
Debounced API calls
Optimized re-renders with React state
Efficient file handling
Cleanup of temporary resources

Development
Available Scripts
bash# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type checking
npm run type-check
Adding New Features

Create new component in components/
Import in appropriate page
Update TypeScript interfaces if needed
Add corresponding API calls
Test thoroughly

Code Style

Use TypeScript for type safety
Follow React best practices
Use functional components with hooks
Implement proper error handling
Add meaningful comments

Troubleshooting
Common Issues
1. API Connection Failed
Error: Failed to fetch
Solution: 
- Check NEXT_PUBLIC_API_URL in .env.local
- Ensure backend is running on correct port
- Check CORS configuration
2. File Upload Fails
Error: Audio too short to transcribe
Solution:
- Ensure audio contains speech
- Check file is not corrupted
- Verify file size is within limits
3. MoM Not Displaying
Error: Received empty MoM data
Solution:
- Check backend logs for errors
- Verify API response structure
- Check network tab in browser DevTools
4. Export Not Working
Error: Failed to download file
Solution:
- Check backend export endpoints
- Verify file path in API response
- Check browser download permissions
Building for Production
1. Create Production Build
bashnpm run build
2. Test Production Build Locally
bashnpm start
3. Deploy
Vercel (Recommended):
bashvercel deploy
Other Platforms:

Build output is in .next/ directory
Set environment variables on hosting platform
Configure API URL for production

Environment Variables
Production .env.production:
envNEXT_PUBLIC_API_URL=https://your-api-domain.com
Testing
Manual Testing Checklist

 File upload (drag & drop)
 File upload (click to browse)
 File validation (type & size)
 Audio transcription
 MoM generation
 Edit mode toggle
 Save edited data
 Export as PDF
 Export as DOCX
 Download functionality
 Error handling
 Toast notifications
 Responsive design



