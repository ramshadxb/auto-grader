"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [githubUrl, setGithubUrl] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [results, setResults] = useState(null);

  const handleGrade = async (e) => {
    e.preventDefault();
    if (!githubUrl) return;

    setIsGrading(true);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "An error occurred during grading.");
      } else {
        setResults(data);
      }
    } catch (err) {
      alert("Failed to connect to grading server.");
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className="animate-fade-in">AutoGrader AI</h1>
        <p className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
          Automated evaluation, compilation check, and plagiarism detection for student projects.
        </p>
      </div>

      <div className={`glass-panel ${styles.dashboard} animate-fade-in`} style={{ animationDelay: "0.2s" }}>
        <form onSubmit={handleGrade} className={styles.formGroup}>
          <input
            type="url"
            className="input-field"
            placeholder="Enter Student GitHub Repository URL..."
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            required
            disabled={isGrading}
          />
          <button type="submit" className="button-primary" disabled={isGrading}>
            {isGrading ? "Analyzing Repository..." : "Grade Assignment"}
          </button>
        </form>

        {results && (
          <div className={`${styles.resultsContainer} animate-fade-in`}>
            <div className={styles.scoreHeader}>
              <div className={styles.scoreBox}>
                <h3>Total Score</h3>
                <div className={styles.scoreValue}>{results.score}/5</div>
              </div>
              <div className={styles.scoreBox}>
                <h3>Plagiarism Risk</h3>
                <div className={styles.plagiarismValue} style={{ color: results.plagiarismScore > 30 ? 'var(--danger)' : 'var(--success)' }}>
                  {results.plagiarismScore}% Similarity
                </div>
              </div>
            </div>

            <div className={styles.checklist}>
              <h3>Required Files & Checks</h3>
              <ul>
                <li>
                  <span className={results.filesFound.readme ? styles.checkPass : styles.checkFail}></span>
                  README.md Found
                </li>
                <li>
                  <span className={results.filesFound.prompt ? styles.checkPass : styles.checkFail}></span>
                  prompt.txt Found
                </li>
                <li>
                  <span className={results.filesFound.main ? styles.checkPass : styles.checkFail}></span>
                  C source file (.c) Found
                </li>
                <li>
                  <span className={results.compiles ? styles.checkPass : styles.checkFail}></span>
                  C Code Compiles Successfully
                </li>
              </ul>
            </div>

            <div className={styles.feedback}>
              <h3>AI Code Review</h3>
              <p>{results.feedback}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
