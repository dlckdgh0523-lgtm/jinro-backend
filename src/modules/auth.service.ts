import type { AppRole } from "../infra/security";
import {
  hashOpaqueToken,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  signStreamToken,
  verifyPassword,
  verifyRefreshToken
} from "../infra/security";
import { ApiError } from "../common/http";
import { makeInviteCode, normalizeClassNumber } from "../common/domain";
import { authRepository } from "./auth.repository";
import type {
  InviteValidationInput,
  LoginInput,
  GoogleCallbackInput,
  StudentSignupInput,
  TeacherSignupInput
} from "./auth.validator";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";

type SessionPayload = {
  name: string;
  schoolName: string;
  grade?: string;
  track?: string;
  inviteCode?: string;
  onboardingCompleted?: boolean;
};

const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const createSessionTokens = async (userId: string, role: AppRole) => {
  const refreshToken = signRefreshToken(userId, role);
  const accessToken = signAccessToken(userId, role);
  const streamToken = signStreamToken(userId, role);

  await authRepository.createRefreshToken({
    userId,
    familyId: crypto.randomUUID(),
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
  });

  return { accessToken, refreshToken, streamToken };
};

const loadSessionPayload = async (
  userId: string
): Promise<{ role: AppRole; email: string; profile: SessionPayload }> => {
  const user = await authRepository.findSessionUserById(userId);

  if (!user) {
    throw new ApiError(404, "NOT_FOUND", "User not found.");
  }

  if (user.role === "STUDENT" && user.studentProfile) {
    return {
      role: user.role,
      email: user.email,
      profile: {
        name: user.studentProfile.displayName,
        schoolName: user.studentProfile.schoolName,
        grade: user.studentProfile.gradeLevel > 0 ? `${user.studentProfile.gradeLevel}학년` : undefined,
        track:
          user.studentProfile.track === "STEM"
            ? "이공계열"
            : user.studentProfile.track === "HUMANITIES"
              ? "인문계열"
              : user.studentProfile.track === "ARTS"
                ? "예체능계열"
                : "미정",
        onboardingCompleted: user.studentProfile.onboardingCompleted
      }
    };
  }

  if (user.role === "TEACHER" && user.teacherProfile) {
    return {
      role: user.role,
      email: user.email,
      profile: {
        name: user.teacherProfile.displayName,
        schoolName: user.teacherProfile.schoolName,
        inviteCode: user.teacherProfile.homeroomClassRooms[0]?.inviteCode
      }
    };
  }

  throw new ApiError(404, "NOT_FOUND", "Profile not found.");
};

const buildNextPath = (role: AppRole, onboardingCompleted?: boolean) => {
  if (role === "TEACHER") return "/teacher/dashboard";
  return onboardingCompleted ? "/student/dashboard" : "/onboarding/1";
};

export const buildSessionResponse = async (userId: string) => {
  const payload = await loadSessionPayload(userId);
  const tokens = await createSessionTokens(userId, payload.role);

  return {
    ...tokens,
    nextPath: buildNextPath(payload.role, payload.profile.onboardingCompleted),
    user: {
      id: userId,
      role: payload.role.toLowerCase(),
      email: payload.email,
      ...payload.profile
    }
  };
};

const ensureEmailAvailable = async (email: string) => {
  const existing = await authRepository.findEmailCollision(email);
  if (existing) {
    throw new ApiError(409, "CONFLICT", "Email is already registered.");
  }
};

