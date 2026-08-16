"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function scoreColor(score) {
  if (score >= 75) return "#028a57";
  if (score >= 50) return "#c9922a";
  return "#c0392b";
}

function ScoreRing({ score }) {
  const size = 148;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(Math.max(score, 0), 100) / 100);
  const color = scoreColor(score);

  return (
    <div style={styles.ringWrap}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#eceff1"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div style={styles.ringCenter}>
        <span style={{ ...styles.scoreNumber, color }}>{score}</span>
        <span style={styles.scoreMax}>/100</span>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {children}
    </div>
  );
}

export default function ResultPage() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | empty | ready
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("cv_analysis_result");
    if (!raw) {
      setStatus("empty");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.ats_analysis) throw new Error("invalid shape");
      setResult(parsed);
      setStatus("ready");
    } catch {
      setStatus("empty");
    }
  }, []);

  const handleReset = () => {
    sessionStorage.removeItem("cv_analysis_result");
    router.push("/");
  };

  if (status === "loading") return null;

  if (status === "empty") {
    return (
      <div style={{ ...styles.wrapper, alignItems: "center" }}>
        <div style={styles.emptyBox}>
          <p style={styles.emptyText}>
            Belum ada CV yang dianalisis. Upload dulu buat lihat hasilnya di sini.
          </p>
          <button style={styles.button} onClick={() => router.push("/")}>
            Upload CV
          </button>
        </div>
      </div>
    );
  }

  const { file_name, ats_analysis } = result;
  const {
    ats_score,
    ringkasan_profil,
    missing_skills = [],
    kelebihan = [],
    kekurangan = [],
    saran_perbaikan = [],
  } = ats_analysis;

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <p style={styles.fileName}>{file_name}</p>

        <ScoreRing score={ats_score} />
        <p style={styles.scoreLabel}>Skor ATS</p>

        <Section title="Ringkasan">
          <p style={styles.paragraph}>{ringkasan_profil}</p>
        </Section>

        {kelebihan.length > 0 && (
          <Section title="Kelebihan">
            <ul style={styles.list}>
              {kelebihan.map((item, i) => (
                <li key={i} style={styles.listItem}>{item}</li>
              ))}
            </ul>
          </Section>
        )}

        {kekurangan.length > 0 && (
          <Section title="Kekurangan">
            <ul style={styles.list}>
              {kekurangan.map((item, i) => (
                <li key={i} style={styles.listItem}>{item}</li>
              ))}
            </ul>
          </Section>
        )}

        {missing_skills.length > 0 && (
          <Section title="Skill yang Perlu Ditambahkan">
            <div style={styles.tagWrap}>
              {missing_skills.map((skill, i) => (
                <span key={i} style={styles.tag}>{skill}</span>
              ))}
            </div>
          </Section>
        )}

        {saran_perbaikan.length > 0 && (
          <Section title="Saran Perbaikan">
            <ol style={styles.list}>
              {saran_perbaikan.map((item, i) => (
                <li key={i} style={styles.listItem}>{item}</li>
              ))}
            </ol>
          </Section>
        )}

        <button style={styles.button} onClick={handleReset}>
          Analisis CV Lain
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    background: "#fafafa",
    padding: "56px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#14171a",
  },
  container: {
    width: "100%",
    maxWidth: "540px",
  },
  fileName: {
    fontSize: "13px",
    color: "#8a8f98",
    textAlign: "center",
    marginBottom: "24px",
  },
  ringWrap: {
    position: "relative",
    width: "148px",
    height: "148px",
    margin: "0 auto",
  },
  ringCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: "2px",
  },
  scoreNumber: {
    fontSize: "40px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  scoreMax: {
    fontSize: "15px",
    color: "#b0b5bb",
  },
  scoreLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#8a8f98",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "12px 0 40px",
  },
  section: {
    marginBottom: "28px",
    paddingBottom: "28px",
    borderBottom: "1px solid #eceff1",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "10px",
    color: "#14171a",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  paragraph: {
    fontSize: "15px",
    lineHeight: 1.6,
    color: "#3c4249",
    margin: 0,
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  listItem: {
    fontSize: "15px",
    lineHeight: 1.5,
    color: "#3c4249",
  },
  tagWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  tag: {
    fontSize: "13px",
    padding: "5px 12px",
    borderRadius: "999px",
    background: "#fdecec",
    color: "#c0392b",
    fontWeight: 500,
  },
  button: {
    marginTop: "8px",
    padding: "13px 20px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#fff",
    background: "#028a57",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    width: "100%",
  },
  emptyBox: {
    maxWidth: "360px",
    textAlign: "center",
    margin: "auto",
  },
  emptyText: {
    fontSize: "15px",
    color: "#5a6069",
    lineHeight: 1.6,
    marginBottom: "20px",
  },
};