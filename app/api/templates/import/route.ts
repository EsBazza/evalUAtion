import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/app/actions/audit';
import mammoth from 'mammoth';
import { EducationLevel } from '@prisma/client';
import { createRequire } from "module";
import https from 'https';

const requireNode = createRequire(import.meta.url);

function callGeminiAPI(apiKey: string, prompt: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-goog-api-key': apiKey
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e: any) {
            reject(new Error("Failed to parse response: " + e.message));
          }
        } else {
          try {
            const errObj = JSON.parse(data);
            reject(new Error(errObj.error?.message || `HTTP Status ${res.statusCode}`));
          } catch (e) {
            reject(new Error(`HTTP Status ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const level = formData.get('level') as EducationLevel;

    if (!file || !title || !level) {
      return NextResponse.json({ success: false, error: "Missing required file, title, or level parameter" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    let rawText = '';
    const fileName = file.name.toLowerCase();

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
      return NextResponse.json({ success: false, error: "Unsupported file extension. Only .docx, .pdf, and .txt files are supported." }, { status: 400 });
    }

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ success: false, error: "No readable text could be extracted from the uploaded document." }, { status: 400 });
    }

    const systemPrompt = `You are an expert data extraction assistant. Read the provided raw text from a university evaluation form and convert it into a strict JSON object matching this schema: {"instructions": "Optional instructions text extracted from document headers or instructions sections", "scaleType": "0_TO_4" | "1_TO_5", "clusters": [ { "title": "Cluster Name", "order": 1, "criteria": [ { "question": "Question text", "type": "SCALE_0_TO_4" | "SCALE_1_TO_5" | "TEXT_LONG" | "CHECKBOX_AREAS" | "RADIO_EXPECTATION", "order": 1, "options": ["Option 1", "Option 2"] } ] } ] }.

CRITICAL INSTRUCTIONS:
1. Extract any global instructions or guidelines text of the evaluation form (e.g., "Please rate your instructor based on the following scale...", "Read each statement carefully..."). Set it as the "instructions" field in the root JSON.
2. Detect the rating scale used in the document. If it uses a 1 to 5 scale (e.g. '1 2 3 4 5' or '1: Very Poor...'), set "scaleType" to "1_TO_5" and set question types to "SCALE_1_TO_5". If it uses a 0 to 4 scale (e.g. '0 1 2 3 4' or '0: Not at all true...'), set "scaleType" to "0_TO_4" and set question types to "SCALE_0_TO_4".
3. DO NOT IGNORE the sections at the bottom (e.g., "OTHER COMMENTS AND SUGGESTIONS", "How would you like to rate this teacher", "characteristics", "areas to improve").
4. Create a final Cluster titled "General Feedback" for these trailing questions.
5. For the "rate this teacher" question, set type to "RADIO_EXPECTATION" and populate the options array with the choices.
6. For the "needs to improve on" question, set the type to "CHECKBOX_AREAS" and populate the options array with the list of skills.
7. For open-ended questions (strong points, characteristics), set the type to "TEXT_LONG".
8. Return ONLY valid JSON, no markdown formatting.`;

    const rawApiKey = process.env.GEMINI_API_KEY;
    if (!rawApiKey) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY environment variable is not configured." }, { status: 500 });
    }
    const apiKey = rawApiKey.replace(/"/g, "").trim();

    let resJson;
    try {
      resJson = await callGeminiAPI(apiKey, `${systemPrompt}\n\nRaw Text:\n${rawText}`);
    } catch (apiErr: any) {
      console.error("Gemini API direct https call failed:", apiErr);
      return NextResponse.json({ success: false, error: apiErr.message || "Gemini API call failed" }, { status: 500 });
    }

    const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let data;
    try {
      data = JSON.parse(responseText.trim());
    } catch (err) {
      console.error("Failed to parse Gemini output text:", responseText);
      return NextResponse.json({ success: false, error: "AI output was not valid JSON. Please try again with a cleaner document." }, { status: 500 });
    }

    if (!data || !data.clusters || !Array.isArray(data.clusters)) {
      return NextResponse.json({ success: false, error: "AI did not return the expected structured evaluation clusters." }, { status: 500 });
    }

    let departmentId: string | null = null;
    if (level === 'JHS' || level === 'SHS') {
      const defaultDep = await prisma.department.findFirst({
        where: { level }
      });
      departmentId = defaultDep?.id || null;
    }

    const template = await prisma.$transaction(async (tx) => {
      const createdTemplate = await tx.template.create({
        data: {
          title,
          level,
          isActive: false,
          instructions: data.instructions || null,
          scaleType: data.scaleType || (level === 'JHS' || level === 'SHS' ? '1_TO_5' : '0_TO_4'),
          ...(departmentId ? { departmentId } : {})
        }
      });

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

    await writeAuditLog('TEMPLATE_IMPORT', { desc: `Imported template "${title}" from document file via Gemini AI` });

    return NextResponse.json({ success: true, templateId: template.id });
  } catch (error: any) {
    console.error("Template import API error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to import template" }, { status: 500 });
  }
}