export const authService = {
  async login(input: LoginInput, role: AppRole) {
    const user = await authRepository.findUserByEmail(input.email);

    if (!user || user.role !== role || !user.passwordHash) {
      throw new ApiError(401, "AUTHENTICATION_ERROR", "Invalid credentials.");
    }

    const passwordOk = await verifyPassword(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new ApiError(401, "AUTHENTICATION_ERROR", "Invalid credentials.");
    }

    if (user.status !== "ACTIVE") {
      throw new ApiError(403, "FORBIDDEN", "Inactive account.");
    }

    await authRepository.updateLastLoginAt(user.id);
    return buildSessionResponse(user.id);
  },

  async signupStudent(input: StudentSignupInput) {
    await ensureEmailAvailable(input.email);

    const inviteCode = input.inviteCode?.trim() || undefined;
    const classroom = inviteCode
      ? await authRepository.findClassroomByInviteCode(inviteCode)
      : null;
    const passwordHash = await hashPassword(input.password);
    const createdUser = await authRepository.createStudentUser({
      email: input.email,
      passwordHash,
      name: input.name,
      classroom
    });

    return buildSessionResponse(createdUser.id);
  },

  async signupTeacher(input: TeacherSignupInput) {
    await ensureEmailAvailable(input.email);

    const passwordHash = await hashPassword(input.password);
    const academicYear = new Date().getFullYear();
    const gradeLevel = normalizeClassNumber(input.grade);
    const classNumber = normalizeClassNumber(input.classNum);

    const existing = await authRepository.findOwnedClassroom({
      schoolName: input.schoolName,
      academicYear,
      gradeLevel,
      classNumber
    });

    if (existing) {
      throw new ApiError(409, "CONFLICT", "Selected classroom already has an owner.");
    }

    const createdUser = await authRepository.createTeacherUser({
      email: input.email,
      passwordHash,
      name: input.name,
      schoolName: input.schoolName,
      academicYear,
      gradeLevel,
      classNumber,
      subject: input.subject,
      inviteCode: makeInviteCode(academicYear, gradeLevel, classNumber)
    });

    return buildSessionResponse(createdUser.id);
  },

  async refresh(refreshToken: string) {
    const claims = verifyRefreshToken(refreshToken);
    const tokenHash = hashOpaqueToken(refreshToken);
    const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!storedToken || storedToken.userId !== claims.sub || storedToken.status !== "ACTIVE") {
      throw new ApiError(401, "AUTHENTICATION_ERROR", "Refresh token is invalid.");
    }

    const nextRefreshToken = signRefreshToken(storedToken.userId, storedToken.user.role as AppRole);
    const nextAccessToken = signAccessToken(storedToken.userId, storedToken.user.role as AppRole);
    const nextStreamToken = signStreamToken(storedToken.userId, storedToken.user.role as AppRole);

    await authRepository.rotateRefreshTokens({
      currentTokenId: storedToken.id,
      userId: storedToken.userId,
      familyId: storedToken.familyId,
      nextTokenHash: hashOpaqueToken(nextRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    });

    const payload = await loadSessionPayload(storedToken.userId);

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      streamToken: nextStreamToken,
      nextPath: buildNextPath(payload.role, payload.profile.onboardingCompleted),
      user: {
        id: storedToken.userId,
        role: payload.role.toLowerCase(),
        email: payload.email,
        ...payload.profile
      }
    };
  },

  async logout(refreshToken: string) {
    await authRepository.revokeRefreshTokenByHash(hashOpaqueToken(refreshToken));
    return { loggedOut: true };
  },

  async validateInvite(input: InviteValidationInput) {
    const classroom = await authRepository.findClassroomInviteDetails(input.inviteCode);

    if (!classroom) {
      throw new ApiError(404, "NOT_FOUND", "Invite code not found.");
    }

    return {
      valid: true,
      inviteCode: classroom.inviteCode,
      schoolName: classroom.schoolName,
      grade: `${classroom.gradeLevel}학년`,
      className: `${classroom.classNumber}반`,
      teacherName: classroom.homeroomTeacher.displayName,
      classRoomId: classroom.id
    };
  },

  async handleGoogleCallback(
    input: GoogleCallbackInput & {
      redirectUri?: string;
    }
  ) {
    const redirectUri = input.redirectUri?.trim() || env.GOOGLE_CALLBACK_URL.trim();

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !redirectUri) {
      throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Google OAuth not configured.");
    }

    const oauth2Client = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri
    });

    let tokens;
    try {
      ({ tokens } = await oauth2Client.getToken({
        code: input.code,
        redirect_uri: redirectUri
      }));
    } catch (error) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Google OAuth token exchange failed.",
        undefined,
        error
      );
    }

    if (!tokens.id_token) {
      throw new ApiError(401, "AUTHENTICATION_ERROR", "Failed to get ID token from Google.");
    }

    let payload;
    try {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Google ID token verification failed.",
        undefined,
        error
      );
    }

    if (!payload || !payload.email) {
      throw new ApiError(401, "AUTHENTICATION_ERROR", "Invalid ID token payload.");
    }

    let user: Awaited<ReturnType<typeof authRepository.findGoogleUser>> | null = null;
    try {
      user = await authRepository.findGoogleUser(payload.email);

      if (!user) {
        const name = payload.name || payload.email.split("@")[0] || "User";

        if (payload.hd && (payload.hd.endsWith(".hs.kr") || payload.hd.endsWith(".school.kr"))) {
          user = await authRepository.createGoogleTeacherUser({
            email: payload.email,
            name,
            schoolName: "미정"
          });
        } else {
          user = await authRepository.createGoogleStudentUser({
            email: payload.email,
            name
          });
        }
      }
      if (!user) {
        throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Google user provisioning failed.");
      }
      if (user.status !== "ACTIVE") {
        throw new ApiError(403, "FORBIDDEN", "Inactive account.");
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Google user provisioning failed.",
        undefined,
        error
      );
    }

    if (!user) {
      throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Google user provisioning failed.");
    }

    try {
      await authRepository.updateLastLoginAt(user.id);
      return buildSessionResponse(user.id);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Google session creation failed.",
        undefined,
        error
      );
    }
  }
};
