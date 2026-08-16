import os
import json
import logging
import tempfile
from typing import List, Literal

from pydantic import BaseModel, Field
from pypdf import PdfReader
import instructor
from groq import Groq, RateLimitError, APIError, BadRequestError
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from tenacity import (
    retry,
    stop_after_attempt,
    wait_random_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("ResumeAnalyzer")

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY tidak ditemukan! Pastikan sudah dibuat di file .env")

DETECTION_MODEL = "openai/gpt-oss-20b"
ATS_MODEL = "openai/gpt-oss-120b"

groq_client = Groq(api_key=GROQ_API_KEY)
client = instructor.from_groq(groq_client, mode=instructor.Mode.JSON_SCHEMA)

class UnsupportedLanguageError(Exception):
    def __init__(self, detected_language: str, confidence: str, reason: str):
        self.detected_language = detected_language
        self.confidence = confidence
        self.reason = reason
        super().__init__(f"CV terdeteksi {detected_language} (confidence: {confidence}). {reason}")

class LanguageDetectionResult(BaseModel):
    detected_language: Literal["Indonesian", "English", "Mixed", "Other"] = Field(
        description="Bahasa DOMINAN pada kalimat deskriptif CV."
    )
    confidence: Literal["high", "medium", "low"]
    reason: str = Field(description="Alasan singkat 1 kalimat.")


class ATSAnalysisResult(BaseModel):
    ats_score: int = Field(ge=0, le=100)
    ringkasan_profil: str = Field(description="Ringkasan eksekutif 2 kalimat.")
    missing_skills: List[str] = Field(description="Maksimal 5 hard skills utama yang hilang.")
    kelebihan: List[str] = Field(description="Maksimal 3 kekuatan utama.")
    kekurangan: List[str] = Field(description="Maksimal 3 kelemahan penulisan.")
    saran_perbaikan: List[str] = Field(description="Maksimal 3 tindakan konkret.")


class WorkExperienceBullet(BaseModel):
    original: str
    improved: str = Field(description="Optimasi Google XYZ Formula.")


class SkillCategory(BaseModel):
    category_name: str
    skills: List[str] = Field(description="Maksimal 5 skill per kategori.")


class GrammarCorrectionItem(BaseModel):
    original_text: str
    corrected_text: str
    explanation: str


class ActionVerbSuggestion(BaseModel):
    original_verb: str
    recommended_verbs: List[str]
    example_sentence: str


class CVRewriteResult(BaseModel):
    rewritten_summary: str = Field(description="Professional summary (2-3 kalimat).")
    rewritten_work_experience: List[WorkExperienceBullet] = Field(description="Maksimal 3-4 poin terpenting.")
    structured_skills: List[SkillCategory] = Field(description="Maksimal 3 kategori skill.")
    grammar_corrections: List[GrammarCorrectionItem] = Field(description="Maksimal 3 perbaikan ejaan utama.")
    action_verbs_suggestions: List[ActionVerbSuggestion] = Field(description="Maksimal 3 rekomendasi kata kerja aksi.")


# Response schema akhir untuk endpoint FastAPI
class AnalyzeResponse(BaseModel):
    file_name: str
    language_detection: LanguageDetectionResult
    ats_analysis: ATSAnalysisResult

groq_retry_decorator = retry(
    retry=retry_if_exception_type((RateLimitError, APIError, BadRequestError)),
    wait=wait_random_exponential(min=2, max=20),
    stop=stop_after_attempt(5),
    before_sleep=before_sleep_log(logger, logging.WARNING),
)

@groq_retry_decorator
def detect_language(cv_text: str) -> LanguageDetectionResult:
    system_prompt = "Anda adalah pendeteksi bahasa CV. Tentukan bahasa dominan dari kalimat deskriptifnya."
    return client.chat.completions.create(
        model=DETECTION_MODEL,
        response_model=LanguageDetectionResult,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Deteksi bahasa (sampel):\n\n{cv_text[:1000]}"},
        ],
        temperature=0.0,
        max_tokens=800,
        reasoning_effort="low",
    )


@groq_retry_decorator
def analyze_cv(cv_text: str) -> ATSAnalysisResult:
    system_prompt = """
    Anda adalah AI Resume Specialist dan HR Expert.
    Analisis CV ini secara objektif berdasarkan standar kriteria ATS dalam Bahasa Indonesia.
    Batasi output: maksimal 3-5 poin untuk bidang list.
    """
    return client.chat.completions.create(
        model=ATS_MODEL,
        response_model=ATSAnalysisResult,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Analisis CV berikut:\n\n{cv_text}"},
        ],
        temperature=0.1,
        max_tokens=3000,
        reasoning_effort="low",
    )

def extract_text_from_pdf(pdf_path: str, max_chars: int = 4000) -> str:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"File PDF '{pdf_path}' tidak ditemukan.")

    reader = PdfReader(pdf_path)
    extracted_text = "\n".join(
        [page.extract_text() for page in reader.pages if page.extract_text()]
    )

    if not extracted_text.strip():
        raise ValueError("Gagal membaca teks dari PDF. Pastikan file bukan gambar/scan.")

    return extracted_text[:max_chars]

app = FastAPI(title="Resume ATS Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Resume Analyzer API is running"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_resume(file: UploadFile = File(...)):
    # Validasi tipe file
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Hanya menerima file .pdf!")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        cv_text = extract_text_from_pdf(tmp_path)
        lang_res = detect_language(cv_text)

        if lang_res.detected_language in ("English", "Mixed", "Other") and lang_res.confidence in (
            "high",
            "medium",
        ):
            raise UnsupportedLanguageError(
                lang_res.detected_language, lang_res.confidence, lang_res.reason
            )

        ats_res = analyze_cv(cv_text)

        return AnalyzeResponse(
            file_name=file.filename,
            language_detection=lang_res,
            ats_analysis=ats_res,
        )

    except UnsupportedLanguageError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Terjadi error saat menganalisis CV")
        raise HTTPException(status_code=500, detail=f"Terjadi error internal: {str(e)}")

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)