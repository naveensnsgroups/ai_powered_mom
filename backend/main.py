

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Import the router for the speech-to-text agent
from agents.speech_to_txt_agent.agent_main import router as speech_router

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="AI Powered MOM (Minutes of Meeting)")

# ---------------- CORS Setup ---------------- #
origins = [os.getenv("FRONTEND_URL", "http://localhost:3000")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Register Routers ---------------- #
app.include_router(
    speech_router,
    prefix="/speech-to-text",
    tags=["Speech-to-Text Agent"]
)

# ---------------- Health Check ---------------- #
@app.get("/")
async def root():
    return {"message": "Backend is running 🚀"}
