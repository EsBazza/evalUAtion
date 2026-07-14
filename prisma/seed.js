const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:admin@localhost:5432/evaluation_db?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Section code helpers
function generateCodeSegment(length) {
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return result;
}

function getDeptAbbreviation(level, deptName) {
  const nameUpper = deptName.toUpperCase();
  if (level === 'JHS' || nameUpper.includes('JUNIOR HIGH')) return 'JHS';
  if (level === 'SHS' || nameUpper.includes('SENIOR HIGH')) return 'SHS';
  if (level === 'GRADUATE') return 'GRAD';

  if (nameUpper.includes('ENGINEERING') || nameUpper.includes('ARCHITECTURE') || nameUpper.includes('CEA')) return 'CEA';
  if (nameUpper.includes('COMPUTER') || nameUpper.includes('INFORMATION TECHNOLOGY') || nameUpper.includes('CIT')) return 'CIT';
  if (nameUpper.includes('EDUCATION') || nameUpper.includes('TEACHER') || nameUpper.includes('SED')) return 'SED';
  if (nameUpper.includes('BUSINESS') || nameUpper.includes('PUBLIC ADMINISTRATION') || nameUpper.includes('SBPA')) return 'SBPA';
  if (nameUpper.includes('ACCOUNTANCY') || nameUpper.includes('COA')) return 'COA';
  if (nameUpper.includes('NURSING') || nameUpper.includes('PHARMACY') || nameUpper.includes('CONP')) return 'CONP';
  if (nameUpper.includes('HOSPITALITY') || nameUpper.includes('TOURISM') || nameUpper.includes('CHTM')) return 'CHTM';
  if (nameUpper.includes('ARTS') || nameUpper.includes('SCIENCES') || nameUpper.includes('SAS')) return 'SAS';

  return 'COL';
}

function formatAcademicYear(year) {
  const digits = year.replace(/[^0-9]/g, '');
  if (digits.length === 8) {
    return digits.slice(2, 4) + digits.slice(6, 8);
  }
  return digits.slice(-4) || '2627';
}

function formatSemester(semester) {
  const clean = semester.toUpperCase();
  if (clean.includes('1ST') || clean.includes('1')) return '1S';
  if (clean.includes('2ND') || clean.includes('2')) return '2S';
  return 'SU';
}

function buildSectionCode(level, deptName, randomPart, academicYear, semester) {
  const dept = getDeptAbbreviation(level, deptName);
  const year = formatAcademicYear(academicYear);
  const sem = formatSemester(semester);
  return `UA-${dept}-${randomPart}-${sem}${year}`;
}

