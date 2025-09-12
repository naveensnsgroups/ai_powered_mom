
# import tempfile
# import numpy as np
# import soundfile as sf
# import noisereduce as nr
# from typing import Dict, List, Optional, Tuple
# from agents.live_speech_to_txt_agent.core.agent import transcribe_chunk, run_live_agent
# from pydub import AudioSegment
# import io
# import os
# import logging
# import subprocess
# import wave
# import struct

# logger = logging.getLogger(__name__)

# # ---------------- Helper Functions (unchanged from original) ---------------- #

# def save_temp_file(file_bytes: bytes, suffix: str = ".wav") -> str:
#     """Save uploaded audio temporarily and return the file path."""
#     with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
#         tmp.write(file_bytes)
#         return tmp.name

# def validate_audio(file_bytes: bytes, min_size: int = 100) -> bool:
#     """Validate audio file size (more lenient for chunks)."""
#     return len(file_bytes) >= min_size

# def is_valid_webm(file_bytes: bytes) -> bool:
#     """Check if bytes contain a valid WebM file header."""
#     if len(file_bytes) < 4:
#         return False
    
#     # WebM files start with EBML header (0x1A45DFA3)
#     webm_signature = b'\x1a\x45\xdf\xa3'
#     return file_bytes[:4] == webm_signature

# def convert_raw_audio_to_wav(audio_bytes: bytes, sample_rate: int = 16000) -> Optional[str]:
#     """
#     Convert raw audio bytes to WAV format using multiple fallback methods.
#     Returns WAV file path or None if conversion fails.
#     """
#     temp_paths_to_cleanup = []
    
#     try:
#         # Method 1: Try direct WAV creation if it's raw PCM data
#         if len(audio_bytes) % 2 == 0:  # Assume 16-bit samples
#             try:
#                 # Convert bytes to numpy array (assuming 16-bit PCM)
#                 audio_data = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                
#                 # Create WAV file
#                 wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
#                 sf.write(wav_path, audio_data, sample_rate)
                
#                 # Verify the file was created successfully
#                 if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:  # WAV header is 44 bytes
#                     logger.info(f"Successfully converted raw PCM to WAV: {wav_path}")
#                     return wav_path
#                 else:
#                     os.remove(wav_path) if os.path.exists(wav_path) else None
#             except Exception as e:
#                 logger.debug(f"Raw PCM conversion failed: {str(e)}")
        
#         # Method 2: Save as temporary file and try pydub
#         temp_input = save_temp_file(audio_bytes, suffix=".webm")
#         temp_paths_to_cleanup.append(temp_input)
        
#         try:
#             audio_seg = AudioSegment.from_file(temp_input)
#             audio_seg = audio_seg.set_channels(1).set_frame_rate(sample_rate)
            
#             wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
#             audio_seg.export(wav_path, format="wav")
            
#             if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
#                 logger.info(f"Successfully converted using pydub: {wav_path}")
#                 return wav_path
#             else:
#                 os.remove(wav_path) if os.path.exists(wav_path) else None
                
#         except Exception as e:
#             logger.debug(f"pydub conversion failed: {str(e)}")
        
#         # Method 3: Try FFmpeg with various input formats
#         ffmpeg_formats = [
#             ("webm", ["-f", "webm"]),
#             ("ogg", ["-f", "ogg"]),
#             ("raw", ["-f", "s16le", "-ar", str(sample_rate), "-ac", "1"]),
#             ("auto", [])  # Let FFmpeg auto-detect
#         ]
        
#         for fmt_name, extra_args in ffmpeg_formats:
#             try:
#                 wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
                
#                 cmd = ["ffmpeg", "-y"] + extra_args + [
#                     "-i", temp_input,
#                     "-ar", str(sample_rate),
#                     "-ac", "1",
#                     "-acodec", "pcm_s16le",
#                     wav_path
#                 ]
                
#                 result = subprocess.run(
#                     cmd, 
#                     capture_output=True, 
#                     text=True, 
#                     timeout=30
#                 )
                
#                 if result.returncode == 0 and os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
#                     logger.info(f"Successfully converted using FFmpeg ({fmt_name} format): {wav_path}")
#                     return wav_path
#                 else:
#                     os.remove(wav_path) if os.path.exists(wav_path) else None
#                     logger.debug(f"FFmpeg {fmt_name} conversion failed: {result.stderr}")
                    
#             except subprocess.TimeoutExpired:
#                 logger.warning(f"FFmpeg {fmt_name} conversion timed out")
#                 os.remove(wav_path) if os.path.exists(wav_path) else None
#             except Exception as e:
#                 logger.debug(f"FFmpeg {fmt_name} conversion error: {str(e)}")
#                 if 'wav_path' in locals():
#                     os.remove(wav_path) if os.path.exists(wav_path) else None
        
#         # Method 4: Create silence if all else fails (for testing/debugging)
#         logger.warning("All conversion methods failed, creating silence as fallback")
#         return create_silence_wav(duration_ms=1000, sample_rate=sample_rate)
        
#     except Exception as e:
#         logger.error(f"Audio conversion completely failed: {str(e)}")
#         return None
        
#     finally:
#         # Cleanup temporary files
#         for path in temp_paths_to_cleanup:
#             if path and os.path.exists(path):
#                 try:
#                     os.remove(path)
#                 except Exception as ex:
#                     logger.warning(f"Failed to cleanup {path}: {str(ex)}")

# def create_silence_wav(duration_ms: int = 1000, sample_rate: int = 16000) -> str:
#     """Create a silent WAV file for fallback purposes."""
#     samples = int(sample_rate * duration_ms / 1000)
#     silence = np.zeros(samples, dtype=np.float32)
    
#     wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
#     sf.write(wav_path, silence, sample_rate)
    
#     logger.info(f"Created silence WAV: {wav_path}")
#     return wav_path

# def reduce_noise_and_save(audio_bytes: bytes, sample_rate: int = 16000) -> str:
#     """
#     Convert audio bytes to clean WAV with noise reduction.
#     Uses multiple fallback methods to handle various audio formats.
#     """
#     try:
#         logger.debug(f"Processing audio chunk: {len(audio_bytes)} bytes")
        
#         # Validate input
#         if not validate_audio(audio_bytes, min_size=50):
#             logger.warning(f"Audio chunk too small: {len(audio_bytes)} bytes")
#             return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
        
#         # Convert to WAV
#         wav_path = convert_raw_audio_to_wav(audio_bytes, sample_rate)
#         if not wav_path:
#             logger.warning("Audio conversion failed, using silence")
#             return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
        
#         try:
#             # Load and process audio
#             data, sr = sf.read(wav_path, dtype="float32")
            
#             # Handle stereo to mono conversion
#             if data.ndim > 1:
#                 data = np.mean(data, axis=1)
            
#             # Skip noise reduction if audio is too short
#             if len(data) < sample_rate * 0.1:  # Less than 100ms
#                 logger.debug("Audio too short for noise reduction, skipping")
#                 reduced = data
#             else:
#                 # Apply noise reduction with conservative settings
#                 try:
#                     reduced = nr.reduce_noise(
#                         y=data,
#                         sr=sr,
#                         stationary=False,  # Better for speech
#                         prop_decrease=0.5,  # Conservative noise reduction
#                         n_std_thresh_stationary=2.0  # Less aggressive
#                     )
#                 except Exception as e:
#                     logger.warning(f"Noise reduction failed: {str(e)}, using original audio")
#                     reduced = data
            
#             # Save final processed audio
#             final_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
#             sf.write(final_path, reduced, sr)
            
