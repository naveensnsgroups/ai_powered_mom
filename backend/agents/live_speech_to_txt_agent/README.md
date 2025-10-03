# AI Powered Minutes of Meeting (MoM) - Backend API

A comprehensive FastAPI-based backend service that converts meeting audio recordings into structured Minutes of Meeting using AI-powered transcription, speaker detection, and intelligent content analysis.

## Features

### Core Capabilities
- **Audio Transcription** - Whisper-large-v3 for accurate speech-to-text
- **Speaker Detection** - AI-powered participant identification from audio
- **Noise Reduction** - Advanced audio preprocessing for better quality
- **Multiple Format Support** - WebM, WAV, OGG, MP3, and raw audio
- **Concurrent Processing** - Handle multiple audio files simultaneously
- **Enhanced MoM Generation** - Comprehensive meeting minutes with structured data

### AI-Powered Features
- **Participant Detection** - Automatic identification of meeting attendees
- **Action Item Extraction** - Priority-based task classification
- **Decision Tracking** - Capture decisions with rationale and impact
- **Risk Identification** - Detect risks and blockers mentioned
- **Follow-up Planning** - Next meeting scheduling and pending items
- **Export Functionality** - Generate professional PDF/DOCX reports

## Tech Stack

- **Framework**: FastAPI 0.104+
- **AI Models**: 
  - Whisper-large-v3 (Groq) - Audio transcription
  - Gemini 2.0 Flash (Google) - Content analysis
- **Audio Processing**: 
  - soundfile, noisereduce, pydub
  - FFmpeg for format conversion
- **Document Generation**: 
  - ReportLab (PDF)
  - python-docx (DOCX)
- **LLM Framework**: LangChain
- **Server**: Uvicorn ASGI server

## Prerequisites

- Python 3.9 or higher
- FFmpeg (for audio conversion)
- API Keys:
  - Groq API Key (for Whisper transcription)
  - Google Gemini API Key (for content analysis)

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd backend
```

### 2. Install FFmpeg
**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

### 3. Create Virtual Environment
```bash
python -m venv venv

# Activate on Linux/macOS
source venv/bin/activate

# Activate on Windows
venv\Scripts\activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Configure Environment Variables
Create a `.env` file in the project root:

```env
# API Keys (Required)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Optional: Logging
LOG_LEVEL=INFO
```

