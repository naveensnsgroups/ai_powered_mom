# AI Powered Minutes of Meeting (MoM) - Backend

A FastAPI-based backend service that converts audio recordings into structured Minutes of Meeting using AI. The system uses Whisper for transcription and Google Gemini for intelligent content analysis.

## Features

- **Audio Transcription**: Converts audio files to text using OpenAI Whisper
- **Intelligent MoM Generation**: Extracts structured meeting information using Google Gemini
- **Multiple Export Formats**: Supports PDF and DOCX export
- **Live Audio Processing**: Real-time audio chunk processing with noise reduction
- **RESTful API**: Clean API endpoints for easy integration
- **File Management**: Automatic cleanup of temporary files
- **Health Monitoring**: Comprehensive health check endpoints

## Tech Stack

- **Framework**: FastAPI
- **AI Models**: 
  - OpenAI Whisper (audio transcription)
  - Google Gemini 2.0 Flash (content analysis)
  - Groq API (live transcription)
- **LangChain**: For AI agent orchestration
- **Audio Processing**: PyDub, Whisper
- **Document Generation**: FPDF, python-docx
- **Environment Management**: python-dotenv

## Project Structure

```
backend/
├── agents/
│   ├── speech_to_txt_agent/
│   │   ├── core/
│   │   │   ├── agent.py          # Main agent logic
│   │   │   └── tools.py          # Helper functions
│   │   └── agent_main.py         # API routes
│   └── live_speech_to_txt_agent/
│       ├── core/
│       │   └── agent.py          # Live audio processing
│       └── agent_main.py         # Live API routes
├── main.py                       # FastAPI application entry point
├── .env                          # Environment variables
├── requirements.txt              # Python dependencies
└── app.log                       # Application logs
```

## Prerequisites

- Python 3.8 or higher
- FFmpeg (for audio processing)
- Google Gemini API Key
- Groq API Key (for live transcription)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd backend
```

### 2. Create Virtual Environment

```bash
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Install FFmpeg

**Windows:**
- Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- Add to PATH

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

### 5. Configure Environment Variables

Create a `.env` file in the backend directory:

```env
# API Keys
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
```

## Running the Application

### Development Mode

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### Health Check

```http
GET /health
```

Returns comprehensive health status of the service.

### Root Information

```http
GET /
```

Returns API information and available endpoints.

### Audio Transcription

```http
POST /speech-to-text/transcribe
Content-Type: multipart/form-data

Parameters:
- file: Audio file (MP3, WAV, MP4)
- export_format: "none" | "pdf" | "docx"
```

**Response:**
```json
{
  "transcript": "Meeting transcript...",
  "mom": {
    "title": "Meeting Title",
    "summary": {
      "overview": "Brief overview",
      "detailed": "Detailed summary"
    },
    "attendees": ["Person 1", "Person 2"],
    "tasks": [{
      "task": "Task description",
      "assigned_to": "Person name",
      "deadline": "2025-01-15"
    }],
    "action_items": ["Action 1", "Action 2"],
    "decisions": [{
      "decision": "Decision made",
      "participant": "Decision maker"
    }],
    "risks": ["Risk 1"],
    "data_points": ["Metric 1"]
  },
  "export_file": "/path/to/file.pdf"
}
```

### Export Edited MoM

```http
POST /speech-to-text/export-edited
Content-Type: application/json

{
  "mom": { /* MoM object */ },
  "export_format": "pdf"
}
```

### File Download

```http
GET /download?file_path=/path/to/file
```

Downloads the generated PDF or DOCX file.

### File Cleanup

```http
POST /speech-to-text/cleanup
Content-Type: application/json

{
  "file_path": "/path/to/file"
}
```

### Live Audio Processing

```http
POST /live-speech-to-text/process-chunk
Content-Type: multipart/form-data

Parameters:
- chunk: Audio chunk (binary)
- chunk_index: Integer
- is_final: Boolean
```

## MoM Structure

The system generates structured Minutes of Meeting with the following fields:

- **Title**: Auto-generated meeting title
- **Summary**: Overview and detailed summary
- **Overview**: Context and agenda points
- **Attendees**: List of participants with roles
- **Tasks**: Actionable items with assignments and deadlines
- **Action Items**: List of next steps
- **Decisions**: Key decisions with responsible persons
- **Risks**: Identified risks, blockers, or challenges
- **Data Points**: Metrics, numbers, or facts mentioned

## Configuration

### Whisper Model Selection

In `agents/speech_to_txt_agent/core/agent.py`:

```python
whisper_model = whisper.load_model("base")
# Options: tiny, base, small, medium, large
```

### Gemini Model Configuration

```python
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.2,
    verbose=True,
    api_key=GEMINI_API_KEY
)
```

## Error Handling

The application includes comprehensive error handling:

- File validation (type, size)
- API connection verification
- Automatic file cleanup
- Detailed error logging
- User-friendly error messages

## Logging

Logs are written to:
- Console output
- `app.log` file

Log format:
```
%(asctime)s - %(name)s - %(levelname)s - %(message)s
```

## Security Features

- CORS configuration
- Trusted host middleware
- Path traversal prevention
- File expiration (1 hour)
- Request logging
- Input validation

## Performance Considerations

- Temporary file cleanup
- Automatic expired file removal
- Efficient audio processing
- Async request handling
- Connection pooling

## Troubleshooting

### Common Issues

**1. FFmpeg Not Found**
```bash
# Install FFmpeg as per installation instructions
# Verify installation
ffmpeg -version
```

**2. API Key Errors**
- Verify `.env` file exists
- Check API key validity
- Ensure no extra spaces in keys

**3. Port Already in Use**
```bash
# Change port in uvicorn command
uvicorn main:app --port 8001
```

**4. Import Errors**
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Debug Mode

Enable verbose logging by setting log level to DEBUG in `main.py`:

```python
logging.basicConfig(level=logging.DEBUG)
```

## API Rate Limits

Be aware of API rate limits:
- **Gemini API**: Check your quota
- **Groq API**: Check your plan limits

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

[Specify your license here]

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review API logs in `app.log`

## Acknowledgments

- OpenAI Whisper for transcription
- Google Gemini for AI analysis
- FastAPI framework
- LangChain for agent orchestration