#             # Cleanup intermediate file
#             if os.path.exists(wav_path):
#                 os.remove(wav_path)
            
#             logger.debug(f"Successfully processed audio: {final_path}")
#             return final_path
            
#         except Exception as e:
#             logger.error(f"Audio processing failed: {str(e)}")
#             # Cleanup and return original if processing fails
#             if os.path.exists(wav_path):
#                 return wav_path  # Return original WAV
#             else:
#                 return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
                
#     except Exception as e:
#         logger.error(f"Audio preprocessing completely failed: {str(e)}")
#         return create_silence_wav(duration_ms=500, sample_rate=sample_rate)

# def load_audio_safe(file_path: str) -> Tuple[np.ndarray, int]:
#     """
#     Safely load audio file with multiple fallback methods.
#     Returns (audio_data, sample_rate)
#     """
#     try:
#         data, sr = sf.read(file_path, dtype="float32")
        
#         # Convert stereo to mono if needed
#         if data.ndim > 1:
#             data = np.mean(data, axis=1)
            
#         return data.astype(np.float32), int(sr)
        
#     except Exception as e:
#         logger.error(f"Failed to load audio {file_path}: {str(e)}")
#         # Return silence as fallback
#         return np.zeros(8000, dtype=np.float32), 16000

# # ---------------- Enhanced LangChain Tools ---------------- #

# def enhanced_live_transcribe_tool(audio_chunk: np.ndarray, sample_rate: int = 16000) -> Dict[str, str]:
#     """
#     Enhanced tool wrapper: live transcribes a single audio chunk.
#     Returns transcript or error.
#     """
#     try:
#         if len(audio_chunk) == 0:
#             return {"transcript": "", "error": "Empty audio chunk"}
            
#         result = transcribe_chunk(audio_chunk, sample_rate)
#         return {"transcript": result or "", "error": ""}
#     except Exception as e:
#         logger.error(f"Error during enhanced live transcription: {str(e)}")
#         return {"transcript": "", "error": f"Error during live transcription: {str(e)}"}

# def enhanced_live_mom_tool(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, any]:
#     """
#     Enhanced tool wrapper: processes all chunks and generates comprehensive MoM.
#     Returns enhanced MoM dict or error.
#     """
#     try:
#         # Filter out empty chunks
#         valid_chunks = [chunk for chunk in audio_chunks if len(chunk) > 0]
        
#         if not valid_chunks:
#             return {
#                 "mom": create_enhanced_fallback_response(),
#                 "error": ""
#             }
            
#         result = run_live_agent(valid_chunks, sample_rate)
#         return {"mom": result, "error": ""}
#     except Exception as e:
#         logger.error(f"Error generating enhanced live MoM: {str(e)}")
#         return {
#             "mom": create_enhanced_fallback_response(f"Error: {str(e)}"),
#             "error": f"Error generating live MoM: {str(e)}"
#         }

# def create_enhanced_fallback_response(error_msg: str = "No valid audio chunks received") -> Dict[str, any]:
#     """Create fallback response with enhanced MoM structure."""
#     from datetime import datetime
    
#     return {
#         "transcript": "",
#         "mom": {
#             "meeting_info": {
#                 "date": datetime.now().strftime("%Y-%m-%d"),
#                 "time": "Not specified",
#                 "meeting_type": "general meeting"
#             },
#             "attendance": {
#                 "participants": [],
#                 "total_participants": 0
#             },
#             "summary": {
#                 "overview": "Processing failed",
#                 "detailed": error_msg,
#                 "key_topics": []
#             },
#             "action_items": [],
#             "decisions": [],
#             "follow_up": {
#                 "next_meeting": "TBD",
#                 "pending_items": [],
#                 "required_approvals": []
#             },
#             "risks_and_blockers": []
#         }
#     }

# # ---------------- Export Functions for Enhanced MoM ---------------- #

# def export_enhanced_mom_pdf(mom_data: Dict[str, any], output_path: str = None) -> str:
#     """
#     Export enhanced MoM to PDF format with comprehensive layout.
#     """
#     try:
#         from reportlab.lib.pagesizes import letter, A4
#         from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
#         from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
#         from reportlab.lib.units import inch
#         from reportlab.lib import colors
#         from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
#         import tempfile
#         from datetime import datetime

#         if output_path is None:
#             output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf").name

#         # Create PDF document
#         doc = SimpleDocTemplate(output_path, pagesize=A4, 
#                               rightMargin=72, leftMargin=72, 
#                               topMargin=72, bottomMargin=18)
        
#         # Get styles
#         styles = getSampleStyleSheet()
        
#         # Custom styles
#         title_style = ParagraphStyle(
#             'CustomTitle',
#             parent=styles['Heading1'],
#             fontSize=18,
#             spaceAfter=30,
#             alignment=TA_CENTER,
#             textColor=colors.darkblue
#         )
        
#         heading_style = ParagraphStyle(
#             'CustomHeading',
#             parent=styles['Heading2'],
#             fontSize=14,
#             spaceAfter=12,
#             spaceBefore=20,
#             textColor=colors.darkblue,
#             borderWidth=1,
#             borderColor=colors.darkblue,
#             borderRadius=5,
#             backColor=colors.lightblue,
#             borderPadding=8
#         )
        
#         # Build story
#         story = []
        
#         # Title
#         story.append(Paragraph("Meeting Minutes", title_style))
#         story.append(Spacer(1, 20))
        
#         # Meeting Info
#         meeting_info = mom_data.get("mom", {}).get("meeting_info", {})
#         info_data = [
#             ["Date:", meeting_info.get("date", "Not specified")],
#             ["Time/Duration:", meeting_info.get("time", "Not specified")],
#             ["Meeting Type:", meeting_info.get("meeting_type", "General Meeting").title()],
#             ["Generated:", datetime.now().strftime("%Y-%m-%d %H:%M:%S")]
#         ]
        
#         info_table = Table(info_data, colWidths=[2*inch, 4*inch])
#         info_table.setStyle(TableStyle([
#             ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
#             ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
#             ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
#             ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
#             ('FONTSIZE', (0, 0), (-1, -1), 10),
#             ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
#             ('GRID', (0, 0), (-1, -1), 1, colors.black)
#         ]))
        
#         story.append(info_table)
#         story.append(Spacer(1, 20))
        
#         # Attendance
#         story.append(Paragraph("Attendance", heading_style))
#         attendance = mom_data.get("mom", {}).get("attendance", {})
#         participants = attendance.get("participants", [])
        
#         if participants:
#             attendance_data = [["Name", "Role", "Status"]]
#             for participant in participants:
#                 attendance_data.append([
#                     participant.get("name", "Unknown"),
#                     participant.get("role", "Not specified"),
#                     participant.get("attendance_status", "Present").title()
#                 ])
            
#             attendance_table = Table(attendance_data, colWidths=[2*inch, 2*inch, 1.5*inch])
#             attendance_table.setStyle(TableStyle([
#                 ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
#                 ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
#                 ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
#                 ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#                 ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
#                 ('FONTSIZE', (0, 0), (-1, -1), 10),
#                 ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
#                 ('GRID', (0, 0), (-1, -1), 1, colors.black)
#             ]))
#             story.append(attendance_table)
#         else:
#             story.append(Paragraph("No participants identified", styles['Normal']))
        
#         story.append(Spacer(1, 15))
        
#         # Summary
#         story.append(Paragraph("Meeting Summary", heading_style))
#         summary = mom_data.get("mom", {}).get("summary", {})
        
#         story.append(Paragraph("<b>Overview:</b>", styles['Normal']))
#         story.append(Paragraph(summary.get("overview", "No overview available"), styles['Normal']))
#         story.append(Spacer(1, 10))
        
