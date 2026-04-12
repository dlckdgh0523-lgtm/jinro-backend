import "dotenv/config";

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
};

const baseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:4000";
const inviteCode = "JN-2026-2A-SEED";
const seedStudent = {
  email: "student.seed@jinro.local",
  password: "Student123!"
};
const seedTeacher = {
  email: "teacher.seed@jinro.local",
  password: "Teacher123!"
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(json.error ?? json)}`);
  }

  return json;
};

const authHeaders = (token: string) => ({
  authorization: `Bearer ${token}`
});

const run = async () => {
  await requestJson<{ status: string; timestamp: string }>("/health");

  await requestJson<{ valid: boolean; inviteCode: string }>("/v1/auth/invite/validate", {
    method: "POST",
    body: JSON.stringify({ inviteCode })
  });

  const studentSignupEmail = `smoke-student-${Date.now()}@jinro.local`;
  await requestJson("/v1/auth/student/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "스모크 학생",
      email: studentSignupEmail,
      password: "Student123!",
      passwordConfirm: "Student123!",
      inviteCode
    })
  });

  const teacherSignupEmail = `smoke-teacher-${Date.now()}@jinro.local`;
  const teacherClassNum = Date.now() % 1000000;
  await requestJson("/v1/auth/teacher/signup", {
    method: "POST",
    body: JSON.stringify({
      schoolName: "진로나침반고",
      name: "스모크 교사",
      email: teacherSignupEmail,
      password: "Teacher123!",
      passwordConfirm: "Teacher123!",
      grade: 2,
      classNum: teacherClassNum,
      subject: "국어"
    })
  });

  const studentLogin = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>("/v1/auth/student/login", {
    method: "POST",
    body: JSON.stringify(seedStudent)
  });

  const studentAccessToken = studentLogin.data.accessToken;

  await requestJson("/v1/me", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/student/dashboard", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/notifications?page=1&pageSize=5&tab=all", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/sse/token", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/goals/options", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/goals/current", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/goals/current", {
    method: "PUT",
    headers: authHeaders(studentAccessToken),
    body: JSON.stringify({
      university: "스모크대학교",
      department: "컴퓨터공학과",
      field: "공학",
      targetGrade: 2.4,
      targetScore: 320
    })
  });

  await requestJson("/v1/grades/exams", {
    method: "POST",
    headers: authHeaders(studentAccessToken),
    body: JSON.stringify({
      semester: "2026 1학기",
      examType: "중간고사",
      subjects: [
        {
          name: "국어",
          score: 91
        },
        {
          name: "영어",
          score: 87
        }
      ]
    })
  });
  await requestJson("/v1/semester-finals", {
    method: "POST",
    headers: authHeaders(studentAccessToken),
    body: JSON.stringify({
      semester: "2026 1학기",
      subjects: [
        {
          name: "국어",
          finalGrade: 2,
          credit: 4,
          applied: true
        },
        {
          name: "영어",
          finalGrade: 3,
          credit: 4,
          applied: true
        }
      ]
    })
  });
  await requestJson("/v1/mock-exams", {
    method: "POST",
    headers: authHeaders(studentAccessToken),
    body: JSON.stringify({
      semester: "2026 9월",
      subjects: [
        {
          name: "국어",
          score: 92,
          grade: 2
        },
        {
          name: "영어",
          score: 88,
          grade: 3
        }
      ]
    })
  });
  await requestJson("/v1/grades/chart?mode=final", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/grades/chart?mode=exam", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/grades/chart?mode=practice", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/growth-report?mode=final", {
    headers: authHeaders(studentAccessToken)
  });
  await requestJson("/v1/study-plans/current", {
    headers: authHeaders(studentAccessToken)
  });
  const studentRequest = await requestJson<{ id: string }>("/v1/counseling/requests", {
    method: "POST",
    headers: authHeaders(studentAccessToken),
    body: JSON.stringify({
      type: "진로 고민",
      message: "스모크 상담 요청"
    })
  });
  await requestJson("/v1/counseling/requests", {
    headers: authHeaders(studentAccessToken)
  });

  const refreshed = await requestJson<{
    accessToken: string;
    refreshToken: string;
  }>("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: studentLogin.data.refreshToken })
  });

  await requestJson("/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken: refreshed.data.refreshToken })
  });

  const teacherLogin = await requestJson<{
    accessToken: string;
  }>("/v1/auth/teacher/login", {
    method: "POST",
    body: JSON.stringify(seedTeacher)
  });

  const teacherAccessToken = teacherLogin.data.accessToken;

  await requestJson("/v1/me", {
    headers: authHeaders(teacherAccessToken)
  });
  await requestJson("/v1/teacher/dashboard", {
    headers: authHeaders(teacherAccessToken)
  });
  await requestJson("/v1/teachers/me", {
    headers: authHeaders(teacherAccessToken)
  });
  await requestJson("/v1/classrooms/me", {
    headers: authHeaders(teacherAccessToken)
  });
  const students = await requestJson<Array<{ id: string }>>("/v1/students", {
    headers: authHeaders(teacherAccessToken)
  });
  const studentId = students.data[0]?.id;
  if (!studentId) {
    throw new Error("Teacher student list returned no students.");
  }

  await requestJson(`/v1/students/${studentId}`, {
    headers: authHeaders(teacherAccessToken)
  });
  await requestJson("/v1/completion-status", {
    headers: authHeaders(teacherAccessToken)
  });
  await requestJson("/v1/notifications?page=1&pageSize=5&tab=all", {
    headers: authHeaders(teacherAccessToken)
  });
  await requestJson("/v1/counseling/requests", {
    headers: authHeaders(teacherAccessToken)
  });
  await requestJson(`/v1/counseling/requests/${studentRequest.data.id}/status`, {
    method: "PATCH",
    headers: authHeaders(teacherAccessToken),
    body: JSON.stringify({ status: "in_progress" })
  });
  await requestJson("/v1/counseling/memos", {
    headers: authHeaders(teacherAccessToken)
  });
  await requestJson("/v1/counseling/memos", {
    method: "POST",
    headers: authHeaders(teacherAccessToken),
    body: JSON.stringify({
      studentId,
      requestId: studentRequest.data.id,
      subject: "스모크 상담 메모",
      content: "후속 상담 필요",
      tag: "follow-up",
      shareWithStudent: true
    })
  });
  await requestJson("/v1/admissions?page=1&pageSize=5", {
    headers: authHeaders(teacherAccessToken)
  });
};

run()
  .then(() => {
    process.stdout.write("Smoke checks passed.\n");
  })
  .catch((error: Error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
