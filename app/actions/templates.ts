'use server';

import { prisma } from '@/lib/prisma';
import { EducationLevel, QuestionType } from '@prisma/client';
import { writeAuditLog } from './audit';


export async function getTemplateDetails(templateId: string) {
  return prisma.template.findUnique({
    where: { id: templateId },
    include: {
      department: true,
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

export async function createTemplateAction(
  title: string,
  level: EducationLevel,
  departmentId?: string | null
) {
  if (!title.trim()) throw new Error("Template title is required");

  let depId: string | null = null;
  if (level === 'JHS') {
    let dep = await prisma.department.findFirst({ where: { level: 'JHS' } });
    if (!dep) {
      dep = await prisma.department.create({
        data: { name: 'Junior High School Department', level: 'JHS' }
      });
    }
    depId = dep.id;
  } else if (level === 'SHS') {
    let dep = await prisma.department.findFirst({ where: { level: 'SHS' } });
    if (!dep) {
      dep = await prisma.department.create({
        data: { name: 'Senior High School Department', level: 'SHS' }
      });
    }
    depId = dep.id;
  } else {
    depId = departmentId || null;
  }

  const template = await prisma.template.create({
    data: {
      title,
      level,
      scaleType: (level === 'JHS' || level === 'SHS') ? '1_TO_5' : '0_TO_4',
      departmentId: depId,
    },
  });

  await writeAuditLog('TEMPLATE_CREATED', { desc: `Created template "${title}" for ${level}` });

  return template;
}

export async function updateTemplateMetadata(
  templateId: string,
  data: {
    title: string;
    level: EducationLevel;
    scaleType?: string;
    departmentId?: string | null;
  }
) {
  if (!data.title.trim()) throw new Error("Template title is required");

  let depId: string | null = null;
  if (data.level === 'JHS') {
    let dep = await prisma.department.findFirst({ where: { level: 'JHS' } });
    if (!dep) {
      dep = await prisma.department.create({
        data: { name: 'Junior High School Department', level: 'JHS' }
      });
    }
    depId = dep.id;
  } else if (data.level === 'SHS') {
    let dep = await prisma.department.findFirst({ where: { level: 'SHS' } });
    if (!dep) {
      dep = await prisma.department.create({
        data: { name: 'Senior High School Department', level: 'SHS' }
      });
    }
    depId = dep.id;
  } else {
    depId = data.departmentId || null;
  }

  const template = await prisma.template.update({
    where: { id: templateId },
    data: {
      title: data.title,
      level: data.level,
      scaleType: data.scaleType || undefined,
      departmentId: depId
    }
  });

  await writeAuditLog('TEMPLATE_METADATA_UPDATED', { desc: `Updated metadata of template "${data.title}"` });

  return template;
}

export async function deleteTemplateAction(templateId: string) {
  const target = await prisma.template.findUnique({
    where: { id: templateId },
    select: { title: true }
  });

  const res = await prisma.template.delete({
    where: { id: templateId },
  });

  await writeAuditLog('TEMPLATE_DELETED', { desc: `Deleted template "${target?.title || templateId}"` });

  return res;
}

export async function saveEvaluationTemplate(templateId: string, data: {
  title: string;
  instructions?: string | null;
  scaleType?: string;
  level: EducationLevel;
  clusters: {
    id?: string;
    title: string;
    order: number;
    criteria: {
      id?: string;
      question: string;
      type: QuestionType;
      options?: any;
      order: number;
    }[];
  }[];
}) {
  // 1. Fetch current database state for diffing
  const existingTemplate = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      clusters: {
        include: { criteria: true }
      }
    }
  });

  if (!existingTemplate) throw new Error("Template not found");

  const existingClusterIds = existingTemplate.clusters.map(c => c.id);
  const existingCriteriaIds = existingTemplate.clusters.flatMap(c => c.criteria.map(q => q.id));

  // 2. Identify incoming IDs
  const incomingClusterIds = data.clusters.map(c => c.id).filter(Boolean) as string[];
  const incomingCriteriaIds = data.clusters
    .flatMap(c => c.criteria.map(q => q.id))
    .filter(Boolean) as string[];

  // 3. Find IDs to delete
  const clusterIdsToDelete = existingClusterIds.filter(id => !incomingClusterIds.includes(id));
  const criteriaIdsToDelete = existingCriteriaIds.filter(id => !incomingCriteriaIds.includes(id));

  // 4. Perform deletions
  if (criteriaIdsToDelete.length > 0) {
    const answeredCount = await prisma.answer.count({
      where: {
        criterionId: { in: criteriaIdsToDelete }
      }
    });
    if (answeredCount > 0) {
      throw new Error(
        "Cannot delete questions that already have student responses. " +
        "Please deactivate this template, duplicate it, and make changes on the copy instead."
      );
    }
    await prisma.criterion.deleteMany({
      where: { id: { in: criteriaIdsToDelete } }
    });
  }
  if (clusterIdsToDelete.length > 0) {
    await prisma.cluster.deleteMany({
      where: { id: { in: clusterIdsToDelete } }
    });
  }

  // 5. Update main Template info
  await prisma.template.update({
    where: { id: templateId },
    data: {
      title: data.title,
      instructions: data.instructions || null,
      scaleType: data.scaleType || undefined,
      level: data.level,
    }
  });

  // 6. Upsert Clusters and Criteria
  for (const clusterData of data.clusters) {
    let clusterId = clusterData.id;

    if (clusterId) {
      // Update existing cluster
      await prisma.cluster.update({
        where: { id: clusterId },
        data: {
          title: clusterData.title,
          order: clusterData.order,
        }
      });
    } else {
      // Create new cluster
      const newCluster = await prisma.cluster.create({
        data: {
          templateId,
          title: clusterData.title,
          order: clusterData.order,
        }
      });
      clusterId = newCluster.id;
    }

    // Now upsert criteria inside this cluster
    for (const critData of clusterData.criteria) {
      if (critData.id) {
        // Update existing criterion
        await prisma.criterion.update({
          where: { id: critData.id },
          data: {
            clusterId: clusterId!,
            question: critData.question,
            type: critData.type,
            options: critData.options || null,
            order: critData.order,
          }
        });
      } else {
        // Create new criterion
        await prisma.criterion.create({
          data: {
            clusterId: clusterId!,
            question: critData.question,
            type: critData.type,
            options: critData.options || null,
            order: critData.order,
          }
        });
      }
    }
  }

  await writeAuditLog('TEMPLATE_SAVED', { desc: `Saved questions and configuration of template "${data.title}"` });

  return { success: true };
}

export async function setActiveTemplateAction(
  templateId: string,
  activationType: 'GLOBAL' | 'OVERRIDE',
  targetDepartmentId?: string
) {
  const target = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      clusters: {
        include: {
          criteria: true
        }
      }
    }
  });

  if (!target) throw new Error("Template not found");

  return prisma.$transaction(async (tx) => {
    if (activationType === 'GLOBAL') {
      // Deactivate all active templates for this level that are GLOBAL (departmentId is null)
      await tx.template.updateMany({
        where: {
          level: target.level,
          departmentId: null,
          isActive: true
        },
        data: { isActive: false }
      });

      // Update target template to be active and global
      await tx.template.update({
        where: { id: templateId },
        data: {
          isActive: true,
          departmentId: null
        }
      });
    } else {
      // OVERRIDE Activation: clone template and assign strictly to targetDepartmentId
      if (!targetDepartmentId) {
        throw new Error("Target department must be specified for department override.");
      }

      // Deactivate any currently active templates for this level assigned strictly to targetDepartmentId
      await tx.template.updateMany({
        where: {
          level: target.level,
          departmentId: targetDepartmentId,
          isActive: true
        },
        data: { isActive: false }
      });

      const dept = await tx.department.findUnique({
        where: { id: targetDepartmentId }
      });
      const suffix = dept ? ` (${dept.name})` : ' (Override)';

      // Create deep clone template header
      const cloned = await tx.template.create({
        data: {
          title: `${target.title}${suffix}`,
          instructions: target.instructions,
          scaleType: target.scaleType,
          level: target.level,
          departmentId: targetDepartmentId,
          isActive: true
        }
      });

      // Create cloned clusters and criteria
      for (const cluster of target.clusters) {
        const clonedCluster = await tx.cluster.create({
          data: {
            templateId: cloned.id,
            title: cluster.title,
            order: cluster.order
          }
        });

        for (const criterion of cluster.criteria) {
          await tx.criterion.create({
            data: {
              clusterId: clonedCluster.id,
              question: criterion.question,
              type: criterion.type,
              options: criterion.options || undefined,
              order: criterion.order
            }
          });
        }
      }
    }
  });

  await writeAuditLog('TEMPLATE_ACTIVATE', { desc: `Activated template "${target?.title || ''}" (Scope: ${activationType})` });
}

export async function deactivateTemplateAction(templateId: string) {
  const target = await prisma.template.findUnique({
    where: { id: templateId },
    select: { title: true }
  });

  const res = await prisma.template.update({
    where: { id: templateId },
    data: { isActive: false }
  });

  await writeAuditLog('TEMPLATE_DEACTIVATE', { desc: `Deactivated template "${target?.title || templateId}"` });

  return res;
}

