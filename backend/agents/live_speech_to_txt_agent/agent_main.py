


# agent_main.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from agents.live_speech_to_txt_agent.core.agent import run_live_agent, transcribe_chunk
from agents.live_speech_to_txt_agent.core.tools import (
    save_temp_file, validate_audio, reduce_noise_and_save, load_audio_safe
)
import os
import logging
import tempfile
import numpy as np
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time

router = APIRouter()
logger = logging.getLogger(__name__)

# Thread pool for CPU-intensive tasks
executor = ThreadPoolExecutor(max_workers=4)

@router.post("/live-chunks")
async def live_transcribe_api(files: List[UploadFile] = File(...)):
    """
    Process multiple audio chunks for live transcription and MoM generation.
    Enhanced with comprehensive error handling and fallback mechanisms.
    """
    start_time = time.time()
    temp_paths = []
    processed_chunks = 0
    successful_chunks = 0
    
    try:
        # Validate input
        if not files:
            raise HTTPException(status_code=400, detail="No audio chunks provided.")
        
        if len(files) > 50:  # Reasonable limit
            logger.warning(f"Too many files received: {len(files)}, limiting to first 50")
            files = files[:50]
        
        logger.info(f"Processing {len(files)} audio chunks")
        
        audio_chunks = []
        sample_rate = 16000
        file_info = []
        
        # Process files concurrently for better performance
        async def process_single_file(file: UploadFile, index: int):
            nonlocal processed_chunks, successful_chunks
            
            try:
                file_bytes = await file.read()
                file_size = len(file_bytes)
                
                logger.debug(f"File {index+1}: {file.filename}, size: {file_size} bytes")
                file_info.append({
                    "index": index,
                    "filename": file.filename,
                    "size": file_size,
                    "status": "processing"
                })
                
                processed_chunks += 1
                
                # Skip tiny files but don't fail the entire request
                if not validate_audio(file_bytes, min_size=50):
                    logger.warning(f"File {index+1} ({file.filename}) too small: {file_size} bytes, skipping")
                    file_info[index]["status"] = "skipped_too_small"
                    return None, None
                
                # Process audio in thread pool to avoid blocking
                loop = asyncio.get_event_loop()
                wav_path = await loop.run_in_executor(
                    executor, 
                    reduce_noise_and_save, 
                    file_bytes, 
                    sample_rate
                )
                
                if not wav_path or not os.path.exists(wav_path):
                    logger.warning(f"File {index+1} processing failed, skipping")
                    file_info[index]["status"] = "processing_failed"
                    return None, None
                
                temp_paths.append(wav_path)
                
                # Load audio data
                try:
                    audio_data, file_sr = load_audio_safe(wav_path)
                    
                    if file_sr != sample_rate:
                        logger.debug(f"Sample rate mismatch: expected {sample_rate}, got {file_sr}")
                    
                    # Validate audio data
                    if len(audio_data) == 0:
                        logger.warning(f"File {index+1} contains no audio data")
                        file_info[index]["status"] = "no_audio_data"
                        return None, None
                    
                    successful_chunks += 1
                    file_info[index]["status"] = "success"
                    file_info[index]["duration"] = len(audio_data) / sample_rate
                    
                    return audio_data, index
                    
                except Exception as e:
                    logger.error(f"Failed to load audio data for file {index+1}: {str(e)}")
                    file_info[index]["status"] = "load_failed"
                    return None, None
                
            except Exception as e:
                logger.error(f"Failed to process file {index+1} ({file.filename}): {str(e)}")
                if index < len(file_info):
                    file_info[index]["status"] = f"error: {str(e)[:50]}"
                return None, None
        
        # Process all files concurrently
        tasks = [process_single_file(file, i) for i, file in enumerate(files)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect successful results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Task failed with exception: {str(result)}")
                continue
            
            audio_data, index = result
            if audio_data is not None:
                audio_chunks.append(audio_data)
        
        processing_time = time.time() - start_time
        logger.info(f"Processed {processed_chunks}/{len(files)} files in {processing_time:.2f}s")
        logger.info(f"Successfully converted {successful_chunks} files to audio chunks")
        
        # Handle case where no files were successfully processed
        if not audio_chunks:
            logger.warning("No audio chunks were successfully processed")
            
            # Provide detailed error information
            error_summary = {}
            for info in file_info:
                status = info.get("status", "unknown")
                error_summary[status] = error_summary.get(status, 0) + 1
            
            error_detail = f"Processing failed for all {len(files)} files. Error summary: {error_summary}"
            
            return {
                "transcript": "",
                "mom": {
                    "summary": {
                        "overview": "No audio content could be processed",
                        "detailed": error_detail
                    },
                    "action_items": [],
                    "decisions": []
                },
                "processing_info": {
                    "total_files": len(files),
                    "processed_files": processed_chunks,
                    "successful_files": successful_chunks,
                    "processing_time": processing_time,
                    "file_details": file_info
                }
            }
        
        # Generate transcripts and MoM
        transcription_start = time.time()
        
        try:
            # Process in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                executor,
                run_live_agent,
                audio_chunks,
                sample_rate
            )
            
            transcription_time = time.time() - transcription_start
            
            # Enhance result with processing information
            result["processing_info"] = {
                "total_files": len(files),
                "processed_files": processed_chunks,
                "successful_files": successful_chunks,
                "audio_chunks": len(audio_chunks),
                "processing_time": processing_time,
                "transcription_time": transcription_time,
                "total_time": time.time() - start_time,
                "file_details": file_info[:10]  # Limit details to first 10 files
            }
            
            logger.info(f"Live transcription completed in {transcription_time:.2f}s")
            logger.info(f"Total processing time: {time.time() - start_time:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"Transcription/MoM generation failed: {str(e)}")
            
            # Fallback response
            return {
                "transcript": "Transcription failed",
                "mom": {
                    "summary": {
                        "overview": "Transcription service encountered an error",
                        "detailed": f"Error during transcription: {str(e)}"
                    },
                    "action_items": [],
                    "decisions": []
                },
                "processing_info": {
                    "total_files": len(files),
                    "processed_files": processed_chunks,
                    "successful_files": successful_chunks,
                    "audio_chunks": len(audio_chunks),
                    "processing_time": processing_time,
                    "error": str(e)
                }
            }
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.exception(f"Unexpected error in /live-chunks: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)[:100]}"
        )
    
    finally:
        # Cleanup temporary files
        cleanup_start = time.time()
        cleanup_count = 0
        
        for path in temp_paths:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                    cleanup_count += 1
                except Exception as ex:
                    logger.warning(f"Failed to cleanup {path}: {str(ex)}")
        
        if cleanup_count > 0:
            cleanup_time = time.time() - cleanup_start
            logger.debug(f"Cleaned up {cleanup_count} temporary files in {cleanup_time:.3f}s")

@router.post("/live-single")
async def live_transcribe_single(file: UploadFile = File(...)):
    """
    Process a single audio chunk for live transcription.
    Simplified endpoint for testing individual chunks.
    """
    temp_path = None
    
    try:
        file_bytes = await file.read()
        logger.info(f"Processing single file: {file.filename}, size: {len(file_bytes)} bytes")
        
        if not validate_audio(file_bytes, min_size=50):
            raise HTTPException(
                status_code=400, 
                detail=f"Audio file too small: {len(file_bytes)} bytes"
            )
        
        # Process audio
        temp_path = reduce_noise_and_save(file_bytes, sample_rate=16000)
        
        if not temp_path or not os.path.exists(temp_path):
            raise HTTPException(
                status_code=400, 
                detail="Failed to process audio file"
            )
        
        # Load and transcribe
        audio_data, sample_rate = load_audio_safe(temp_path)
        
        if len(audio_data) == 0:
            raise HTTPException(
                status_code=400, 
                detail="Audio file contains no data"
            )
        
        # Transcribe single chunk
        transcript = transcribe_chunk(audio_data, sample_rate)
        
        return {
            "transcript": transcript or "",
            "audio_info": {
                "duration": len(audio_data) / sample_rate,
                "sample_rate": sample_rate,
                "samples": len(audio_data),
                "max_amplitude": float(np.max(np.abs(audio_data)))
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing single file: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Processing failed: {str(e)}"
        )
    
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as ex:
                logger.warning(f"Failed to cleanup {temp_path}: {str(ex)}")

@router.get("/health")
async def health_check():
    """Health check for the live speech-to-text service."""
    try:
        # Test basic functionality
        test_audio = np.random.normal(0, 0.1, 8000).astype(np.float32)  # 0.5s of noise
        
        # Test transcription (should handle gracefully)
        _ = transcribe_chunk(test_audio, 16000)
        
        return {
            "status": "healthy",
            "service": "live-speech-to-text",
            "features": [
                "multi-file processing",
                "noise reduction",
                "format conversion",
                "error handling",
                "concurrent processing"
            ]
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Service unhealthy: {str(e)}"
        )