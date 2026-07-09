'use server';

import { EducationLevel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptClientPayload } from '@/lib/crypto';


export async function getDepartments(level: EducationLevel) {
  return prisma.department.findMany({
    where: { level },
  });
}

export async function getSections(departmentId: string) {
  return prisma.section.findMany({
    where: { departmentId },
  });
}

export async function getProfessorsBySection(sectionId: string) {
  return prisma.professor.findMany({
    where: {
      sections: {
        some: {
          id: sectionId,
        },
      },
    },
  });
}

export async function getEvaluationTemplate(level: EducationLevel, departmentId?: string) {
  // 1. Try to find a template specific to the department
  let temp = await prisma.template.findFirst({
    where: {
      level,
      isActive: true,
      departmentId: departmentId || undefined,
    },
    include: {
      clusters: {
        include: {
          criteria: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  // 2. Fall back to the global template (where departmentId is null) if no specific override exists
  if (!temp && departmentId) {
    temp = await prisma.template.findFirst({
      where: {
        level,
        isActive: true,
        departmentId: null,
      },
      include: {
        clusters: {
          include: {
            criteria: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  return temp;
}

import { createHash } from 'crypto';

export async function submitProfessorEvaluation(data: {
  studentEmail: string;
  sectionId: string;
  professorId: string;
  departmentId: string;
  templateId: string;
  answers: {
    criterionId: string;
    score?: number;
    textVal?: string;
    jsonVal?: any;
  }[];
  encryptedPayload?: string; // base64
  iv?: string; // base64
  authTag?: string; // base64
  clientPublicKey?: string; // base64
  sessionId?: string;
}) {
  // Get active system term settings
  const settings = await prisma.systemSetting.findUnique({ where: { id: 'active' } });
  const termYear = settings?.academicYear || "2026-2027";
  const termSem = settings?.semester || "1st";

  return prisma.$transaction(async (tx) => {
    // 1. Check if receipt already exists to prevent duplicate submissions
    const existingReceipt = await tx.evaluationReceipt.findUnique({
      where: {
        studentEmail_professorId_sectionId_academicYear_semester: {
          studentEmail: data.studentEmail,
          professorId: data.professorId,
          sectionId: data.sectionId,
          academicYear: termYear,
          semester: termSem
        }
      }
    });

    if (existingReceipt) {
      throw new Error("You have already evaluated this professor for this section in the current term.");
    }

    // 2. Create the Evaluation Receipt (attendance tracking)
    await tx.evaluationReceipt.create({
      data: {
        studentEmail: data.studentEmail,
        professorId: data.professorId,
        sectionId: data.sectionId,
        academicYear: termYear,
        semester: termSem
      }
    });

    // 3. Handle SecureEvaluation Audit Recording (ECDH+AES payload)
    const submissionHash = createHash('sha256')
      .update(`${data.studentEmail}:${data.professorId}:${data.sectionId}:${termYear}:${termSem}`)
      .digest('hex');

    // If client encryption payload is present, write to SecureEvaluation
    if (data.encryptedPayload && data.iv && data.authTag && data.clientPublicKey && data.sessionId) {
      try {
        // Validate payload integrity by performing test decryption
        const decryptedPayload = decryptClientPayload(
          data.sessionId,
          data.clientPublicKey,
          data.encryptedPayload,
          data.iv,
          data.authTag
        );

        if (!decryptedPayload || !decryptedPayload.answers) {
          throw new Error('Payload verification failed: invalid structure.');
        }
        await tx.secureEvaluation.create({
          data: {
            facultyId: data.professorId,
            periodId: `${termYear}:${termSem}`,
            encryptedData: new Uint8Array(Buffer.from(data.encryptedPayload, 'base64')),
            iv: new Uint8Array(Buffer.from(data.iv, 'base64')),
            authTag: new Uint8Array(Buffer.from(data.authTag, 'base64')),
            submissionHash
          }
        });
      } catch (cryptoErr: any) {
        console.error('Crypto handshake or decryption failed:', cryptoErr);
        throw new Error('Security verification failed. Please try again.');
      }
    } else {
      // Fallback: If no client-side encryption is provided (e.g. backend seed or simple testing),
      // encrypt payload on-the-fly to populate SecureEvaluation audit trail.
      const localPayload = { answers: data.answers };
      const { encryptWithServerKey } = await import('@/lib/crypto');
      const { ciphertext, iv, authTag } = encryptWithServerKey(localPayload);
      
      await tx.secureEvaluation.create({
        data: {
          facultyId: data.professorId,
          periodId: `${termYear}:${termSem}`,
          encryptedData: new Uint8Array(ciphertext),
          iv: new Uint8Array(iv),
          authTag: new Uint8Array(authTag),
          submissionHash
        }
      });
    }    // 4. Invalidate/Stale the ScoreCache for this professor and term
    await tx.scoreCache.upsert({
      where: {
        professorId_academicYear_semester: {
          professorId: data.professorId,
          academicYear: termYear,
          semester: termSem
        }
      },
      update: { isStale: true },
      create: {
        professorId: data.professorId,
        academicYear: termYear,
        semester: termSem,
        isStale: true
      }
    });

    // 5. Create the standard Evaluation response (completely anonymous payload for charts/analytics)
    return tx.evaluation.create({
      data: {
        sectionId: data.sectionId,
        professorId: data.professorId,
        departmentId: data.departmentId,
        templateId: data.templateId,
        academicYear: termYear,
        semester: termSem,
        answers: {
          create: data.answers.map(ans => ({
            criterionId: ans.criterionId,
            score: ans.score,
            textVal: ans.textVal,
            jsonVal: ans.jsonVal
          }))
        }
      }
    });
  });
}

