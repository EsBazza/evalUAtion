'use server';

import { GoogleGenAI } from "@google/genai";
import { prisma } from '@/lib/prisma';
import mammoth from 'mammoth';
// @ts-ignore
if (typeof global.DOMMatrix === 'undefined') {
  // @ts-ignore
  global.DOMMatrix = class DOMMatrix {};
}
import { EducationLevel } from '@prisma/client';
import { createRequire } from "module";

const requireNode = createRequire(import.meta.url);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function importTemplateFromFile(formData: FormData) {
  const file = formData.get('file') as File;
  const title = formData.get('title') as string;
  const level = formData.get('level') as EducationLevel;

  if (!file || !title || !level) {
    throw new Error("Missing required file, title, or level parameter");
  }

  // Step A (Extraction): Convert file arrayBuffer to Buffer and parse raw text based on type
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  let rawText = '';
  const fileName = file.name.toLowerCase();

  try {
    if (fileName.endsWith('.docx')) {
      const { value } = await mammoth.extractRawText({ buffer });
      rawText = value;
    } else if (fileName.endsWith('.pdf')) {
      const pkgName = "pdf" + "-parse";
      const pdfParseRaw = requireNode(pkgName);
      const pdfParse = typeof pdfParseRaw === 'function' ? pdfParseRaw : pdfParseRaw.default;
      const pdfData = await pdfParse(buffer);
      rawText = pdfData.text;
    } else if (fileName.endsWith('.txt')) {
      rawText = buffer.toString('utf-8');
    } else {
      throw new Error("Unsupported file extension. Only .docx, .pdf, and .txt files are supported.");
    }
  } catch (err: any) {
    console.error("Text extraction failed:", err);
    throw new Error(`Failed to parse file text: ${err.message || 'File may be corrupted'}`);
  }

  if (!rawText || !rawText.trim()) {
    throw new Error("No readable text could be extracted from the uploaded document.");
  }

  // Step B (AI Parsing): Call Gemini models with prompt
  const systemPrompt = `You are an expert data extraction assistant. Read the provided raw text from a university evaluation form and convert it into a strict JSON object matching this schema: {"clusters": [ { "title": "Cluster Name", "order": 1, "criteria": [ { "question": "Question text", "type": "SCALE_0_TO_4" | "TEXT_LONG" | "CHECKBOX_AREAS" | "RADIO_EXPECTATION", "order": 1, "options": ["Option 1", "Option 2"] } ] } ] }.

CRITICAL INSTRUCTIONS:
1. Extract all numbered clusters and their 1-5/0-4 scale questions (use SCALE_0_TO_4 for these).
2. DO NOT IGNORE the sections at the bottom (e.g., "OTHER COMMENTS AND SUGGESTIONS", "How would you like to rate this teacher", "characteristics", "areas to improve").
3. Create a final Cluster titled "General Feedback" for these trailing questions.
4. For the "rate this teacher" question, set type to "RADIO_EXPECTATION" and populate the options array with the choices.
5. For the "needs to improve on" question, set the type to "CHECKBOX_AREAS" and populate the options array with the list of skills.
6. For open-ended questions (strong points, characteristics), set the type to "TEXT_LONG".
Return ONLY valid JSON, no markdown formatting.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${systemPrompt}\n\nRaw Text:\n${rawText}`,
  });

  const responseText = response.text || "";
  let data;
  try {
    const cleanJsonText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    data = JSON.parse(cleanJsonText);
  } catch (err) {
    console.error("Failed to parse Gemini output:", responseText);
    throw new Error("AI output was not valid JSON. Please try again with a cleaner document.");
  }

  if (!data || !data.clusters || !Array.isArray(data.clusters)) {
    throw new Error("AI did not return the expected structured evaluation clusters.");
  }

  // Step C: Look up the default department if JHS or SHS
  let departmentId: string | null = null;
  if (level === 'JHS' || level === 'SHS') {
    const defaultDep = await prisma.department.findFirst({
      where: { level }
    });
    departmentId = defaultDep?.id || null;
  }

  // Step D (Database Hydration): Create template inside transaction
  const template = await prisma.$transaction(async (tx) => {
    // 1. Create the template record
    const createdTemplate = await tx.template.create({
      data: {
        title,
        level,
        isActive: false,
        ...(departmentId ? { departmentId } : {})
      }
    });

    // 2. Add clusters and criteria
    for (const cluster of data.clusters) {
      const createdCluster = await tx.cluster.create({
        data: {
          title: cluster.title,
          order: cluster.order || 1,
          templateId: createdTemplate.id
        }
      });

      if (cluster.criteria && Array.isArray(cluster.criteria)) {
        for (const crit of cluster.criteria) {
          await tx.criterion.create({
            data: {
              question: crit.question,
              type: crit.type || 'SCALE_0_TO_4',
              options: crit.options || null,
              order: crit.order || 1,
              clusterId: createdCluster.id
            }
          });
        }
      }
    }

    return createdTemplate;
  });

  return { success: true, templateId: template.id };
}