async function main() {
  console.log("Starting database seeding...");

  // Clean existing data in correct dependency order
  await prisma.cryptoSession.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.scoreCache.deleteMany();
  await prisma.secureEvaluation.deleteMany();
  await prisma.aiSummary.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.evaluationReceipt.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.cluster.deleteMany();
  await prisma.template.deleteMany();
  await prisma.user.deleteMany();
  await prisma.professor.deleteMany();
  await prisma.section.deleteMany();
  await prisma.department.deleteMany();

  console.log("Existing data cleaned.");

  const activeYear = "2026-2027";
  const activeSem = "1st";

  // 1. Define Department and Section configurations
  const deptConfigs = [
    { name: "Junior High School Department", code: "JHS", level: "JHS", minYear: 7, maxYear: 10, namePrefix: "Grade " },
    { name: "Senior High School Department", code: "SHS", level: "SHS", minYear: 11, maxYear: 12, namePrefix: "Grade " },
    { name: "College of Engineering and Architecture", code: "CEA", level: "COLLEGE", minYear: 1, maxYear: 5, namePrefix: "Year " },
    { name: "College of Information Technology", code: "CIT", level: "COLLEGE", minYear: 1, maxYear: 4, namePrefix: "Year " },
    { name: "School of Education", code: "SED", level: "COLLEGE", minYear: 1, maxYear: 4, namePrefix: "Year " },
    { name: "School of Business and Public Administration", code: "SBPA", level: "COLLEGE", minYear: 1, maxYear: 4, namePrefix: "Year " },
    { name: "College of Accountancy", code: "COA", level: "COLLEGE", minYear: 1, maxYear: 4, namePrefix: "Year " },
    { name: "College of Nursing and Pharmacy", code: "CONP", level: "COLLEGE", minYear: 1, maxYear: 4, namePrefix: "Year " },
    { name: "College of Hospitality and Tourism Management", code: "CHTM", level: "COLLEGE", minYear: 1, maxYear: 4, namePrefix: "Year " },
    { name: "School of Arts and Sciences", code: "SAS", level: "COLLEGE", minYear: 1, maxYear: 4, namePrefix: "Year " },
    { name: "Graduate School", code: "GRADUATE", level: "GRADUATE", minYear: 1, maxYear: 2, namePrefix: "Year " }
  ];

  const createdDepts = {};
  const createdSectionsByDept = {};

  for (const config of deptConfigs) {
    const dept = await prisma.department.create({
      data: { name: config.name, level: config.level }
    });
    createdDepts[config.code] = dept;
    createdSectionsByDept[config.code] = [];

    // Create 3 sections for each grade/year with auto-generated code
    for (let yr = config.minYear; yr <= config.maxYear; yr++) {
      for (const letter of ["A", "B", "C"]) {
        const secName = `${config.code} ${config.namePrefix}${yr}-${letter}`;
        const randPart = generateCodeSegment(4);
        const secCode = buildSectionCode(config.level, config.name, randPart, activeYear, activeSem);
        
        const sec = await prisma.section.create({
          data: { 
            name: secName, 
            code: secCode,
            departmentId: dept.id 
          }
        });
        createdSectionsByDept[config.code].push(sec);
      }
    }
  }

  console.log("Departments and Sections created.");

  // Helper to shuffle array (to assign random sections)
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 2. Create Professors (10 for each department, assigned to 3 random sections)
  const firstNames = [
    "Dr. Jane", "Prof. John", "Dr. Alan", "Prof. Grace", "Dr. Nikola", "Ms. Alice", "Ms. Marie", "Mr. Bob",
    "Mrs. Ada", "Mr. Isaac", "Dr. Richard", "Ms. Katherine", "Prof. Charles", "Dr. Rosalind", "Prof. Adam",
    "Prof. Luca", "Dr. Florence", "Dr. Alexander", "Chef Auguste", "Ms. Julia", "Dr. Stephen", "Prof. Albert",
    "Dr. Thomas", "Prof. James", "Dr. Robert", "Ms. Margaret", "Dr. Dorothy", "Prof. Barbara", "Dr. Patricia",
    "Prof. William", "Dr. David", "Ms. Elizabeth", "Dr. Mary", "Prof. Richard", "Dr. Joseph", "Ms. Susan"
  ];

  const lastNames = [
    "Smith", "Doe", "Turing", "Hopper", "Tesla", "Cooper", "Curie", "Marley", "Lovelace", "Newton",
    "Feynman", "Johnson", "Babbage", "Franklin", "Adamson", "Pacioli", "Nightingale", "Fleming", "Escoffier",
    "Child", "Hawking", "Einstein", "Edison", "Maxwell", "Bohr", "Hamilton", "Hodgkin", "McClintock",
    "Shakespeare", "Darwin", "Galileo", "Copernicus", "Kepler", "Planck", "Pasteur", "Mendel"
  ];

  let deptIndex = 0;
  for (const config of deptConfigs) {
    const dept = createdDepts[config.code];
    const sections = createdSectionsByDept[config.code] || [];

    for (let k = 1; k <= 10; k++) {
      const fName = firstNames[(deptIndex * 10 + k) % firstNames.length];
      const lName = lastNames[(deptIndex * 13 + k) % lastNames.length];
      const name = `${fName} ${lName}`;
      // Ensure unique email by appending department code and index
      const sanitizedName = name.toLowerCase().replace(/[^a-z]/g, ".");
      const email = `${sanitizedName}.${config.code.toLowerCase()}.${k}@ua.edu.ph`;

      // Get 3 random sections
      const shuffledSections = shuffle(sections);
      const connectedSections = shuffledSections.slice(0, 3).map(s => ({ id: s.id }));

      await prisma.professor.create({
        data: {
          name,
          email,
          departmentId: dept.id,
          sections: { connect: connectedSections }
        }
      });
    }
    deptIndex++;
  }

  console.log("110 Professors created and linked to random sections.");

  // Helper to seed a template for College and Graduate levels
  async function seedCollegeOrGradTemplate(title, level, deptId) {
    const template = await prisma.template.create({
      data: {
        title,
        level,
        departmentId: deptId,
        isActive: true
      }
    });

    // Cluster 1
    const c1 = await prisma.cluster.create({
      data: { title: "Cluster 1: Communication Skills", order: 1, templateId: template.id }
    });
    const c1Qs = [
      "Uses language that leads me to easily understand lessons and follow through",
      "Uses appropriate medium of instructions (English, Filipino, Kapampangan)",
      "Speaks loud enough for me to hear clearly",
      "Demonstrates enthusiasm in teaching that enhances our interest in learning (by attending classes regularly, maximizing class time, etc.)",
      "Teaches lively and makes us pay attention for entire period and participate actively."
    ];
    for (let i = 0; i < c1Qs.length; i++) {
      await prisma.criterion.create({
        data: { question: c1Qs[i], type: "SCALE_0_TO_4", order: i + 1, clusterId: c1.id }
      });
    }

    // Cluster 2
    const c2 = await prisma.cluster.create({
      data: { title: "Cluster 2: Instructional Skills, Classroom Management, Student Engagement in the Learning Process, and Monitoring Student Progress", order: 2, templateId: template.id }
    });
    const c2Qs = [
      "Asks questions effectively that encourage to think/or answer difficult questions",
      "Guides us by setting the objectives of the lesson at the start of the period, and in summarizing the lesson toward the end of the class",
      "Uses any one or a combination of audio-visual materials (chalkboard, whiteboard, power point slides, posters/pictures, videos, sounds, music) that makes me appreciate the lessons better",
      "Moves about and/or makes gestures (hand and body movements) to sustain our alertness, engaging us in discussion",
      "Manifest concern over our progress (e.g., giving timely feedback of performance, returning test papers, verbal affirmation of participation, refraining from embarrassing us, etc.)"
    ];
    for (let i = 0; i < c2Qs.length; i++) {
      await prisma.criterion.create({
        data: { question: c2Qs[i], type: "SCALE_0_TO_4", order: i + 1, clusterId: c2.id }
      });
    }

    // Cluster 3
    const c3 = await prisma.cluster.create({
      data: { title: "Cluster 3: Command of the Subject Matter", order: 3, templateId: template.id }
    });
    const c3Qs = [
      "Shows mastery of the subject matter (e.g., discussed the lesson confidently with minimal dependence on his/her notes/power point slides, etc.)",
      "Relates the lesson to practical life situations/problems by spontaneously citing useful and relevant examples",
      "Presents and discusses lesson in a clear and orderly manner that was easy for me to follow",
      "Integrates Christian values/UA graduate attributes in class discussion",
      "Emphasizes the essential concepts enabling me to capture the main focus of the lessons (such as reviewing, repeating words/statements, using non-verbal language, varying voice inflection and facial expressions)."
    ];
    for (let i = 0; i < c3Qs.length; i++) {
      await prisma.criterion.create({
        data: { question: c3Qs[i], type: "SCALE_0_TO_4", order: i + 1, clusterId: c3.id }
      });
    }

    // Cluster 4
    const c4 = await prisma.cluster.create({
      data: { title: "Cluster 4: Online Distance Learning", order: 4, templateId: template.id }
    });
    const c4Qs = [
      "Demonstrates the ability to effectively use word-processing, spreadsheet and presentation software, when applicable",
      "Incorporates multimedia and visual resources into the online module",
      "Utilizes synchronous and asynchronous tools (e.g., discussion boards, chat tools, electronic whiteboards) effectively",
      "Manages well the Google Workspace for education (Google Classroom is well updated with needed modules and activities are aligned with lessons/learning competencies being targeted)",
      "Demonstrates the ability to anticipate and overcome challenges and problems in the online classroom"
    ];
    for (let i = 0; i < c4Qs.length; i++) {
      await prisma.criterion.create({
        data: { question: c4Qs[i], type: "SCALE_0_TO_4", order: i + 1, clusterId: c4.id }
      });
    }

    // Other Comments and Suggestions
    const cOther = await prisma.cluster.create({
      data: { title: "Other Comments and Suggestions", order: 5, templateId: template.id }
    });

    await prisma.criterion.create({
      data: {
        question: "How would you like to rate this teacher? Check only one.",
        type: "RADIO_EXPECTATION",
        options: [
          "The teacher exceeds my expectations.",
          "The teacher meets my expectations.",
          "The teacher does not meet my expectations."
        ],
        order: 1,
        clusterId: cOther.id
      }
    });

    await prisma.criterion.create({
      data: { question: "What are the teacher’s strong points?", type: "TEXT_LONG", order: 2, clusterId: cOther.id }
    });

    await prisma.criterion.create({
      data: { question: "What characteristics of the teachers being evaluated do you like best?", type: "TEXT_LONG", order: 3, clusterId: cOther.id }
    });

    await prisma.criterion.create({
      data: {
        question: "In which area/s do you think the teacher needs to improve on?",
        type: "CHECKBOX_AREAS",
        options: [
          "Communication Skills",
          "Instructional Skills",
          "Classroom Management",
          "Student Engagement in the Learning Process",
          "Monitoring Student Progress",
          "Command of the Subject Matter",
          "Online Distance Learning",
          "None",
          "Others"
        ],
        order: 4,
        clusterId: cOther.id
      }
    });
  }

  // 3. Create Templates for each level
  // 3.1 College Templates (for each college department)
  const collegeCodes = ["CEA", "CIT", "SED", "SBPA", "COA", "CONP", "CHTM", "SAS"];
  for (const code of collegeCodes) {
    const dept = createdDepts[code];
    await seedCollegeOrGradTemplate(`${code} Faculty Evaluation Form 2026`, "COLLEGE", dept.id);
  }

  // 3.2 JHS Template
  const jhsDept = createdDepts["JHS"];
  const jhsTemplate = await prisma.template.create({
    data: {
      title: "JHS Faculty Evaluation Form 2026",
      level: "JHS",
      departmentId: jhsDept.id,
      scaleType: "1_TO_5",
      isActive: true
    }
  });

  const clusterJhsPerformance = await prisma.cluster.create({
    data: { title: "Cluster 1: Teacher Performance", order: 1, templateId: jhsTemplate.id }
  });

  const jhsQuestions = [
    "The teacher is prepared for the lesson and presents the subject matter in an orderly manner.",
    "The teacher speaks in a language which is understood by the students.",
    "The teacher explains the subject matter well.",
    "The teacher is able to arouse the student's interest and stimulate thinking.",
    "The teacher promptly return tests and requirements submitted with the appropriate grades.",
    "The teacher is able to maintain class discipline.",
    "The teacher is able to win the respect of the students.",
    "The teacher shows interest and concern for the welfare of the students.",
    "The teacher is punctual and is always present.",
    "The teacher appears neat, has pleasing personality and poise."
  ];

  for (let i = 0; i < jhsQuestions.length; i++) {
    await prisma.criterion.create({
      data: {
        question: jhsQuestions[i],
        type: "SCALE_1_TO_5",
        order: i + 1,
        clusterId: clusterJhsPerformance.id
      }
    });
  }

  await prisma.criterion.create({
    data: {
      question: "Write your comments and suggestions for your teacher below.",
      type: "TEXT_LONG",
      order: jhsQuestions.length + 1,
      clusterId: clusterJhsPerformance.id
    }
  });

  // 3.3 SHS Template
  const shsDept = createdDepts["SHS"];
  const shsTemplate = await prisma.template.create({
    data: {
      title: "SHS Faculty Evaluation Form 2026",
      level: "SHS",
      departmentId: shsDept.id,
      scaleType: "1_TO_5",
      isActive: true
    }
  });

  // Cluster: Homeroom/Class Adviser
  const clusterShsAdviser = await prisma.cluster.create({
    data: { title: "Homeroom/Class Adviser", order: 1, templateId: shsTemplate.id }
  });

  const shsAdviserScaleQuestions = [
    "Creates a welcoming environment where students feel comfortable sharing their concerns.",
    "Initiates communication and responds promptly to students' questions and needs.",
    "Takes time to connect personally with students to better understand their goals and challenges.",
    "Takes charge of the order and discipline inside the classroom and maintains camaraderie among the students."
  ];

  for (let i = 0; i < shsAdviserScaleQuestions.length; i++) {
    await prisma.criterion.create({
      data: {
        question: shsAdviserScaleQuestions[i],
        type: "SCALE_1_TO_5",
        order: i + 1,
        clusterId: clusterShsAdviser.id
      }
    });
  }

  await prisma.criterion.create({
    data: { question: "What are the adviser’s strong points?", type: "TEXT_LONG", order: 5, clusterId: clusterShsAdviser.id }
  });

  await prisma.criterion.create({
    data: { question: "What are the adviser’s weak points?", type: "TEXT_LONG", order: 6, clusterId: clusterShsAdviser.id }
  });

  // Cluster 1: Communication Skills
  const clusterShsComm = await prisma.cluster.create({
    data: { title: "CLUSTER 1. Communication Skills", order: 2, templateId: shsTemplate.id }
  });

  const shsCommQuestions = [
    "Uses language that leads me to easily understand lessons and follow through",
    "Uses appropriate medium of instructions (English, Filipino, Kapampangan)",
    "Speaks loud enough for me to hear clearly",
    "Demonstrates enthusiasm in teaching that enhances our interest in learning (by attending classes regularly, maximizing class time, etc.)",
    "Teaches lively and makes us pay attention for entire period and participate actively."
  ];

  for (let i = 0; i < shsCommQuestions.length; i++) {
    await prisma.criterion.create({
      data: {
        question: shsCommQuestions[i],
        type: "SCALE_1_TO_5",
        order: i + 1,
        clusterId: clusterShsComm.id
      }
    });
  }

  // Cluster 2: Instructional Skills, Classroom Management, Student Engagement, and Progress
  const clusterShsInstruction = await prisma.cluster.create({
    data: { title: "CLUSTER 2. Instructional Skills, Classroom Management, Student Engagement in the Learning Process, and Monitoring Student Progress", order: 3, templateId: shsTemplate.id }
  });

  const shsInstructionQuestions = [
    "Asks questions effectively that encourage to think/or answer difficult questions",
    "Guides us by setting the objectives of the lesson at the start of the period, and in summarizing the lesson toward the end of the class",
    "Uses Powerpoint slides, videos, music, sounds, and other appropriate applications that makes me appreciate the lesson better.",
    "Employs various techniques to sustain our alertness and engagement in the discussion.",
    "Manifest concern over our progress (e.g., giving timely feedback of performance, returning test papers, verbal affirmation of participation, refraining from embarrassing us, etc.)"
  ];

  for (let i = 0; i < shsInstructionQuestions.length; i++) {
    await prisma.criterion.create({
      data: {
        question: shsInstructionQuestions[i],
        type: "SCALE_1_TO_5",
        order: i + 1,
        clusterId: clusterShsInstruction.id
      }
    });
  }

  // Cluster 3: Command of the Subject Matter
  const clusterShsSubject = await prisma.cluster.create({
    data: { title: "CLUSTER 3. Command of the Subject Matter", order: 4, templateId: shsTemplate.id }
  });

  const shsSubjectQuestions = [
    "Shows mastery of the subject matter (e.g., discussed the lesson confidently)",
    "Relates the lesson to practical life situations/problems by spontaneously citing useful and relevant examples",
    "Presents and discusses lesson in a clear and orderly manner that was easy for me to follow",
    "Integrates Christian values/UA graduate attributes in class discussion",
    "Emphasizes the essential concepts enabling me to capture the main focus of the lessons (such as reviewing, repeating words/statements, using non-verbal language, varying voice inflection and facial expressions)."
  ];

  for (let i = 0; i < shsSubjectQuestions.length; i++) {
    await prisma.criterion.create({
      data: {
        question: shsSubjectQuestions[i],
        type: "SCALE_1_TO_5",
        order: i + 1,
        clusterId: clusterShsSubject.id
      }
    });
  }

  // Cluster: OTHER COMMENTS AND SUGGESTIONS
  const clusterShsFeedback = await prisma.cluster.create({
    data: { title: "OTHER COMMENTS AND SUGGESTIONS", order: 5, templateId: shsTemplate.id }
  });

  await prisma.criterion.create({
    data: {
      question: "How would you like to rate this teacher? Check only one.",
      type: "RADIO_EXPECTATION",
      options: [
        "The teacher exceeds my expectations.",
        "The teacher meets my expectations.",
        "The teacher does not meet my expectations."
      ],
      order: 1,
      clusterId: clusterShsFeedback.id
    }
  });

  await prisma.criterion.create({
    data: { question: "What are the teacher’s strong points?", type: "TEXT_LONG", order: 2, clusterId: clusterShsFeedback.id }
  });

  await prisma.criterion.create({
    data: { question: "What characteristics of the teachers being evaluated do you like best?", type: "TEXT_LONG", order: 3, clusterId: clusterShsFeedback.id }
  });

  await prisma.criterion.create({
    data: { question: "In which area/s do you think the teacher needs to improve on?", type: "TEXT_LONG", order: 4, clusterId: clusterShsFeedback.id }
  });

  // 3.4 Graduate Template
  const gradDept = createdDepts["GRADUATE"];
  await seedCollegeOrGradTemplate("Graduate School Faculty Evaluation Form 2026", "GRADUATE", gradDept.id);

  // 4. Add default admin user in DB
  await prisma.user.create({
    data: {
      email: "admin@ua.edu.ph",
      name: "System Admin",
      role: "ADMIN"
    }
  });

  // 5. Generate mock evaluations and pre-computed scores for all professors
  console.log("Generating mock evaluations & rankings cache...");
  const professors = await prisma.professor.findMany({
    include: {
      sections: true,
      department: true
    }
  });

  const templates = await prisma.template.findMany({
    include: {
      clusters: {
        include: { criteria: true }
      }
    }
  });

  const students = [
    { email: "student1@ua.edu.ph", name: "Juan Dela Cruz" },
    { email: "student2@ua.edu.ph", name: "Maria Clara" },
    { email: "student3@ua.edu.ph", name: "Jose Rizal" },
  ];

  // Seed mock student users so their names are resolved in attendance logs
  for (const s of students) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, role: "STUDENT" },
      create: { email: s.email, name: s.name, role: "STUDENT" }
    });
  }

  // Build a section -> professors map from the database join table
  const allSections = await prisma.section.findMany({
    include: {
      professors: true,
      department: true
    }
  });

  // Pick 1 section per department to keep seeding fast
  const seededSections = new Map();
  for (const sec of allSections) {
    if (sec.professors.length === 0) continue;
    const deptId = sec.departmentId;
    if (!seededSections.has(deptId)) {
      seededSections.set(deptId, sec);
    }
  }

  const evaluatedProfIds = new Set();

  for (const [, section] of seededSections) {
    const sectionProfs = section.professors;

    // Each mock student evaluates ALL professors in this section
    for (const student of students) {
      for (const prof of sectionProfs) {
        const profTemplate = templates.find(t =>
          t.level === section.department.level &&
          (t.departmentId === section.departmentId || t.departmentId === null)
        );
        if (!profTemplate) continue;

        // Create Evaluation Receipt
        await prisma.evaluationReceipt.create({
          data: {
            studentEmail: student.email,
            professorId: prof.id,
            sectionId: section.id,
            academicYear: activeYear,
            semester: activeSem
          }
        });

        // Create answers
        const answersData = [];
        for (const cluster of profTemplate.clusters) {
          for (const crit of cluster.criteria) {
            let score = null;
            let textVal = null;
            let jsonVal = null;

            if (crit.type === 'SCALE_0_TO_4') {
              score = Math.floor(Math.random() * 3) + 2;
            } else if (crit.type === 'SCALE_1_TO_5') {
              score = Math.floor(Math.random() * 3) + 3;
            } else if (crit.type === 'RADIO_EXPECTATION') {
              textVal = crit.options ? JSON.parse(JSON.stringify(crit.options))[Math.floor(Math.random() * 3)] : "The teacher meets my expectations.";
            } else if (crit.type === 'CHECKBOX_AREAS') {
              jsonVal = ["Communication Skills", "Instructional Skills"];
            } else if (crit.type === 'TEXT_LONG') {
              textVal = "Great teacher, very interactive and helpful in class discussions.";
            }

            answersData.push({ criterionId: crit.id, score, textVal, jsonVal });
          }
        }

        // Create Evaluation
        await prisma.evaluation.create({
          data: {
            sectionId: section.id,
            professorId: prof.id,
            departmentId: section.departmentId,
            templateId: profTemplate.id,
            academicYear: activeYear,
            semester: activeSem,
            answers: { create: answersData }
          }
        });

        evaluatedProfIds.add(prof.id);
      }
    }
  }

  // Create ScoreCache and AiSummary for each evaluated professor
  for (const profId of evaluatedProfIds) {
    const mathScore = Math.floor(Math.random() * 20) + 76;
    const aiScore = Math.floor(Math.random() * 20) + 76;
    const compositeScore = Math.round(mathScore * 0.7 + aiScore * 0.3);

    await prisma.scoreCache.create({
      data: {
        professorId: profId,
        academicYear: activeYear,
        semester: activeSem,
        scaleScore: mathScore,
        aiQualityScore: aiScore,
        compositeScore: compositeScore,
        isStale: false,
        lastComputedAt: new Date()
      }
    });

    await prisma.aiSummary.create({
      data: {
        professorId: profId,
        academicYear: activeYear,
        semester: activeSem,
        summaryText: "Students generally appreciate the professor's clarity and organized method of teaching. Strong skills in explanation and student engagement are consistently demonstrated.",
        ratingScore: aiScore
      }
    });
  }

  console.log("Templates, Clusters, Criteria, Users, and Mock Rankings seeded successfully!");
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