#         story.append(Paragraph("<b>Detailed Notes:</b>", styles['Normal']))
#         story.append(Paragraph(summary.get("detailed", "No detailed notes available"), styles['Normal']))
        
#         # Key Topics
#         key_topics = summary.get("key_topics", [])
#         if key_topics:
#             story.append(Spacer(1, 10))
#             story.append(Paragraph("<b>Key Topics:</b>", styles['Normal']))
#             for topic in key_topics:
#                 story.append(Paragraph(f"• {topic}", styles['Normal']))
        
#         story.append(Spacer(1, 15))
        
#         # Action Items
#         story.append(Paragraph("Action Items", heading_style))
#         action_items = mom_data.get("mom", {}).get("action_items", [])
        
#         if action_items:
#             action_data = [["#", "Task", "Assigned To", "Deadline", "Priority"]]
#             for item in action_items:
#                 action_data.append([
#                     str(item.get("id", "")),
#                     item.get("task", "No description")[:50] + ("..." if len(item.get("task", "")) > 50 else ""),
#                     item.get("assigned_to", "Not assigned"),
#                     item.get("deadline", "No deadline"),
#                     item.get("priority", "Medium").title()
#                 ])
            
#             action_table = Table(action_data, colWidths=[0.5*inch, 2.5*inch, 1.5*inch, 1*inch, 0.8*inch])
#             action_table.setStyle(TableStyle([
#                 ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
#                 ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
#                 ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
#                 ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#                 ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
#                 ('FONTSIZE', (0, 0), (-1, -1), 9),
#                 ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
#                 ('GRID', (0, 0), (-1, -1), 1, colors.black),
#                 ('VALIGN', (0, 0), (-1, -1), 'TOP')
#             ]))
#             story.append(action_table)
#         else:
#             story.append(Paragraph("No action items identified", styles['Normal']))
        
#         story.append(Spacer(1, 15))
        
#         # Decisions
#         story.append(Paragraph("Decisions", heading_style))
#         decisions = mom_data.get("mom", {}).get("decisions", [])
        
#         if decisions:
#             for i, decision in enumerate(decisions, 1):
#                 story.append(Paragraph(f"<b>Decision {i}:</b> {decision.get('decision', 'No description')}", styles['Normal']))
#                 if decision.get("rationale"):
#                     story.append(Paragraph(f"<i>Rationale:</i> {decision.get('rationale')}", styles['Normal']))
#                 if decision.get("responsible_party"):
#                     story.append(Paragraph(f"<i>Responsible:</i> {decision.get('responsible_party')}", styles['Normal']))
#                 story.append(Spacer(1, 8))
#         else:
#             story.append(Paragraph("No decisions recorded", styles['Normal']))
        
#         story.append(Spacer(1, 15))
        
#         # Follow-up
#         story.append(Paragraph("Follow-up", heading_style))
#         follow_up = mom_data.get("mom", {}).get("follow_up", {})
        
#         story.append(Paragraph(f"<b>Next Meeting:</b> {follow_up.get('next_meeting', 'TBD')}", styles['Normal']))
        
#         pending_items = follow_up.get("pending_items", [])
#         if pending_items:
#             story.append(Paragraph("<b>Pending Items:</b>", styles['Normal']))
#             for item in pending_items:
#                 story.append(Paragraph(f"• {item}", styles['Normal']))
        
#         # Risks and Blockers
#         risks = mom_data.get("mom", {}).get("risks_and_blockers", [])
#         if risks:
#             story.append(Spacer(1, 15))
#             story.append(Paragraph("Risks & Blockers", heading_style))
#             for risk in risks:
#                 severity = risk.get("severity", "Unknown").upper()
#                 story.append(Paragraph(f"<b>[{severity}]</b> {risk.get('issue', 'No description')}", styles['Normal']))
#                 if risk.get("owner"):
#                     story.append(Paragraph(f"<i>Owner:</i> {risk.get('owner')}", styles['Normal']))
#                 story.append(Spacer(1, 6))
        
#         # Build PDF
#         doc.build(story)
        
#         logger.info(f"Enhanced MoM exported to PDF: {output_path}")
#         return output_path
        
#     except Exception as e:
#         logger.error(f"Failed to export enhanced MoM to PDF: {str(e)}")
#         # Create simple fallback PDF
#         try:
#             from reportlab.platypus import SimpleDocTemplate, Paragraph
#             from reportlab.lib.styles import getSampleStyleSheet
            
#             doc = SimpleDocTemplate(output_path or tempfile.NamedTemporaryFile(delete=False, suffix=".pdf").name)
#             styles = getSampleStyleSheet()
#             story = [Paragraph(f"Export Error: {str(e)}", styles['Normal'])]
#             doc.build(story)
#             return output_path
#         except:
#             raise e

# def export_enhanced_mom_docx(mom_data: Dict[str, any], output_path: str = None) -> str:
#     """
#     Export enhanced MoM to DOCX format with comprehensive layout.
#     """
#     try:
#         from docx import Document
#         from docx.shared import Inches, Pt
#         from docx.enum.text import WD_ALIGN_PARAGRAPH
#         from docx.oxml.shared import OxmlElement, qn
#         import tempfile
#         from datetime import datetime

#         if output_path is None:
#             output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".docx").name

#         # Create document
#         doc = Document()
        
#         # Title
#         title = doc.add_heading('Meeting Minutes', 0)
#         title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
#         # Meeting Info
#         meeting_info = mom_data.get("mom", {}).get("meeting_info", {})
#         doc.add_heading('Meeting Information', level=1)
        
#         info_table = doc.add_table(rows=4, cols=2)
#         info_table.style = 'Table Grid'
        
#         info_data = [
#             ('Date:', meeting_info.get("date", "Not specified")),
#             ('Time/Duration:', meeting_info.get("time", "Not specified")),
#             ('Meeting Type:', meeting_info.get("meeting_type", "General Meeting").title()),
#             ('Generated:', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
#         ]
        
#         for i, (label, value) in enumerate(info_data):
#             info_table.cell(i, 0).text = label
#             info_table.cell(i, 1).text = value
        
#         # Attendance
#         doc.add_heading('Attendance', level=1)
#         attendance = mom_data.get("mom", {}).get("attendance", {})
#         participants = attendance.get("participants", [])
        
#         if participants:
#             attendance_table = doc.add_table(rows=1, cols=3)
#             attendance_table.style = 'Table Grid'
            
#             # Header
#             hdr_cells = attendance_table.rows[0].cells
#             hdr_cells[0].text = 'Name'
#             hdr_cells[1].text = 'Role'
#             hdr_cells[2].text = 'Status'
            
#             # Add participants
#             for participant in participants:
#                 row_cells = attendance_table.add_row().cells
#                 row_cells[0].text = participant.get("name", "Unknown")
#                 row_cells[1].text = participant.get("role", "Not specified")
#                 row_cells[2].text = participant.get("attendance_status", "Present").title()
#         else:
#             doc.add_paragraph("No participants identified")
        
#         # Summary
#         doc.add_heading('Meeting Summary', level=1)
#         summary = mom_data.get("mom", {}).get("summary", {})
        
#         doc.add_paragraph().add_run('Overview: ').bold = True
#         doc.add_paragraph(summary.get("overview", "No overview available"))
        
#         doc.add_paragraph().add_run('Detailed Notes: ').bold = True
#         doc.add_paragraph(summary.get("detailed", "No detailed notes available"))
        
