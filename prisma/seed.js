const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:admin@localhost:5432/evaluation_db?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  // Clean existing data
  await prisma.aiSummary.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.cluster.deleteMany();
  await prisma.template.deleteMany();
  await prisma.user.deleteMany();
  await prisma.professor.deleteMany();
  await prisma.section.deleteMany();
  await prisma.department.deleteMany();

  console.log("Existing data cleaned.");

  // 1. Create Departments
  const ccs = await prisma.department.create({
    data: { name: "College of Computer Studies", level: "COLLEGE" }
  });
  const coe = await prisma.department.create({
    data: { name: "College of Engineering", level: "COLLEGE" }
  });
  const shsAcademic = await prisma.department.create({
    data: { name: "Senior High School Department", level: "SHS" }
  });
  const jhsDept = await prisma.department.create({
    data: { name: "Junior High School Department", level: "JHS" }
  });

  console.log("Departments created.");

  // 2. Create Sections
  const secCcs4A = await prisma.section.create({
    data: { name: "BSCS 4-A", departmentId: ccs.id }
  });
  const secCcs4B = await prisma.section.create({
    data: { name: "BSCS 4-B", departmentId: ccs.id }
  });
  const secCoe4A = await prisma.section.create({
    data: { name: "BSCE 4-A", departmentId: coe.id }
  });
  const secShs11A = await prisma.section.create({
    data: { name: "Grade 11-STEM A", departmentId: shsAcademic.id }
  });
  const secJhs7A = await prisma.section.create({
    data: { name: "Grade 7-St. Jude", departmentId: jhsDept.id }
  });

  console.log("Sections created.");

  // 3. Create Professors
  const profJane = await prisma.professor.create({
    data: {
      name: "Dr. Jane Smith",
      email: "jane.smith@ua.edu.ph",
      departmentId: ccs.id,
      sections: { connect: [{ id: secCcs4A.id }, { id: secCcs4B.id }] }
    }
  });

  const profJohn = await prisma.professor.create({
    data: {
      name: "Prof. John Doe",
      email: "john.doe@ua.edu.ph",
      departmentId: coe.id,
      sections: { connect: [{ id: secCoe4A.id }] }
    }
  });

  const profAlice = await prisma.professor.create({
    data: {
      name: "Ms. Alice Cooper",
      email: "alice.cooper@ua.edu.ph",
      departmentId: shsAcademic.id,
      sections: { connect: [{ id: secShs11A.id }] }
    }
  });

  const profBob = await prisma.professor.create({
    data: {
      name: "Mr. Bob Marley",
      email: "bob.marley@ua.edu.ph",
      departmentId: jhsDept.id,
      sections: { connect: [{ id: secJhs7A.id }] }
    }
  });

  console.log("Professors created.");

  // 4. Create Templates, Clusters, Criteria
  // 4.1 College Template
  const collegeTemplate = await prisma.template.create({
    data: {
      title: "College Faculty Evaluation Form 2026",
      level: "COLLEGE",
      departmentId: ccs.id
    }
  });

  const clusterCollegeComm = await prisma.cluster.create({
    data: {
      title: "Communication Skills",
      order: 1,
      templateId: collegeTemplate.id
    }
  });

  await prisma.criterion.create({
    data: {
      question: "The instructor explains concepts clearly and responds to queries effectively.",
      type: "SCALE_0_TO_4",
      order: 1,
      clusterId: clusterCollegeComm.id
    }
  });

  await prisma.criterion.create({
    data: {
      question: "The instructor communicates online requirements and course logistics properly.",
      type: "SCALE_0_TO_4",
      order: 2,
      clusterId: clusterCollegeComm.id
    }
  });

  const clusterCollegeExpect = await prisma.cluster.create({
    data: {
      title: "Expectation & Compliance",
      order: 2,
      templateId: collegeTemplate.id
    }
  });

  await prisma.criterion.create({
    data: {
      question: "Which class session expectations were met?",
      type: "RADIO_EXPECTATION",
      options: ["Met all expectations", "Met most expectations", "Met some expectations", "Failed expectations"],
      order: 1,
      clusterId: clusterCollegeExpect.id
    }
  });

  await prisma.criterion.create({
    data: {
      question: "Which areas of instruction need the most improvement?",
      type: "CHECKBOX_AREAS",
      options: ["Punctuality", "Grading Fairness", "Syllabus Compliance", "Online Material Quality"],
      order: 2,
      clusterId: clusterCollegeExpect.id
    }
  });

  await prisma.criterion.create({
    data: {
      question: "Please provide any written comments or feedback for improvement.",
      type: "TEXT_LONG",
      order: 3,
      clusterId: clusterCollegeExpect.id
    }
  });

  // 4.2 JHS Template
  const jhsTemplate = await prisma.template.create({
    data: {
      title: "JHS Faculty Evaluation Form 2026",
      level: "JHS",
      departmentId: jhsDept.id
    }
  });

  const clusterJhsPerformance = await prisma.cluster.create({
    data: {
      title: "Teacher Performance",
      order: 1,
      templateId: jhsTemplate.id
    }
  });

  await prisma.criterion.create({
    data: {
      question: "The teacher displays mastery of the subject matter.",
      type: "SCALE_1_TO_5",
      order: 1,
      clusterId: clusterJhsPerformance.id
    }
  });

  await prisma.criterion.create({
    data: {
      question: "The teacher creates a positive learning environment.",
      type: "SCALE_1_TO_5",
      order: 2,
      clusterId: clusterJhsPerformance.id
    }
  });

  await prisma.criterion.create({
    data: {
      question: "General comments on teacher performance:",
      type: "TEXT_LONG",
      order: 3,
      clusterId: clusterJhsPerformance.id
    }
  });

  // 5. Add default admin user in DB
  await prisma.user.create({
    data: {
      email: "admin@ua.edu.ph",
      name: "System Admin",
      role: "ADMIN"
    }
  });

  console.log("Templates, Clusters, Criteria and Users seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed: ", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
