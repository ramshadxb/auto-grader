import { NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to run shell commands
const runCommand = (command, cwd) => {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: stderr || stdout || error.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
};

export async function POST(req) {
  try {
    const { githubUrl } = await req.json();

    if (!githubUrl || !githubUrl.includes("github.com")) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
    }

    // Extract owner and repo from URL
    const urlParts = githubUrl.split("github.com/")[1].split("/");
    const owner = urlParts[0];
    const repo = urlParts[1].replace(".git", "");

    // 1. Fetch Repository Tree to check for files
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    let treeResponse = await fetch(apiUrl);
    
    // Fallback to 'master' branch if 'main' fails
    if (!treeResponse.ok) {
        treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
    }

    if (!treeResponse.ok) {
      return NextResponse.json({ error: "Repository not found or is private." }, { status: 404 });
    }

    const treeData = await treeResponse.json();
    const cFileNode = treeData.tree.find((file) => file.path.toLowerCase().endsWith(".c"));
    const cFilePath = cFileNode ? cFileNode.path : null;
    const files = treeData.tree.map((file) => file.path.toLowerCase());

    const filesFound = {
      readme: files.some((f) => f.includes("readme.md") || f.includes("read.me")),
      prompt: files.some((f) => f === "prompt.txt"),
      main: !!cFilePath,
    };

    let compileSuccess = false;
    let mainC_Content = "";
    let aiFeedback = "AI Evaluation skipped because no .c file was found.";
    let totalScore = 0;

    // Base score for files (1 point each)
    if (filesFound.readme) totalScore += 1;
    if (filesFound.prompt) totalScore += 1;
    if (filesFound.main) totalScore += 1;

    // 2. If a .c file exists, download it, compile it, and evaluate it
    if (filesFound.main) {
      const branch = treeResponse.url.includes("master") ? "master" : "main";
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cFilePath}`;
      const mainResponse = await fetch(rawUrl);
      
      if (mainResponse.ok) {
        mainC_Content = await mainResponse.text();

        // 3. Compile Check (Using local GCC)
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "grader-"));
        const tempFilePath = path.join(tempDir, "main.c");
        await fs.writeFile(tempFilePath, mainC_Content);

        const compileResult = await runCommand(`gcc main.c -o out.exe`, tempDir);
        compileSuccess = compileResult.success;
        
        if (compileSuccess) {
          totalScore += 1; // 1 point for compiling
        }

        // Clean up temp dir
        await fs.rm(tempDir, { recursive: true, force: true });

        // 4. AI Code Evaluation
        if (process.env.GEMINI_API_KEY) {
          try {
            const prompt = `
              You are an expert C programming teacher grading a student's assignment.
              Review the following C code and provide nuanced, structured feedback.
              Please provide the feedback EXCLUSIVELY in markdown bullet points:
              * **Strengths**: What the student did well.
              * **Areas for Improvement**: Logic flaws, inefficiencies, or styling issues.
              * **Security/Vulnerabilities**: Any unsafe functions (e.g., gets()) or buffer overflows.
              Keep the feedback constructive, detailed, and formatted neatly as a list.
              
              Code:
              ${mainC_Content}
            `;
            const response = await genai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
            });
            aiFeedback = response.text;
            totalScore += 1; // 1 point for having qualitative code to review
          } catch (aiError) {
            console.error("AI Error:", aiError);
            aiFeedback = "AI Evaluation failed. Please check your API key.";
          }
        } else {
           aiFeedback = "GEMINI_API_KEY is not set. Please add it to your .env.local file to enable AI reviews.";
        }
      }
    }

    // 5. Plagiarism Check (Placeholder for Dolos integration)
    // Real integration would download the repo into a folder, run `npx dolos`, and parse the output CSV.
    const plagiarismScore = Math.floor(Math.random() * 20); // Placeholder 0-20%

    return NextResponse.json({
      score: totalScore,
      filesFound,
      compiles: compileSuccess,
      plagiarismScore,
      feedback: aiFeedback,
    });

  } catch (error) {
    console.error("Grader Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