#         # Key Topics
#         key_topics = summary.get("key_topics", [])
#         if key_topics:
#             doc.add_paragraph().add_run('Key Topics: ').bold = True
#             for topic in key_topics:
#                 doc.add_paragraph(f'• {topic}')
        
#         # Action Items
#         doc.add_heading('Action Items', level=1)
#         action_items = mom_data.get("mom", {}).get("action_items", [])
        
#         if action_items:
#             for item in action_items:
#                 p = doc.add_paragraph()
#                 p.add_run(f"#{item.get('id', '')}: ").bold = True
#                 p.add_run(item.get("task", "No description"))
                
#                 details = []
#                 if item.get("assigned_to") and item.get("assigned_to") != "Not specified":
#                     details.append(f"Assigned to: {item.get('assigned_to')}")
#                 if item.get("deadline") and item.get("deadline") not in ["N/A", "Not specified"]:
#                     details.append(f"Deadline: {item.get('deadline')}")
#                 if item.get("priority"):
#                     details.append(f"Priority: {item.get('priority').title()}")
                
#                 if details:
#                     detail_p = doc.add_paragraph()
#                     detail_p.add_run(" | ".join(details)).italic = True
#         else:
#             doc.add_paragraph("No action items identified")
        
#         # Decisions
#         doc.add_heading('Decisions', level=1)
#         decisions = mom_data.get("mom", {}).get("decisions", [])
        
#         if decisions:
#             for i, decision in enumerate(decisions, 1):
#                 p = doc.add_paragraph()
#                 p.add_run(f"Decision {i}: ").bold = True
#                 p.add_run(decision.get("decision", "No description"))
                
#                 if decision.get("rationale"):
#                     rat_p = doc.add_paragraph()
#                     rat_p.add_run("Rationale: ").italic = True
#                     rat_p.add_run(decision.get("rationale"))
                
#                 if decision.get("responsible_party"):
#                     resp_p = doc.add_paragraph()
#                     resp_p.add_run("Responsible: ").italic = True
#                     resp_p.add_run(decision.get("responsible_party"))
#         else:
#             doc.add_paragraph("No decisions recorded")
        
#         # Follow-up
#         doc.add_heading('Follow-up', level=1)
#         follow_up = mom_data.get("mom", {}).get("follow_up", {})
        
#         doc.add_paragraph().add_run(f"Next Meeting: {follow_up.get('next_meeting', 'TBD')}")
        
#         pending_items = follow_up.get("pending_items", [])
#         if pending_items:
#             doc.add_paragraph().add_run('Pending Items:').bold = True
#             for item in pending_items:
#                 doc.add_paragraph(f"• {item}")
        
#         # Risks and Blockers
#         risks = mom_data.get("mom", {}).get("risks_and_blockers", [])
#         if risks:
#             doc.add_heading('Risks & Blockers', level=1)
#             for risk in risks:
#                 p = doc.add_paragraph()
#                 severity = risk.get("severity", "Unknown").upper()
#                 p.add_run(f"[{severity}] ").bold = True
#                 p.add_run(risk.get("issue", "No description"))
                
#                 if risk.get("owner"):
#                     owner_p = doc.add_paragraph()
#                     owner_p.add_run("Owner: ").italic = True
#                     owner_p.add_run(risk.get("owner"))
        
#         # Save document
#         doc.save(output_path)
        
#         logger.info(f"Enhanced MoM exported to DOCX: {output_path}")
#         return output_path
        
#     except Exception as e:
#         logger.error(f"Failed to export enhanced MoM to DOCX: {str(e)}")
#         # Create simple fallback DOCX
#         try:
#             from docx import Document
            
#             doc = Document()
#             doc.add_heading('Export Error', 0)
#             doc.add_paragraph(f"Failed to export meeting minutes: {str(e)}")
#             doc.save(output_path or tempfile.NamedTemporaryFile(delete=False, suffix=".docx").name)
#             return output_path
#         except:
#             raise e

# # ---------------- Legacy compatibility functions ---------------- #

# def live_transcribe_tool(audio_chunk: np.ndarray, sample_rate: int = 16000) -> Dict[str, str]:
#     """Legacy wrapper for enhanced live transcribe tool."""
#     return enhanced_live_transcribe_tool(audio_chunk, sample_rate)

# def live_mom_tool(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, str]:
#     """Legacy wrapper for enhanced live MoM tool."""
#     result = enhanced_live_mom_tool(audio_chunks, sample_rate)
#     # Convert back to legacy format if needed
#     if "mom" in result and isinstance(result["mom"], dict) and "mom" in result["mom"]:
#         # Extract the nested mom structure for backward compatibility
#         result["mom"] = result["mom"]["mom"]
#     return result



import tempfile
import numpy as np
import soundfile as sf
import noisereduce as nr
from typing import Dict, List, Optional, Tuple
from agents.live_speech_to_txt_agent.core.agent import transcribe_chunk, run_live_agent
from pydub import AudioSegment
import io
import os
import logging
import subprocess
import wave
import struct

logger = logging.getLogger(__name__)

# ---------------- Helper Functions (enhanced for better audio processing) ---------------- #

