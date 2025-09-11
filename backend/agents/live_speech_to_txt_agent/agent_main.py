

# agent_main.py - Enhanced version with updated API endpoints
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from agents.live_speech_to_txt_agent.core.agent import run_live_agent, transcribe_chunk
from agents.live_speech_to_txt_agent.core.tools import (
    save_temp_file, validate_audio, reduce_noise_and_save, load_audio_safe,
    export_enhanced_mom_pdf, export_enhanced_mom_docx
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
async def enhanced_live_transcribe_api(files: List[UploadFile] = File(...)):
    """
    Enhanced API: Process multiple audio chunks for live transcription and comprehensive MoM generation.
    Returns enhanced MoM structure with attendance, detailed action items, decisions, and follow-up planning.
    """
    start_time = time.time()
    temp_paths = []
    processed_chunks = 0
    successful_chunks = 0
    
    try:
        # Validate input
        if not files:
            raise HTTPException(status_code=400, detail="No audio chunks provided.")
        
        if len(files) > 50:
            logger.warning(f"Too many files received: {len(files)}, limiting to first 50")
            files = files[:50]
        
        logger.info(f"Processing {len(files)} audio chunks for enhanced MoM generation")
        
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
            
            error_summary = {}
            for info in file_info:
                status = info.get("status", "unknown")
                error_summary[status] = error_summary.get(status, 0) + 1
            
            error_detail = f"Processing failed for all {len(files)} files. Error summary: {error_summary}"
            
            return {
                "transcript": "",
                "mom": {
                    "meeting_info": {
                        "date": time.strftime("%Y-%m-%d"),
                        "time": "Not specified",
                        "meeting_type": "general meeting"
                    },
                    "attendance": {
                        "participants": [],
                        "total_participants": 0
                    },
                    "summary": {
                        "overview": "No audio content could be processed",
                        "detailed": error_detail,
                        "key_topics": []
                    },
                    "action_items": [],
                    "decisions": [],
                    "follow_up": {
                        "next_meeting": "TBD",
                        "pending_items": [],
                        "required_approvals": []
                    },
                    "risks_and_blockers": []
                },
                "processing_info": {
                    "total_files": len(files),
                    "processed_files": processed_chunks,
                    "successful_files": successful_chunks,
                    "processing_time": processing_time,
                    "file_details": file_info
                }
            }
        
        # Generate enhanced transcripts and MoM
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
                "file_details": file_info[:10],  # Limit details to first 10 files
                "enhanced_features": [
                    "participant_detection",
                    "priority_classification", 
                    "decision_tracking",
                    "risk_identification",
                    "follow_up_planning"
                ]
            }
            
            logger.info(f"Enhanced live transcription completed in {transcription_time:.2f}s")
            logger.info(f"Total processing time: {time.time() - start_time:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"Enhanced transcription/MoM generation failed: {str(e)}")
            
            # Enhanced fallback response
            return {
                "transcript": "Transcription failed",
                "mom": {
                    "meeting_info": {
                        "date": time.strftime("%Y-%m-%d"),
                        "time": "Not specified",
                        "meeting_type": "general meeting"
                    },
                    "attendance": {
                        "participants": [],
                        "total_participants": 0
                    },
                    "summary": {
                        "overview": "Transcription service encountered an error",
                        "detailed": f"Error during enhanced transcription: {str(e)}",
                        "key_topics": []
                    },
                    "action_items": [],
                    "decisions": [],
                    "follow_up": {
                        "next_meeting": "TBD",
                        "pending_items": [],
                        "required_approvals": []
                    },
                    "risks_and_blockers": []
                },
                "processing_info": {
                    "total_files": len(files),
                    "processed_files": processed_chunks,
                    "successful_files": successful_chunks,
                    "audio_chunks": len(audio_chunks),
                    "processing_time": processing_time,
                    "error": str(e),
                    "enhanced_features": ["error_occurred"]
                }
            }
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.exception(f"Unexpected error in enhanced /live-chunks: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Enhanced processing failed: {str(e)[:100]}"
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
async def enhanced_live_transcribe_single(file: UploadFile = File(...)):
    """
    Enhanced API: Process a single audio chunk for live transcription with additional metadata.
    """
    temp_path = None
    
    try:
        file_bytes = await file.read()
        logger.info(f"Processing enhanced single file: {file.filename}, size: {len(file_bytes)} bytes")
        
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
        
        # Enhanced response with quality metrics
        return {
            "transcript": transcript or "",
            "audio_info": {
                "duration": len(audio_data) / sample_rate,
                "sample_rate": sample_rate,
                "samples": len(audio_data),
                "max_amplitude": float(np.max(np.abs(audio_data))),
                "rms_amplitude": float(np.sqrt(np.mean(audio_data ** 2))),
                "quality_score": min(1.0, float(np.max(np.abs(audio_data))) * 2.0)  # Simple quality metric
            },
            "processing_info": {
                "file_size_bytes": len(file_bytes),
                "processing_method": "enhanced_single_chunk",
                "noise_reduction_applied": len(audio_data) >= sample_rate * 0.1
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing enhanced single file: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Enhanced processing failed: {str(e)}"
        )
    
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as ex:
                logger.warning(f"Failed to cleanup {temp_path}: {str(ex)}")

@router.post("/export-enhanced")
async def export_enhanced_mom_endpoint(request_data: dict):
    """
    Enhanced API: Export comprehensive MoM as PDF or DOCX with all new features.
    """
    try:
        mom_data = request_data.get("mom")
        export_format = request_data.get("format", "pdf").lower().strip()
        
        if not mom_data:
            raise HTTPException(status_code=400, detail="No MoM data provided")
        
        if export_format not in ["pdf", "docx"]:
            raise HTTPException(
                status_code=400, 
                detail="Invalid export format. Use 'pdf' or 'docx'"
            )
        
        # Validate enhanced MoM structure
        required_keys = ["meeting_info", "attendance", "summary", "action_items", "decisions"]
        if not all(key in mom_data for key in required_keys):
            raise HTTPException(
                status_code=400,
                detail="Invalid enhanced MoM format. Missing required sections."
            )
        
        # Create temporary file
        suffix = f".{export_format}"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.close()
        
        try:
            # Wrap mom_data to match expected structure for export functions
            export_data = {"mom": mom_data}
            
            if export_format == "pdf":
                output_file_path = export_enhanced_mom_pdf(export_data, output_path=temp_file.name)
            else:  # docx
                output_file_path = export_enhanced_mom_docx(export_data, output_path=temp_file.name)
            
            # Verify file was created
            if not os.path.exists(output_file_path) or os.path.getsize(output_file_path) == 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create enhanced {export_format.upper()} file"
                )
            
            logger.info(f"Enhanced MoM exported as {export_format.upper()}: {output_file_path}")
            
            # Calculate some stats for response
            action_items_count = len(mom_data.get("action_items", []))
            decisions_count = len(mom_data.get("decisions", []))
            participants_count = mom_data.get("attendance", {}).get("total_participants", 0)
            risks_count = len(mom_data.get("risks_and_blockers", []))
            
            return {
                "export_file": output_file_path,
                "format": export_format,
                "file_size": os.path.getsize(output_file_path),
                "created_at": time.time(),
                "enhanced_features": {
                    "participants_included": participants_count,
                    "action_items_included": action_items_count,
                    "decisions_included": decisions_count,
                    "risks_included": risks_count,
                    "follow_up_planning": "follow_up" in mom_data,
                    "priority_classification": any(
                        item.get("priority") for item in mom_data.get("action_items", [])
                    )
                }
            }
            
        except Exception as e:
            # Cleanup on failure
            if os.path.exists(temp_file.name):
                try:
                    os.remove(temp_file.name)
                except Exception:
                    pass
            raise e

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enhanced export error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Enhanced export failed: {str(e)}"
        )

@router.get("/health")
async def enhanced_health_check():
    """Enhanced health check for the live speech-to-text service with feature status."""
    try:
        # Test basic functionality
        test_audio = np.random.normal(0, 0.1, 8000).astype(np.float32)  # 0.5s of noise
        
        # Test transcription (should handle gracefully)
        _ = transcribe_chunk(test_audio, 16000)
        
        return {
            "status": "healthy",
            "service": "enhanced-live-speech-to-text",
            "version": "2.0.0",
            "features": {
                "core_features": [
                    "multi_file_processing",
                    "noise_reduction",
                    "format_conversion",
                    "error_handling",
                    "concurrent_processing"
                ],
                "enhanced_features": [
                    "participant_detection",
                    "priority_classification",
                    "decision_tracking",
                    "risk_identification", 
                    "follow_up_planning",
                    "comprehensive_export"
                ]
            },
            "capabilities": {
                "max_file_size": "50MB per file",
                "max_concurrent_files": 50,
                "supported_formats": ["webm", "wav", "ogg", "mp3"],
                "export_formats": ["pdf", "docx"],
                "ai_models": ["whisper-large-v3", "gemini-2.0-flash"]
            }
        }
    except Exception as e:
        logger.error(f"Enhanced health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Enhanced service unhealthy: {str(e)}"
        )
