import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/app/actions/audit';
import mammoth from 'mammoth';
import { EducationLevel } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';

// Use the lightweight preview model for all AI template work
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

const ALLOWED_EXTENSIONS = ['.txt', '.docx'] as const;
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB hard cap

function getApiKey(): string {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) throw new Error('GEMINI_API_KEY environment variable is not configured.');
  return raw.replace(/"/g, '').trim();
}

function stripMarkdownFences(text: string): string {
  // Gemini sometimes wraps JSON in ```json ... ``` — strip it before parsing
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

async function extractText(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (fileName.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (fileName.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }

  throw new Error('Unsupported file type. Only .txt and .docx files are accepted.');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const level = formData.get('level') as EducationLevel | null;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!file || !title?.trim() || !level) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: file, title, or level.' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    if (!hasAllowedExtension) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only .txt and .docx files are accepted.' },
        { status: 400 }
      );
    }

    // MIME type secondary check (browsers may send different MIME types for .doc vs .docx)
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type) && file.type !== '') {
      // Don't hard-reject on MIME mismatch — some OS/browsers send generic types
      // just log and continue; the extension check above is authoritative
      console.warn(`Unexpected MIME type "${file.type}" for file "${file.name}" — proceeding with extension check.`);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File is too large. Maximum allowed size is 5 MB.' },
        { status: 400 }
      );
    }

    // ── Text Extraction ─────────────────────────────────────────────────────
    let rawText: string;
    try {
      rawText = await extractText(file);
    } catch (extractErr: any) {
      return NextResponse.json(
        { success: false, error: extractErr.message || 'Failed to read file content.' },
        { status: 400 }
      );
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { success: false, error: 'The uploaded document appears to be empty or has no readable text.' },
        { status: 400 }
      );
    }

    // Truncate very large documents to protect against token overflows (~16k chars ≈ ~4k tokens)
    const truncatedText = rawText.length > 16000
      ? rawText.slice(0, 16000) + '\n\n[Document truncated for processing]'
      : rawText;

    // ── Gemini AI Parsing ───────────────────────────────────────────────────
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert data extraction assistant for a university faculty evaluation system.
Read the provided raw text from a university evaluation form and convert it into a strict JSON object.

OUTPUT SCHEMA (return ONLY valid JSON, no markdown, no extra text):
{
  "instructions": "Optional global instructions text from the document header",
  "scaleType": "0_TO_4" | "1_TO_5",
  "clusters": [
    {
      "title": "Cluster Name",
      "order": 1,
      "criteria": [
        {
          "question": "Question text",
          "type": "SCALE_0_TO_4" | "SCALE_1_TO_5" | "TEXT_LONG" | "CHECKBOX_AREAS" | "RADIO_EXPECTATION",
          "order": 1,
          "options": ["Option 1", "Option 2"]
        }
      ]
    }
  ]
}

EXTRACTION RULES:
1. Extract any global instructions or guidelines (e.g. "Please rate your instructor...") into the "instructions" field.
2. Detect the rating scale: if the doc uses 1–5 scale → scaleType "1_TO_5" + question type "SCALE_1_TO_5". If 0–4 → "0_TO_4" + "SCALE_0_TO_4".
3. Do NOT ignore trailing sections (e.g. "OTHER COMMENTS", "SUGGESTIONS", "Areas to Improve").
4. Group trailing/general feedback into a final cluster titled "General Feedback".
5. For "rate this teacher" or similar → type "RADIO_EXPECTATION" with options array.
6. For "areas to improve" or checkboxes → type "CHECKBOX_AREAS" with options array.
7. For open-ended text questions → type "TEXT_LONG", options should be null or omitted.
8. Keep cluster and criterion order values sequential starting from 1.
9. Return ONLY the JSON object. No markdown fences, no explanation.`;

    let responseText: string;
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${systemPrompt}\n\nDocument Text:\n${truncatedText}`,
        config: {
          responseMimeType: 'application/json',
        },
      });
      responseText = response.text ?? '';
    } catch (aiErr: any) {
      console.error('Gemini API error during template import:', aiErr);
      const message = aiErr?.message || 'Gemini API call failed';
      if (message.includes('API_KEY') || message.includes('401')) {
        return NextResponse.json({ success: false, error: 'AI service authentication failed. Check GEMINI_API_KEY.' }, { status: 500 });
      }
      if (message.includes('quota') || message.includes('429')) {
        return NextResponse.json({ success: false, error: 'AI quota exceeded. Please try again in a few minutes.' }, { status: 429 });
      }
      return NextResponse.json({ success: false, error: `AI parsing failed: ${message}` }, { status: 500 });
    }

    // ── Parse AI Output ─────────────────────────────────────────────────────
    let data: any;
    try {
      const cleaned = stripMarkdownFences(responseText);
      data = JSON.parse(cleaned);
    } catch {
      // Last resort: try to extract a JSON object from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0]);
        } catch {
          console.error('Failed to parse Gemini output:', responseText.slice(0, 500));
          return NextResponse.json(
            { success: false, error: 'AI returned an invalid structure. Please try again with a cleaner document.' },
            { status: 500 }
          );
        }
      } else {
        console.error('No JSON found in Gemini output:', responseText.slice(0, 500));
        return NextResponse.json(
          { success: false, error: 'AI output could not be parsed. Try a simpler or cleaner document.' },
          { status: 500 }
        );
      }
    }

    if (!data?.clusters || !Array.isArray(data.clusters) || data.clusters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'AI did not detect any evaluation clusters in the document. Ensure the file contains structured evaluation content.' },
        { status: 422 }
      );
    }

    // ── Database Write ──────────────────────────────────────────────────────
    let departmentId: string | null = null;
    if (level === 'JHS' || level === 'SHS') {
      const defaultDep = await prisma.department.findFirst({ where: { level } });
      departmentId = defaultDep?.id || null;
    }

    const template = await prisma.$transaction(async (tx) => {
      const createdTemplate = await tx.template.create({
        data: {
          title: title.trim(),
          level,
          isActive: false,
          instructions: data.instructions?.trim() || null,
          scaleType: data.scaleType || (level === 'JHS' || level === 'SHS' ? '1_TO_5' : '0_TO_4'),
          ...(departmentId ? { departmentId } : {}),
        },
      });

      for (const [clusterIdx, cluster] of data.clusters.entries()) {
        if (!cluster.title) continue;

        const createdCluster = await tx.cluster.create({
          data: {
            title: cluster.title,
            order: typeof cluster.order === 'number' ? cluster.order : clusterIdx + 1,
            templateId: createdTemplate.id,
          },
        });

        if (Array.isArray(cluster.criteria)) {
          for (const [critIdx, crit] of cluster.criteria.entries()) {
            if (!crit.question) continue;
            await tx.criterion.create({
              data: {
                question: crit.question,
                type: crit.type || (data.scaleType === '1_TO_5' ? 'SCALE_1_TO_5' : 'SCALE_0_TO_4'),
                options: crit.options && Array.isArray(crit.options) && crit.options.length > 0
                  ? crit.options
                  : null,
                order: typeof crit.order === 'number' ? crit.order : critIdx + 1,
                clusterId: createdCluster.id,
              },
            });
          }
        }
      }

      return createdTemplate;
    });

    await writeAuditLog('TEMPLATE_IMPORT', {
      desc: `Imported template "${title.trim()}" from "${file.name}" via Gemini AI (${GEMINI_MODEL})`,
    });

    return NextResponse.json({ success: true, templateId: template.id });
  } catch (error: any) {
    console.error('Template import API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred during import.' },
      { status: 500 }
    );
  }
}