**Getting API Keys:**
- **Groq API**: Sign up at [console.groq.com](https://console.groq.com)
- **Gemini API**: Get key from [ai.google.dev](https://ai.google.dev)

### 6. Verify Installation
```bash
python -c "import soundfile, noisereduce, pydub; print('Audio libraries OK')"
ffmpeg -version
```

## Running the Server

### Development Mode
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### With Gunicorn (Production)
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

The API will be available at:
- **API Base**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### Health Check
```http
GET /health
```
Returns comprehensive health status of all services.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1234567890,
  "services": {
    "environment": {"status": "ok"},
    "storage": {"status": "ok", "free_space_gb": 100.5}
  }
}
```

### Live Speech-to-Text Endpoints

#### 1. Process Multiple Audio Chunks
```http
POST /live-speech-to-text/live-chunks
Content-Type: multipart/form-data
```

**Request:**
- Upload one or more audio files (max 50 files)
- Supported formats: WebM, WAV, OGG, MP3

**Response:**
```json
{
  "transcript": "Full meeting transcript...",
  "mom": {
    "meeting_info": {
      "date": "2025-10-03",
      "time": "14:30",
      "meeting_type": "team meeting"
    },
    "attendance": {
      "participants": [
        {
          "name": "John Doe",
          "role": "Project Manager",
          "attendance_status": "present"
        }
      ],
      "total_participants": 5
    },
    "summary": {
      "overview": "Team discussed Q4 planning...",
      "detailed": "Comprehensive discussion notes...",
      "key_topics": ["Q4 Planning", "Budget Review"]
    },
    "action_items": [
      {
        "id": 1,
        "task": "Complete budget proposal",
        "assigned_to": "John Doe",
        "deadline": "2025-10-15",
        "priority": "high",
        "status": "assigned",
        "category": "planning"
      }
    ],
    "decisions": [
      {
        "id": 1,
        "decision": "Approved Q4 marketing budget",
        "rationale": "Strong ROI in Q3",
        "impact": "Increased campaign reach",
        "responsible_party": "Marketing Team",
        "timeline": "Effective October 2025"
      }
    ],
    "follow_up": {
      "next_meeting": "2025-10-10 at 2 PM",
      "pending_items": ["Budget approval", "Team feedback"],
      "required_approvals": ["CFO approval for budget"]
    },
    "risks_and_blockers": [
      {
        "issue": "Resource constraints for Q4",
        "severity": "medium",
        "owner": "Team Lead"
      }
    ]
  },
  "processing_info": {
    "total_files": 3,
    "successful_files": 3,
    "processing_time": 12.5,
    "transcription_time": 8.3,
    "enhanced_features": [
      "participant_detection",
      "priority_classification",
      "decision_tracking"
    ]
  }
}
```

#### 2. Process Single Audio Chunk
```http
POST /live-speech-to-text/live-single
Content-Type: multipart/form-data
```

**Response:**
```json
{
  "transcript": "Transcribed text...",
  "audio_info": {
    "duration": 15.5,
    "sample_rate": 16000,
    "quality_score": 0.85
  },
  "processing_info": {
    "file_size_bytes": 245760,
    "processing_method": "enhanced_single_chunk",
    "noise_reduction_applied": true
  }
}
```

#### 3. Export Enhanced MoM
```http
POST /live-speech-to-text/export-enhanced
Content-Type: application/json
```

**Request:**
```json
{
  "mom": { /* MoM data structure */ },
  "format": "pdf"  // or "docx"
}
```

**Response:**
```json
{
  "export_file": "/tmp/meeting_minutes_12345.pdf",
  "format": "pdf",
  "file_size": 156789,
  "enhanced_features": {
    "participants_included": 5,
    "action_items_included": 8,
    "decisions_included": 3
  }
}
```

### File Download
```http
GET /download?file_path=/tmp/meeting_minutes_12345.pdf
```

Downloads the exported PDF/DOCX file.

## Architecture

### Project Structure
```
backend/
├── main.py                              # FastAPI application entry point
├── agents/
│   ├── live_speech_to_txt_agent/
│   │   ├── core/
│   │   │   ├── agent.py                # Core transcription & MoM logic
│   │   │   └── tools.py                # Audio processing utilities
│   │   └── agent_main.py               # API routes
│   └── speech_to_txt_agent/
│       ├── core/
│       │   └── tools.py                # Export functions
│       └── agent_main.py               # Legacy routes
├── .env                                 # Environment variables
├── requirements.txt                     # Python dependencies
└── README.md                           # This file
```

### Processing Pipeline

1. **Audio Upload** → Multiple files accepted
2. **Format Conversion** → Convert to WAV using FFmpeg/pydub
3. **Audio Enhancement** → Noise reduction, normalization
4. **Transcription** → Whisper-large-v3 via Groq API
5. **Speaker Detection** → AI-powered participant identification
6. **Content Analysis** → Gemini extracts structure
7. **MoM Generation** → Comprehensive minutes created
8. **Export** → PDF/DOCX with professional formatting

### Speaker Detection Flow

1. **Pattern Matching** - Identify names in transcript
2. **Context Analysis** - Find roles and responsibilities
3. **AI Enhancement** - Gemini structures speaker data
4. **Confidence Scoring** - Rate detection accuracy
5. **Fallback Handling** - Generic speakers if needed

## Configuration

### Audio Processing Settings

**Optimal Audio Settings:**
- Sample Rate: 16000 Hz
- Channels: Mono (1)
- Bit Depth: 16-bit
- Format: WAV (PCM)

**Noise Reduction:**
- Stationary noise: Enabled
- Prop decrease: 0.2-0.3
- Threshold: 2.5-3.0 std deviations

### API Limits

- Max file size: 50 MB per file
- Max concurrent files: 50
- File retention: 1 hour
- Request timeout: 300 seconds
- Max workers: 4 (production)

### CORS Configuration

Edit `main.py` to add allowed origins:
```python
origins = [
    "http://localhost:3000",
    "https://yourdomain.com"
]
```

## Testing

### Test Health Check
```bash
curl http://localhost:8000/health
```

### Test Transcription
```bash
curl -X POST "http://localhost:8000/live-speech-to-text/live-single" \
  -F "file=@test_audio.wav"
```

### Load Testing
```bash
pip install locust
locust -f tests/locustfile.py
```

## Troubleshooting

### Common Issues

**1. ImportError: No module named 'soundfile'**
```bash
pip install soundfile
# On Linux, may need: sudo apt install libsndfile1
```

**2. FFmpeg not found**
```bash
# Verify installation
ffmpeg -version

# Add to PATH if needed
export PATH="/path/to/ffmpeg:$PATH"
```

**3. API Key Errors**
- Verify `.env` file exists and contains valid keys
- Check key permissions and quotas
- Restart server after updating `.env`

**4. Memory Issues**
- Reduce max concurrent files in code
- Increase system swap space
- Use production server with more workers

**5. Audio Conversion Fails**
- Check FFmpeg installation
- Verify audio file is not corrupted
- Try converting manually: `ffmpeg -i input.webm output.wav`

**6. Empty Transcripts**
- Ensure audio contains clear speech
- Check audio duration (min 0.5 seconds)
- Verify audio amplitude is sufficient
- Test with known-good audio file

### Debug Mode

Enable detailed logging:
```python
# In main.py
logging.basicConfig(level=logging.DEBUG)
```

View logs:
```bash
tail -f app.log
```

## Performance Optimization

### Production Recommendations

1. **Use Multiple Workers**
   ```bash
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

2. **Enable HTTP/2**
   ```bash
   uvicorn main:app --http h2
   ```

3. **Add Redis Caching** (optional)
   - Cache transcription results
   - Store MoM templates

4. **Use CDN for Exports**
   - Offload file downloads
   - Reduce server load

5. **Database for Persistence** (optional)
   - Store meeting history
   - Enable search functionality

### Monitoring

**Key Metrics to Track:**
- Request latency
- Transcription time
- Success/failure rates
- API quota usage
- Disk space usage
- Memory consumption

## Security Considerations

### Best Practices

1. **API Keys** - Never commit to version control
2. **HTTPS** - Use SSL/TLS in production
3. **Rate Limiting** - Implement per-client limits
4. **Input Validation** - Sanitize all file uploads
5. **Path Traversal** - Validate file paths
6. **File Cleanup** - Auto-delete old files
7. **Authentication** - Add JWT/OAuth if needed

### Environment Variables
```env
# Production settings
ENVIRONMENT=production
DEBUG=false
ALLOWED_HOSTS=yourdomain.com
SECRET_KEY=your_secret_key_here
```

## Deployment

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Build & Run:**
```bash
docker build -t mom-backend .
docker run -p 8000:8000 --env-file .env mom-backend
```

### Cloud Deployment

**AWS EC2:**
```bash
# Install dependencies
sudo apt update
sudo apt install python3-pip ffmpeg

# Deploy application
git clone <repo>
cd backend
pip3 install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Heroku:**
```bash
heroku create mom-backend
heroku config:set GEMINI_API_KEY=xxx GROQ_API_KEY=xxx
git push heroku main
```

## API Rate Limits

### Groq API (Whisper)
- Free tier: 14,400 requests/day
- Rate limit: 30 requests/minute
- Max audio: 25 MB per file

### Google Gemini API
- Free tier: 60 requests/minute
- Daily quota: Varies by region
- Context limit: 1M tokens

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

[Specify your license here]

## Support

- **Issues**: Open a GitHub issue
- **Email**: [your-email@example.com]
- **Documentation**: [docs-url]

## Changelog

### Version 2.0.0 (Current)
- Enhanced speaker detection with AI
- Priority-based action item classification
- Decision tracking with rationale
- Risk and blocker identification
- Comprehensive PDF/DOCX export
- Concurrent file processing

### Version 1.0.0
- Basic audio transcription
- Simple MoM generation
- PDF export

---

**Version**: 2.0.0  
**Last Updated**: 2025-10-03  
**Python**: 3.9+  
**FastAPI**: 0.104+
