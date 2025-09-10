from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Import router directly from agent_main
from agents.speech_to_txt_agent.agent_main import router as speech_router

load_dotenv()

app = FastAPI(title="AI Powered MOM (Minutes of Meeting)")

# ✅ CORS setup
origins = [os.getenv("FRONTEND_URL", "http://localhost:3000")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Register Routers
app.include_router(speech_router,prefix="/speech-to-text",tags=["Speech-to-Text Agent"])

@app.get("/")
async def root():
    return {"message": "Backend is running 🚀"}
