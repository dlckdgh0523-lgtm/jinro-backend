import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { getCurrentWeekRange, makeInviteCode } from "../src/common/domain";

const prisma = new PrismaClient();

const teacherPassword = "Teacher123!";
const studentPassword = "Student123!";
const schoolName = "진로나침반고";
const academicYear = 2026;
const inviteCode = "JN-2026-2A-SEED";

const upsertUser = async (input: {
  email: string;
  role: "TEACHER" | "STUDENT";
  password: string;
}) => {
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      role: input.role,
      status: "ACTIVE",
      passwordHash
    },
    create: {
      email: input.email,
      role: input.role,
      status: "ACTIVE",
      passwordHash
    }
  });
};

const main = async () => {
  const teacherUser = await upsertUser({
    email: "teacher.seed@jinro.local",
    role: "TEACHER",
    password: teacherPassword
  });
  const studentUser = await upsertUser({
    email: "student.seed@jinro.local",
    role: "STUDENT",
    password: studentPassword
  });

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {
      displayName: "김진로",
      schoolName,
      subjectAreas: ["국어", "진로"]
    },
    create: {
      userId: teacherUser.id,
      displayName: "김진로",
      schoolName,
      subjectAreas: ["국어", "진로"]
    }
  });

  const classroom = await prisma.classRoom.upsert({
    where: {
      schoolName_academicYear_gradeLevel_classNumber: {
        schoolName,
        academicYear,
        gradeLevel: 2,
        classNumber: 1
      }
    },
    update: {
      inviteCode,
      name: "2학년 1반",
      homeroomTeacherId: teacherProfile.id,
      deletedAt: null
    },
    create: {
      schoolName,
      academicYear,
      gradeLevel: 2,
      classNumber: 1,
      inviteCode: inviteCode || makeInviteCode(academicYear, 2, 1),
      name: "2학년 1반",
      homeroomTeacherId: teacherProfile.id
    }
  });

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: {
      displayName: "이학생",
      schoolName,
      gradeLevel: 2,
      classLabel: "1반",
      track: "STEM",
      onboardingCompleted: true,
      onboardingStep: 3,
      hasNaesin: true,
      hasSuneung: true,
      selectedSuneungSubjects: ["국어", "수학", "영어", "한국사"],
      targetCsatScore: 330,
      currentAverageGrade: 2.28,
      classroomId: classroom.id
    },
    create: {
      userId: studentUser.id,
      displayName: "이학생",
      schoolName,
      gradeLevel: 2,
      classLabel: "1반",
      track: "STEM",
      onboardingCompleted: true,
      onboardingStep: 3,
      hasNaesin: true,
      hasSuneung: true,
      selectedSuneungSubjects: ["국어", "수학", "영어", "한국사"],
      targetCsatScore: 330,
      currentAverageGrade: 2.28,
      classroomId: classroom.id
    }
  });

  await prisma.teacherStudentAssignment.upsert({
    where: {
      teacherProfileId_studentProfileId_classroomId_assignmentType: {
        teacherProfileId: teacherProfile.id,
        studentProfileId: studentProfile.id,
        classroomId: classroom.id,
        assignmentType: "HOMEROOM"
      }
    },
    update: {
      active: true,
      endDate: null
    },
    create: {
      teacherProfileId: teacherProfile.id,
      studentProfileId: studentProfile.id,
      classroomId: classroom.id,
      assignmentType: "HOMEROOM",
      active: true
    }
  });

  const university = await prisma.university.upsert({
    where: { name: "서울대학교" },
    update: { region: "서울" },
    create: {
      name: "서울대학교",
      region: "서울"
    }
  });

  const department = await prisma.department.upsert({
    where: {
      name_fieldGroup_universityId: {
        name: "컴퓨터공학과",
        fieldGroup: "공학",
        universityId: university.id
      }
    },
    update: {},
    create: {
      name: "컴퓨터공학과",
      fieldGroup: "공학",
      universityId: university.id
    }
  });

  await prisma.goalSetting.updateMany({
    where: { studentProfileId: studentProfile.id },
    data: { isActive: false }
  });

  await prisma.goalSetting.create({
    data: {
      studentProfileId: studentProfile.id,
      fieldGroup: "공학",
      universityId: university.id,
      universityNameSnapshot: university.name,
      departmentId: department.id,
      departmentNameSnapshot: department.name,
      targetGrade: 2.1,
      targetScore: 340,
      version: 1,
      isActive: true
    }
  });

  await prisma.admissionRecord.upsert({
    where: {
      id: "seed-admission-snu-cs-2025"
    },
    update: {
      universityId: university.id,
      departmentId: department.id,
      year: 2025,
      admissionType: "EARLY",
      category: "STUDENT_RECORD_COMPREHENSIVE",
      cutGradeText: "2.1",
      cutGradeNumeric: 2.1,
      seats: 12,
      sourceName: "대학알리미",
      sourceUrl: "https://www.academyinfo.go.kr",
      updatedDate: new Date("2025-11-01T00:00:00.000Z"),
      rawPayload: {
        year: 2025,
        type: "수시"
      }
    },
    create: {
      id: "seed-admission-snu-cs-2025",
      universityId: university.id,
      departmentId: department.id,
      year: 2025,
      admissionType: "EARLY",
      category: "STUDENT_RECORD_COMPREHENSIVE",
      cutGradeText: "2.1",
      cutGradeNumeric: 2.1,
      seats: 12,
      sourceName: "대학알리미",
      sourceUrl: "https://www.academyinfo.go.kr",
      updatedDate: new Date("2025-11-01T00:00:00.000Z"),
      rawPayload: {
        year: 2025,
        type: "수시"
      }
    }
  });

  await prisma.semesterFinalGrade.deleteMany({
    where: { studentProfileId: studentProfile.id }
  });

  await prisma.semesterFinalGrade.createMany({
    data: [
      {
        studentProfileId: studentProfile.id,
        academicYear: 2025,
        semesterTerm: "FIRST",
        semesterLabel: "2025년 1학기",
        subjectName: "국어",
        finalGrade: 2.3,
        credit: 4,
        applied: true
      },
      {
        studentProfileId: studentProfile.id,
        academicYear: 2025,
        semesterTerm: "FIRST",
        semesterLabel: "2025년 1학기",
        subjectName: "수학",
        finalGrade: 2.0,
        credit: 4,
        applied: true
      },
      {
        studentProfileId: studentProfile.id,
        academicYear: 2025,
        semesterTerm: "SECOND",
        semesterLabel: "2025년 2학기",
        subjectName: "국어",
        finalGrade: 2.1,
        credit: 4,
        applied: true
      },
      {
        studentProfileId: studentProfile.id,
        academicYear: 2025,
        semesterTerm: "SECOND",
        semesterLabel: "2025년 2학기",
        subjectName: "수학",
        finalGrade: 1.9,
        credit: 4,
        applied: true
      }
    ]
  });

  await prisma.gradeExamRecord.deleteMany({
    where: { studentProfileId: studentProfile.id }
  });

  await prisma.gradeExamRecord.createMany({
    data: [
      {
        studentProfileId: studentProfile.id,
        academicYear: 2025,
        semesterTerm: "FIRST",
        semesterLabel: "2025년 1학기",
        examType: "MIDTERM",
        subjectName: "국어",
        score: 88
      },
      {
        studentProfileId: studentProfile.id,
        academicYear: 2025,
        semesterTerm: "FIRST",
        semesterLabel: "2025년 1학기",
        examType: "FINAL",
        subjectName: "국어",
        score: 91
      }
    ]
  });

  await prisma.mockExamResult.deleteMany({
    where: { studentProfileId: studentProfile.id }
  });

  await prisma.mockExamResult.createMany({
    data: [
      {
        studentProfileId: studentProfile.id,
        academicYear: 2025,
        examMonth: 9,
        examLabel: "2025년 9월 모의",
        subjectName: "국어",
        score: 92,
        grade: 2
      },
      {
        studentProfileId: studentProfile.id,
        academicYear: 2025,
        examMonth: 9,
        examLabel: "2025년 9월 모의",
        subjectName: "수학",
        score: 89,
        grade: 2
      }
    ]
  });

  const { weekStart, weekEnd } = getCurrentWeekRange();
  const studyPlan = await prisma.studyPlan.upsert({
    where: {
      studentProfileId_weekStartDate: {
        studentProfileId: studentProfile.id,
        weekStartDate: weekStart
      }
    },
    update: {
      weekEndDate: weekEnd,
      source: "MANUAL",
      completionRate: 67
    },
    create: {
      studentProfileId: studentProfile.id,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      source: "MANUAL",
      completionRate: 67
    }
  });

  await prisma.studyTask.deleteMany({
    where: { studyPlanId: studyPlan.id }
  });

  await prisma.studyTask.createMany({
    data: [
      {
        studyPlanId: studyPlan.id,
        subject: "국어",
        task: "비문학 지문 3세트 풀이",
        dayLabel: "월",
        dayOrder: 1,
        priority: "HIGH",
        done: true,
        orderIndex: 0,
        completedAt: new Date()
      },
      {
        studyPlanId: studyPlan.id,
        subject: "수학",
        task: "확률과 통계 오답 정리",
        dayLabel: "수",
        dayOrder: 3,
        priority: "MEDIUM",
        done: true,
        orderIndex: 1,
        completedAt: new Date()
      },
      {
        studyPlanId: studyPlan.id,
        subject: "영어",
        task: "구문 독해 20문장",
        dayLabel: "금",
        dayOrder: 5,
        priority: "LOW",
        done: false,
        orderIndex: 2
      }
    ]
  });

  await prisma.notification.deleteMany({
    where: {
      userId: {
        in: [studentUser.id, teacherUser.id]
      }
    }
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: studentUser.id,
        type: "WARNING",
        category: "학습",
        title: "주간 계획 미완료 과제가 있습니다",
        body: "영어 구문 독해 과제가 아직 완료되지 않았습니다."
      },
      {
        userId: studentUser.id,
        type: "INFO",
        category: "진로",
        title: "목표 대학 정보가 업데이트되었습니다",
        body: "서울대학교 컴퓨터공학과 입시 정보가 최신화되었습니다."
      },
      {
        userId: teacherUser.id,
        type: "INFO",
        category: "진로",
        title: "학생 목표 설정 완료",
        body: "이학생 학생이 서울대학교 컴퓨터공학과를 목표로 설정했습니다."
      }
    ]
  });

  const counselingRequest = await prisma.counselingRequest.upsert({
    where: { id: "seed-counseling-request-1" },
    update: {
      studentProfileId: studentProfile.id,
      teacherProfileId: teacherProfile.id,
      type: "CAREER",
      message: "희망 전형과 비교과 준비 전략이 궁금합니다.",
      status: "PENDING"
    },
    create: {
      id: "seed-counseling-request-1",
      studentProfileId: studentProfile.id,
      teacherProfileId: teacherProfile.id,
      type: "CAREER",
      message: "희망 전형과 비교과 준비 전략이 궁금합니다.",
      status: "PENDING"
    }
  });

  await prisma.counselingMemo.upsert({
    where: { id: "seed-counseling-memo-1" },
    update: {
      counselingRequestId: counselingRequest.id,
      studentProfileId: studentProfile.id,
      teacherProfileId: teacherProfile.id,
      title: "3월 진로 상담 메모",
      content: "학생은 컴퓨터공학 희망이 명확하며 비교과 활동 보강이 필요함.",
      tag: "진로",
      visibility: "STUDENT_SHARED"
    },
    create: {
      id: "seed-counseling-memo-1",
      counselingRequestId: counselingRequest.id,
      studentProfileId: studentProfile.id,
      teacherProfileId: teacherProfile.id,
      title: "3월 진로 상담 메모",
      content: "학생은 컴퓨터공학 희망이 명확하며 비교과 활동 보강이 필요함.",
      tag: "진로",
      visibility: "STUDENT_SHARED",
      sharedAt: new Date()
    }
  });

  const ragSource = await prisma.ragSource.upsert({
    where: { checksum: "seed-rag-source-2025" },
    update: {
      sourceType: "PDF",
      name: "2025 입시 결과 요약집"
    },
    create: {
      checksum: "seed-rag-source-2025",
      sourceType: "PDF",
      name: "2025 입시 결과 요약집",
      sourceUrl: "https://example.com/admissions-2025.pdf",
      versionLabel: "2025"
    }
  });

  const ragDocument = await prisma.ragDocument.upsert({
    where: { id: "seed-rag-document-1" },
    update: {
      ragSourceId: ragSource.id,
      title: "서울대학교 컴퓨터공학과 2025 입시 요약",
      status: "READY",
      year: 2025,
      admissionType: "수시",
      region: "서울",
      citationLabel: "2025 입시 결과 요약집 p.12"
    },
    create: {
      id: "seed-rag-document-1",
      ragSourceId: ragSource.id,
      title: "서울대학교 컴퓨터공학과 2025 입시 요약",
      status: "READY",
      year: 2025,
      admissionType: "수시",
      region: "서울",
      citationLabel: "2025 입시 결과 요약집 p.12",
      rawText: "서울대학교 컴퓨터공학과 학생부종합 전형의 2025학년도 합격선은 2.1등급 수준이다."
    }
  });

  await prisma.ragChunk.upsert({
    where: {
      ragDocumentId_chunkIndex: {
        ragDocumentId: ragDocument.id,
        chunkIndex: 0
      }
    },
    update: {
      content: "서울대학교 컴퓨터공학과 학생부종합 전형의 2025학년도 합격선은 2.1등급 수준이며 모집인원은 12명이다.",
      citationLocator: "p.12",
      status: "READY",
      embeddingModel: "stub-embedding-model"
    },
    create: {
      ragDocumentId: ragDocument.id,
      chunkIndex: 0,
      content: "서울대학교 컴퓨터공학과 학생부종합 전형의 2025학년도 합격선은 2.1등급 수준이며 모집인원은 12명이다.",
      citationLocator: "p.12",
      status: "READY",
      embeddingModel: "stub-embedding-model"
    }
  });

  process.stdout.write(
    [
      `Seed complete.`,
      `Teacher: teacher.seed@jinro.local / ${teacherPassword}`,
      `Student: student.seed@jinro.local / ${studentPassword}`,
      `Invite code: ${inviteCode}`
    ].join("\n") + "\n"
  );
};

main()
  .catch(async (error: Error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