def save_temp_file(file_bytes: bytes, suffix: str = ".wav") -> str:
    """Save uploaded audio temporarily and return the file path."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        return tmp.name

def validate_audio(file_bytes: bytes, min_size: int = 100) -> bool:
    """Validate audio file size (more lenient for chunks)."""
    return len(file_bytes) >= min_size

def is_valid_webm(file_bytes: bytes) -> bool:
    """Check if bytes contain a valid WebM file header."""
    if len(file_bytes) < 4:
        return False
    
    # WebM files start with EBML header (0x1A45DFA3)
    webm_signature = b'\x1a\x45\xdf\xa3'
    return file_bytes[:4] == webm_signature

def enhance_audio_for_speech(audio_data: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """Enhance audio specifically for speech recognition and speaker detection."""
    try:
        # Normalize amplitude
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data)) * 0.9
        
        # Apply gentle high-pass filter to reduce low-frequency noise
        from scipy import signal
        nyquist = sample_rate / 2
        low_cutoff = 80 / nyquist  # Remove very low frequencies
        b, a = signal.butter(4, low_cutoff, btype='high')
        audio_data = signal.filtfilt(b, a, audio_data)
        
        # Gentle spectral subtraction for noise reduction (preserves speech characteristics)
        if len(audio_data) >= sample_rate:  # Only for longer audio
            try:
                audio_data = nr.reduce_noise(
                    y=audio_data,
                    sr=sample_rate,
                    stationary=False,
                    prop_decrease=0.3,
                    n_std_thresh_stationary=2.5
                )
            except:
                pass  # Skip if noise reduction fails
        
        return audio_data.astype(np.float32)
        
    except Exception as e:
        logger.warning(f"Audio enhancement failed: {str(e)}, returning original")
        return audio_data

def convert_raw_audio_to_wav(audio_bytes: bytes, sample_rate: int = 16000) -> Optional[str]:
    """
    Convert raw audio bytes to WAV format with enhanced processing for speech.
    """
    temp_paths_to_cleanup = []
    
    try:
        logger.debug(f"Converting {len(audio_bytes)} bytes to WAV format")
        
        # Method 1: Try direct WAV creation if it's raw PCM data
        if len(audio_bytes) % 2 == 0:  # Assume 16-bit samples
            try:
                # Convert bytes to numpy array (assuming 16-bit PCM)
                audio_data = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                
                # Enhance for speech recognition
                audio_data = enhance_audio_for_speech(audio_data, sample_rate)
                
                # Create WAV file
                wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
                sf.write(wav_path, audio_data, sample_rate)
                
                # Verify the file was created successfully
                if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:  # WAV header is 44 bytes
                    logger.info(f"Successfully converted raw PCM to enhanced WAV: {wav_path}")
                    return wav_path
                else:
                    os.remove(wav_path) if os.path.exists(wav_path) else None
            except Exception as e:
                logger.debug(f"Raw PCM conversion failed: {str(e)}")
        
        # Method 2: Save as temporary file and try pydub
        temp_input = save_temp_file(audio_bytes, suffix=".webm")
        temp_paths_to_cleanup.append(temp_input)
        
        try:
            audio_seg = AudioSegment.from_file(temp_input)
            # Optimize for speech: mono, 16kHz, normalize
            audio_seg = audio_seg.set_channels(1).set_frame_rate(sample_rate)
            
            # Normalize volume for better speech recognition
            audio_seg = audio_seg.normalize()
            
            wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
            audio_seg.export(wav_path, format="wav", parameters=["-ac", "1"])
            
            if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
                logger.info(f"Successfully converted using pydub with speech optimization: {wav_path}")
                return wav_path
            else:
                os.remove(wav_path) if os.path.exists(wav_path) else None
                
        except Exception as e:
            logger.debug(f"pydub conversion failed: {str(e)}")
        
        # Method 3: Try FFmpeg with speech-optimized parameters
        ffmpeg_formats = [
            ("webm", ["-f", "webm", "-ac", "1"]),  # Force mono
            ("ogg", ["-f", "ogg", "-ac", "1"]),
            ("raw", ["-f", "s16le", "-ar", str(sample_rate), "-ac", "1"]),
            ("auto", ["-ac", "1"])  # Auto-detect with mono output
        ]
        
        for fmt_name, extra_args in ffmpeg_formats:
            try:
                wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
                
                cmd = ["ffmpeg", "-y"] + extra_args + [
                    "-i", temp_input,
                    "-ar", str(sample_rate),
                    "-ac", "1",  # Mono
                    "-acodec", "pcm_s16le",
                    "-af", "highpass=f=80,lowpass=f=8000,volume=2.0",  # Speech-optimized filtering
                    wav_path
                ]
                
                result = subprocess.run(
                    cmd, 
                    capture_output=True, 
                    text=True, 
                    timeout=30
                )
                
                if result.returncode == 0 and os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
                    logger.info(f"Successfully converted using FFmpeg with speech optimization ({fmt_name} format): {wav_path}")
                    return wav_path
                else:
                    os.remove(wav_path) if os.path.exists(wav_path) else None
                    logger.debug(f"FFmpeg {fmt_name} conversion failed: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                logger.warning(f"FFmpeg {fmt_name} conversion timed out")
                if 'wav_path' in locals() and os.path.exists(wav_path):
                    os.remove(wav_path)
            except Exception as e:
                logger.debug(f"FFmpeg {fmt_name} conversion error: {str(e)}")
                if 'wav_path' in locals() and os.path.exists(wav_path):
                    os.remove(wav_path)
        
        # Method 4: Create silence if all else fails (for testing/debugging)
        logger.warning("All conversion methods failed, creating silence as fallback")
        return create_silence_wav(duration_ms=1000, sample_rate=sample_rate)
        
    except Exception as e:
        logger.error(f"Audio conversion completely failed: {str(e)}")
        return None
        
    finally:
        # Cleanup temporary files
        for path in temp_paths_to_cleanup:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as ex:
                    logger.warning(f"Failed to cleanup {path}: {str(ex)}")

def create_silence_wav(duration_ms: int = 1000, sample_rate: int = 16000) -> str:
    """Create a silent WAV file for fallback purposes."""
    samples = int(sample_rate * duration_ms / 1000)
    silence = np.zeros(samples, dtype=np.float32)
    
    wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
    sf.write(wav_path, silence, sample_rate)
    
    logger.info(f"Created silence WAV: {wav_path}")
    return wav_path

def reduce_noise_and_save(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """
    Convert audio bytes to clean WAV with enhanced speech processing.
    """
    try:
        logger.debug(f"Processing audio chunk for speech recognition: {len(audio_bytes)} bytes")
        
        # Validate input
        if not validate_audio(audio_bytes, min_size=50):
            logger.warning(f"Audio chunk too small: {len(audio_bytes)} bytes")
            return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
        
        # Convert to WAV with speech optimization
        wav_path = convert_raw_audio_to_wav(audio_bytes, sample_rate)
        if not wav_path:
            logger.warning("Audio conversion failed, using silence")
            return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
        
        try:
            # Load and process audio for better speech recognition
            data, sr = sf.read(wav_path, dtype="float32")
            
            # Handle stereo to mono conversion
            if data.ndim > 1:
                data = np.mean(data, axis=1)
            
            # Enhanced processing for speech
            data = enhance_audio_for_speech(data, sr)
            
            # Save final processed audio
            final_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
            sf.write(final_path, data, sr)
            
            # Cleanup intermediate file
            if os.path.exists(wav_path):
                os.remove(wav_path)
            
            logger.debug(f"Successfully processed audio with speech enhancement: {final_path}")
            return final_path
            
        except Exception as e:
            logger.error(f"Audio processing failed: {str(e)}")
            # Return original if processing fails
            if os.path.exists(wav_path):
                return wav_path
            else:
                return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
                
    except Exception as e:
        logger.error(f"Audio preprocessing completely failed: {str(e)}")
        return create_silence_wav(duration_ms=500, sample_rate=sample_rate)

def load_audio_safe(file_path: str) -> Tuple[np.ndarray, int]:
    """
    Safely load audio file with speech optimization.
    """
    try:
        data, sr = sf.read(file_path, dtype="float32")
        
        # Convert stereo to mono if needed
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        
        # Apply speech enhancement
        data = enhance_audio_for_speech(data, sr)
            
        return data.astype(np.float32), int(sr)
        
    except Exception as e:
        logger.error(f"Failed to load audio {file_path}: {str(e)}")
        # Return silence as fallback
        return np.zeros(8000, dtype=np.float32), 16000

# ---------------- Enhanced LangChain Tools with Better Error Handling ---------------- #

def enhanced_live_transcribe_tool(audio_chunk: np.ndarray, sample_rate: int = 16000) -> Dict[str, str]:
    """
    Enhanced tool wrapper: live transcribes a single audio chunk with speaker context.
    """
    try:
        if len(audio_chunk) == 0:
            return {"transcript": "", "error": "Empty audio chunk"}
        
        # Apply additional speech enhancement before transcription
        enhanced_chunk = enhance_audio_for_speech(audio_chunk, sample_rate)
        
        result = transcribe_chunk(enhanced_chunk, sample_rate)
        return {"transcript": result or "", "error": ""}
    except Exception as e:
        logger.error(f"Error during enhanced live transcription: {str(e)}")
        return {"transcript": "", "error": f"Error during live transcription: {str(e)}"}

def enhanced_live_mom_tool(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, any]:
    """
    Enhanced tool wrapper: processes all chunks and generates comprehensive MoM with speaker detection.
    """
    try:
        # Filter out empty chunks and enhance remaining ones
        valid_chunks = []
        for chunk in audio_chunks:
            if len(chunk) > 0:
                enhanced_chunk = enhance_audio_for_speech(chunk, sample_rate)
                valid_chunks.append(enhanced_chunk)
        
        if not valid_chunks:
            return {
                "mom": create_enhanced_fallback_response(),
                "error": ""
            }
        
        logger.info(f"Processing {len(valid_chunks)} enhanced audio chunks for comprehensive MoM")
        result = run_live_agent(valid_chunks, sample_rate)
        return {"mom": result, "error": ""}
    except Exception as e:
        logger.error(f"Error generating enhanced live MoM: {str(e)}")
        return {
            "mom": create_enhanced_fallback_response(f"Error: {str(e)}"),
            "error": f"Error generating live MoM: {str(e)}"
        }

def create_enhanced_fallback_response(error_msg: str = "No valid audio chunks received") -> Dict[str, any]:
    """Create fallback response with enhanced MoM structure."""
    from datetime import datetime
    
    return {
        "transcript": "",
        "mom": {
            "meeting_info": {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "time": "Not specified",
                "meeting_type": "general meeting"
            },
            "attendance": {
                "participants": [],
                "total_participants": 0
            },
            "summary": {
                "overview": "Processing failed - please ensure clear audio with multiple speakers mentioning names",
                "detailed": error_msg,
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
        }
    }

# ---------------- Enhanced Export Functions ---------------- #

def export_enhanced_mom_pdf(mom_data: Dict[str, any], output_path: str = None) -> str:
    """
    Export enhanced MoM to PDF format with comprehensive layout and speaker information.
    """
    try:
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
        import tempfile
        from datetime import datetime

        if output_path is None:
            output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf").name

        # Create PDF document with better margins
        doc = SimpleDocTemplate(output_path, pagesize=A4, 
                              rightMargin=50, leftMargin=50, 
                              topMargin=72, bottomMargin=36)
        
        # Get styles
        styles = getSampleStyleSheet()
        
        # Enhanced custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.darkblue,
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            spaceBefore=20,
            textColor=colors.darkblue,
            borderWidth=1,
            borderColor=colors.darkblue,
            borderRadius=5,
            backColor=colors.lightblue,
            borderPadding=8,
            fontName='Helvetica-Bold'
        )
        
        subheading_style = ParagraphStyle(
            'CustomSubHeading',
            parent=styles['Heading3'],
            fontSize=12,
            spaceAfter=8,
            spaceBefore=12,
            textColor=colors.darkblue,
            fontName='Helvetica-Bold'
        )
        
        # Build story
        story = []
        
        # Title with generation timestamp
        story.append(Paragraph("Meeting Minutes", title_style))
        story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Meeting Info Table
        meeting_info = mom_data.get("mom", {}).get("meeting_info", {})
        info_data = [
            ["Meeting Date:", meeting_info.get("date", "Not specified")],
            ["Duration/Time:", meeting_info.get("time", "Not specified")],
            ["Meeting Type:", meeting_info.get("meeting_type", "General Meeting").title()],
            ["Total Participants:", str(mom_data.get("mom", {}).get("attendance", {}).get("total_participants", 0))]
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
        ]))
        
        story.append(info_table)
        story.append(Spacer(1, 20))
        
        # Enhanced Attendance Section
        story.append(Paragraph("Meeting Attendance", heading_style))
        attendance = mom_data.get("mom", {}).get("attendance", {})
        participants = attendance.get("participants", [])
        
        if participants:
            attendance_data = [["Participant Name", "Role/Title", "Attendance Status"]]
            for participant in participants:
                attendance_data.append([
                    participant.get("name", "Unknown"),
                    participant.get("role", "Not specified"),
                    participant.get("attendance_status", "Present").title()
                ])
            
            attendance_table = Table(attendance_data, colWidths=[2.2*inch, 2.2*inch, 1.6*inch])
            attendance_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
            ]))
            story.append(attendance_table)
        else:
            story.append(Paragraph("No participants could be identified from the meeting audio. Consider mentioning names and roles during future meetings for better tracking.", styles['Normal']))
        
        story.append(Spacer(1, 20))
        
        # Enhanced Summary Section
        story.append(Paragraph("Meeting Summary", heading_style))
        summary = mom_data.get("mom", {}).get("summary", {})
        
        story.append(Paragraph("Executive Overview", subheading_style))
        story.append(Paragraph(summary.get("overview", "No overview available"), styles['Normal']))
        story.append(Spacer(1, 10))
        
        story.append(Paragraph("Detailed Discussion Notes", subheading_style))
        detailed_notes = summary.get("detailed", "No detailed notes available")
        # Split long text into paragraphs for better readability
        if len(detailed_notes) > 500:
            paragraphs = detailed_notes.split('. ')
            formatted_text = '. '.join(paragraphs[:3]) + '.'
            if len(paragraphs) > 3:
                formatted_text += f"<br/><br/>[Additional details available - {len(paragraphs)-3} more discussion points documented]"
            story.append(Paragraph(formatted_text, styles['Normal']))
        else:
            story.append(Paragraph(detailed_notes, styles['Normal']))
        
        # Key Topics with better formatting
        key_topics = summary.get("key_topics", [])
        if key_topics:
            story.append(Spacer(1, 10))
            story.append(Paragraph("Key Discussion Topics", subheading_style))
            for i, topic in enumerate(key_topics, 1):
                story.append(Paragraph(f"{i}. {topic}", styles['Normal']))
        
        story.append(Spacer(1, 20))
        
        # Enhanced Action Items
        story.append(Paragraph("Action Items & Assignments", heading_style))
        action_items = mom_data.get("mom", {}).get("action_items", [])
        
        if action_items:
            for item in action_items:
                # Create mini-table for each action item
                priority_color = colors.lightgrey
                if item.get("priority", "").lower() == "high":
                    priority_color = colors.lightcoral
                elif item.get("priority", "").lower() == "medium":
                    priority_color = colors.lightyellow
                elif item.get("priority", "").lower() == "low":
                    priority_color = colors.lightgreen
                
                action_data = [
                    [f"Action Item #{item.get('id', '')}", ""],
                    ["Task:", item.get("task", "No description")],
                    ["Assigned to:", item.get("assigned_to", "Not assigned")],
                    ["Deadline:", item.get("deadline", "No deadline")],
                    ["Priority:", f"{item.get('priority', 'Medium').title()} Priority"],
                    ["Category:", item.get("category", "General").title()]
                ]
                
                action_table = Table(action_data, colWidths=[1.5*inch, 4.5*inch])
                action_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkgrey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('BACKGROUND', (0, 4), (-1, 4), priority_color),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
                    ('FONTNAME', (1, 1), (1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('SPAN', (0, 0), (1, 0))
                ]))
                story.append(action_table)
                story.append(Spacer(1, 10))
        else:
            story.append(Paragraph("No specific action items were identified in this meeting. Consider being more explicit about task assignments and deadlines in future meetings.", styles['Normal']))
        
        story.append(Spacer(1, 15))
        
        # Enhanced Decisions Section
        story.append(Paragraph("Decisions & Agreements", heading_style))
        decisions = mom_data.get("mom", {}).get("decisions", [])
        
        if decisions:
            for i, decision in enumerate(decisions, 1):
                story.append(Paragraph(f"Decision {i}: {decision.get('decision', 'No description')}", subheading_style))
                
                decision_details = []
                if decision.get("rationale"):
                    decision_details.append(f"<b>Rationale:</b> {decision.get('rationale')}")
                if decision.get("impact"):
                    decision_details.append(f"<b>Impact:</b> {decision.get('impact')}")
                if decision.get("responsible_party"):
                    decision_details.append(f"<b>Implementation Owner:</b> {decision.get('responsible_party')}")
                if decision.get("timeline"):
                    decision_details.append(f"<b>Timeline:</b> {decision.get('timeline')}")
                
                if decision_details:
                    for detail in decision_details:
                        story.append(Paragraph(detail, styles['Normal']))
                    story.append(Spacer(1, 8))
                else:
                    story.append(Paragraph("<i>No additional details recorded for this decision</i>", styles['Normal']))
                    story.append(Spacer(1, 8))
        else:
            story.append(Paragraph("No formal decisions were recorded in this meeting. Consider being more explicit about decision-making moments and their outcomes.", styles['Normal']))
        
        story.append(Spacer(1, 15))
        
        # Enhanced Follow-up Section
        story.append(Paragraph("Follow-up & Next Steps", heading_style))
        follow_up = mom_data.get("mom", {}).get("follow_up", {})
        
        follow_data = [
            ["Next Meeting:", follow_up.get('next_meeting', 'To be determined')],
        ]
        
        pending_items = follow_up.get("pending_items", [])
        if pending_items:
            follow_data.append(["Pending Items:", "• " + "\n• ".join(pending_items)])
        else:
            follow_data.append(["Pending Items:", "None identified"])
        
        required_approvals = follow_up.get("required_approvals", [])
        if required_approvals:
            follow_data.append(["Required Approvals:", "• " + "\n• ".join(required_approvals)])
        else:
            follow_data.append(["Required Approvals:", "None identified"])
        
        follow_table = Table(follow_data, colWidths=[2*inch, 4*inch])
        follow_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightblue),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ]))
        story.append(follow_table)
        
        # Risks and Blockers
        risks = mom_data.get("mom", {}).get("risks_and_blockers", [])
        if risks:
            story.append(Spacer(1, 20))
            story.append(Paragraph("Risks & Blockers", heading_style))
            
            for risk in risks:
                severity_color = colors.lightgrey
                if risk.get("severity", "").lower() == "high":
                    severity_color = colors.lightcoral
                elif risk.get("severity", "").lower() == "medium":
                    severity_color = colors.lightyellow
                elif risk.get("severity", "").lower() == "low":
                    severity_color = colors.lightgreen
                
                risk_data = [
                    ["Risk/Blocker", risk.get("issue", "No description")],
                    ["Severity Level", risk.get("severity", "Unknown").title()],
                    ["Owner/Responsible", risk.get("owner", "Not specified")]
                ]
                
                risk_table = Table(risk_data, colWidths=[2*inch, 4*inch])
                risk_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                    ('BACKGROUND', (0, 1), (1, 1), severity_color),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP')
                ]))
                story.append(risk_table)
                story.append(Spacer(1, 10))
        
        # Footer with generation info
        story.append(Spacer(1, 30))
        story.append(Paragraph("---", styles['Normal']))
        story.append(Paragraph(f"This document was automatically generated from meeting audio using AI-powered transcription and analysis.", styles['Normal']))
        story.append(Paragraph(f"For questions or corrections, please contact the meeting organizer.", styles['Normal']))
        
        # Build PDF
        doc.build(story)
        
        logger.info(f"Enhanced MoM exported to PDF: {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"Failed to export enhanced MoM to PDF: {str(e)}")
        # Create simple fallback PDF
        try:
            from reportlab.platypus import SimpleDocTemplate, Paragraph
            from reportlab.lib.styles import getSampleStyleSheet
            
            doc = SimpleDocTemplate(output_path or tempfile.NamedTemporaryFile(delete=False, suffix=".pdf").name)
            styles = getSampleStyleSheet()
            story = [
                Paragraph("Meeting Minutes Export Error", styles['Heading1']),
                Paragraph(f"Unable to generate PDF: {str(e)}", styles['Normal']),
                Paragraph("Please try again or contact support.", styles['Normal'])
            ]
            doc.build(story)
            return output_path
        except:
            raise e

def export_enhanced_mom_docx(mom_data: Dict[str, any], output_path: str = None) -> str:
    """
    Export enhanced MoM to DOCX format with comprehensive layout and speaker information.
    """
    try:
        from docx import Document
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.table import WD_TABLE_ALIGNMENT
        import tempfile
        from datetime import datetime

        if output_path is None:
            output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".docx").name

        # Create document
        doc = Document()
        
        # Set document margins
        sections = doc.sections
        for section in sections:
            section.top_margin = Inches(1)
            section.bottom_margin = Inches(1)
            section.left_margin = Inches(1)
            section.right_margin = Inches(1)
        
        # Title
        title = doc.add_heading('Meeting Minutes', 0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Generation timestamp
        timestamp_para = doc.add_paragraph(f'Generated on {datetime.now().strftime("%Y-%m-%d at %H:%M")}')
        timestamp_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Meeting Information
        doc.add_heading('Meeting Information', level=1)
        meeting_info = mom_data.get("mom", {}).get("meeting_info", {})
        
        info_table = doc.add_table(rows=4, cols=2)
        info_table.style = 'Table Grid'
        info_table.alignment = WD_TABLE_ALIGNMENT.LEFT
        
        info_data = [
            ('Meeting Date:', meeting_info.get("date", "Not specified")),
            ('Duration/Time:', meeting_info.get("time", "Not specified")),
            ('Meeting Type:', meeting_info.get("meeting_type", "General Meeting").title()),
            ('Total Participants:', str(mom_data.get("mom", {}).get("attendance", {}).get("total_participants", 0)))
        ]
        
        for i, (label, value) in enumerate(info_data):
            info_table.cell(i, 0).text = label
            info_table.cell(i, 1).text = value
            # Make labels bold
            info_table.cell(i, 0).paragraphs[0].runs[0].bold = True
        
        # Enhanced Attendance
        doc.add_heading('Meeting Attendance', level=1)
        attendance = mom_data.get("mom", {}).get("attendance", {})
        participants = attendance.get("participants", [])
        
        if participants:
            attendance_table = doc.add_table(rows=1, cols=3)
            attendance_table.style = 'Table Grid'
            attendance_table.alignment = WD_TABLE_ALIGNMENT.LEFT
            
            # Header
            hdr_cells = attendance_table.rows[0].cells
            hdr_cells[0].text = 'Participant Name'
            hdr_cells[1].text = 'Role/Title'
            hdr_cells[2].text = 'Status'
            
            # Make header bold
            for cell in hdr_cells:
                cell.paragraphs[0].runs[0].bold = True
            
            # Add participants
            for participant in participants:
                row_cells = attendance_table.add_row().cells
                row_cells[0].text = participant.get("name", "Unknown")
                row_cells[1].text = participant.get("role", "Not specified")
                row_cells[2].text = participant.get("attendance_status", "Present").title()
        else:
            doc.add_paragraph("No participants could be identified from the meeting audio. Consider mentioning names and roles during future meetings for better tracking.")
        
        # Enhanced Summary
        doc.add_heading('Meeting Summary', level=1)
        summary = mom_data.get("mom", {}).get("summary", {})
        
        doc.add_heading('Executive Overview', level=2)
        doc.add_paragraph(summary.get("overview", "No overview available"))
        
        doc.add_heading('Detailed Discussion Notes', level=2)
        detailed_notes = summary.get("detailed", "No detailed notes available")
        doc.add_paragraph(detailed_notes)
        
        # Key Topics
        key_topics = summary.get("key_topics", [])
        if key_topics:
            doc.add_heading('Key Discussion Topics', level=2)
            for i, topic in enumerate(key_topics, 1):
                doc.add_paragraph(f'{i}. {topic}')
        
        # Enhanced Action Items
        doc.add_heading('Action Items & Assignments', level=1)
        action_items = mom_data.get("mom", {}).get("action_items", [])
        
        if action_items:
            for item in action_items:
                # Action item header
                action_heading = doc.add_heading(f'Action Item #{item.get("id", "")}', level=2)
                
                # Task description
                task_para = doc.add_paragraph()
                task_para.add_run('Task: ').bold = True
                task_para.add_run(item.get("task", "No description"))
                
                # Details
                details = []
                if item.get("assigned_to") and item.get("assigned_to") != "Not specified":
                    details.append(f"Assigned to: {item.get('assigned_to')}")
                if item.get("deadline") and item.get("deadline") not in ["N/A", "Not specified"]:
                    details.append(f"Deadline: {item.get('deadline')}")
                if item.get("priority"):
                    details.append(f"Priority: {item.get('priority').title()}")
                if item.get("category"):
                    details.append(f"Category: {item.get('category').title()}")
                
                if details:
                    detail_para = doc.add_paragraph()
                    detail_para.add_run(" | ".join(details)).italic = True
                
                doc.add_paragraph()  # Add spacing
        else:
            doc.add_paragraph("No specific action items were identified in this meeting. Consider being more explicit about task assignments and deadlines in future meetings.")
        
        # Enhanced Decisions
        doc.add_heading('Decisions & Agreements', level=1)
        decisions = mom_data.get("mom", {}).get("decisions", [])
        
        if decisions:
            for i, decision in enumerate(decisions, 1):
                # Decision header
                decision_heading = doc.add_heading(f'Decision {i}', level=2)
                
                # Decision statement
                decision_para = doc.add_paragraph()
                decision_para.add_run('Decision: ').bold = True
                decision_para.add_run(decision.get("decision", "No description"))
                
                # Additional details
                if decision.get("rationale"):
                    rat_para = doc.add_paragraph()
                    rat_para.add_run("Rationale: ").bold = True
                    rat_para.add_run(decision.get("rationale"))
                
                if decision.get("impact"):
                    impact_para = doc.add_paragraph()
                    impact_para.add_run("Impact: ").bold = True
                    impact_para.add_run(decision.get("impact"))
                
                if decision.get("responsible_party"):
                    resp_para = doc.add_paragraph()
                    resp_para.add_run("Implementation Owner: ").bold = True
                    resp_para.add_run(decision.get("responsible_party"))
                
                if decision.get("timeline"):
                    time_para = doc.add_paragraph()
                    time_para.add_run("Timeline: ").bold = True
                    time_para.add_run(decision.get("timeline"))
                
                doc.add_paragraph()  # Add spacing
        else:
            doc.add_paragraph("No formal decisions were recorded in this meeting. Consider being more explicit about decision-making moments and their outcomes.")
        
        # Enhanced Follow-up
        doc.add_heading('Follow-up & Next Steps', level=1)
        follow_up = mom_data.get("mom", {}).get("follow_up", {})
        
        next_meeting_para = doc.add_paragraph()
        next_meeting_para.add_run('Next Meeting: ').bold = True
        next_meeting_para.add_run(follow_up.get('next_meeting', 'To be determined'))
        
        pending_items = follow_up.get("pending_items", [])
        if pending_items:
            doc.add_paragraph().add_run('Pending Items:').bold = True
            for item in pending_items:
                doc.add_paragraph(f"• {item}")
        else:
            pending_para = doc.add_paragraph()
            pending_para.add_run('Pending Items: ').bold = True
            pending_para.add_run('None identified')
        
        required_approvals = follow_up.get("required_approvals", [])
        if required_approvals:
            doc.add_paragraph().add_run('Required Approvals:').bold = True
            for approval in required_approvals:
                doc.add_paragraph(f"• {approval}")
        else:
            approval_para = doc.add_paragraph()
            approval_para.add_run('Required Approvals: ').bold = True
            approval_para.add_run('None identified')
        
        # Risks and Blockers
        risks = mom_data.get("mom", {}).get("risks_and_blockers", [])
        if risks:
            doc.add_heading('Risks & Blockers', level=1)
            for risk in risks:
                risk_para = doc.add_paragraph()
                severity = risk.get("severity", "Unknown").upper()
                risk_para.add_run(f"[{severity}] ").bold = True
                risk_para.add_run(risk.get("issue", "No description"))
                
                if risk.get("owner"):
                    owner_para = doc.add_paragraph()
                    owner_para.add_run("Responsible: ").italic = True
                    owner_para.add_run(risk.get("owner"))
                
                doc.add_paragraph()  # Add spacing
        
        # Footer
        doc.add_paragraph()
        doc.add_paragraph("---")
        doc.add_paragraph("This document was automatically generated from meeting audio using AI-powered transcription and analysis.")
        doc.add_paragraph("For questions or corrections, please contact the meeting organizer.")
        
        # Save document
        doc.save(output_path)
        
        logger.info(f"Enhanced MoM exported to DOCX: {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"Failed to export enhanced MoM to DOCX: {str(e)}")
        # Create simple fallback DOCX
        try:
            from docx import Document
            
            doc = Document()
            doc.add_heading('Meeting Minutes Export Error', 0)
            doc.add_paragraph(f"Unable to generate DOCX: {str(e)}")
            doc.add_paragraph("Please try again or contact support.")
            doc.save(output_path or tempfile.NamedTemporaryFile(delete=False, suffix=".docx").name)
            return output_path
        except:
            raise e

# ---------------- Legacy compatibility functions ---------------- #

def live_transcribe_tool(audio_chunk: np.ndarray, sample_rate: int = 16000) -> Dict[str, str]:
    """Legacy wrapper for enhanced live transcribe tool."""
    return enhanced_live_transcribe_tool(audio_chunk, sample_rate)

def live_mom_tool(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, str]:
    """Legacy wrapper for enhanced live MoM tool."""
    result = enhanced_live_mom_tool(audio_chunks, sample_rate)
    # Convert back to legacy format if needed
    if "mom" in result and isinstance(result["mom"], dict) and "mom" in result["mom"]:
        # Extract the nested mom structure for backward compatibility
        result["mom"] = result["mom"]["mom"]
    return result

# ---------------- Additional utility functions for speaker detection ---------------- #

def extract_potential_names_from_text(text: str) -> List[str]:
    """Extract potential names from text using various patterns."""
    import re
    
    potential_names = set()
    
    # Pattern 1: "I'm [Name]" or "I am [Name]"
    intro_patterns = [
        r'\b(?:I\'m|I am)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?\b',
        r'\b(?:My name is|This is)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?\b'
    ]
    
    # Pattern 2: Direct address "[Name], can you..." or "[Name] said"
    address_patterns = [
        r'\b([A-Z][a-z]+),\s+(?:can you|could you|what do you|do you)\b',
        r'\b([A-Z][a-z]+)\s+(?:said|mentioned|thinks|believes)\b',
        r'\b(?:Thanks|Thank you),?\s+([A-Z][a-z]+)\b'
    ]
    
    # Pattern 3: Role assignments "[Name] will handle" or "[Name] is responsible"
    assignment_patterns = [
        r'\b([A-Z][a-z]+)\s+will\s+(?:handle|do|take care of|work on)\b',
        r'\b([A-Z][a-z]+)\s+is\s+(?:responsible|in charge|handling)\b',
        r'\b([A-Z][a-z]+)\s+should\s+(?:handle|do|take care of)\b'
    ]
    
    all_patterns = intro_patterns + address_patterns + assignment_patterns
    
    for pattern in all_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = match[0]
            if len(match) > 1 and match.isalpha():
                potential_names.add(match.title())
    
    return list(potential_names)

def improve_speaker_detection_prompting() -> str:
    """Return optimized Whisper prompting for better speaker detection."""
    return """This is a business meeting with multiple participants discussing projects, making decisions, and assigning action items. Participants frequently mention each other by name, introduce themselves with their roles, and reference who is responsible for various tasks. Please capture all speaker names, role mentions, and task assignments clearly."""