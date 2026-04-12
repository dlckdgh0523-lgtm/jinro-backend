import { prisma } from "../infra/prisma";

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    });
  },

  findSessionUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        teacherProfile: {
          include: {
            homeroomClassRooms: {
              where: { deletedAt: null },
              orderBy: { updatedAt: "desc" },
              take: 1
            }
          }
        }
      }
    });
  },

  findEmailCollision(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
  },

  updateLastLoginAt(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
  },

  findClassroomByInviteCode(inviteCode: string) {
    return prisma.classRoom.findUnique({
      where: { inviteCode }
    });
  },

  findClassroomInviteDetails(inviteCode: string) {
    return prisma.classRoom.findUnique({
      where: { inviteCode },
      include: {
        homeroomTeacher: true
      }
    });
  },

  findOwnedClassroom(input: {
    schoolName: string;
    academicYear: number;
    gradeLevel: number;
    classNumber: number;
  }) {
    return prisma.classRoom.findFirst({
      where: {
        schoolName: input.schoolName,
        academicYear: input.academicYear,
        gradeLevel: input.gradeLevel,
        classNumber: input.classNumber,
        deletedAt: null
      },
      select: { id: true }
    });
  },

  createStudentUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    classroom:
      | {
          id: string;
          schoolName: string;
          gradeLevel: number;
          classNumber: number;
          homeroomTeacherId: string;
        }
      | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          role: "STUDENT",
          status: "ACTIVE",
          passwordHash: input.passwordHash,
          studentProfile: {
            create: {
              displayName: input.name,
              schoolName: input.classroom?.schoolName ?? "미정",
              gradeLevel: input.classroom?.gradeLevel ?? 0,
              classLabel: input.classroom ? `${input.classroom.classNumber}반` : null,
              track: "UNDECIDED",
              onboardingCompleted: false,
              classroomId: input.classroom?.id
            }
          }
        },
        include: {
          studentProfile: true
        }
      });

      if (input.classroom && user.studentProfile) {
        await tx.teacherStudentAssignment.create({
          data: {
            teacherProfileId: input.classroom.homeroomTeacherId,
            studentProfileId: user.studentProfile.id,
            classroomId: input.classroom.id,
            assignmentType: "HOMEROOM",
            active: true
          }
        });
      }

      return user;
    });
  },

  createTeacherUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    schoolName: string;
    academicYear: number;
    gradeLevel: number;
    classNumber: number;
    subject: string;
    inviteCode: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          role: "TEACHER",
          status: "ACTIVE",
          passwordHash: input.passwordHash,
          teacherProfile: {
            create: {
              displayName: input.name,
              schoolName: input.schoolName,
              subjectAreas: input.subject ? [input.subject] : []
            }
          }
        },
        include: {
          teacherProfile: true
        }
      });

      await tx.classRoom.create({
        data: {
          schoolName: input.schoolName,
          academicYear: input.academicYear,
          gradeLevel: input.gradeLevel,
          classNumber: input.classNumber,
          inviteCode: input.inviteCode,
          name: `${input.gradeLevel}학년 ${input.classNumber}반`,
          homeroomTeacherId: user.teacherProfile!.id
        }
      });

      return user;
    });
  },

  createRefreshToken(input: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({
      data: {
        userId: input.userId,
        familyId: input.familyId,
        tokenHash: input.tokenHash,
        status: "ACTIVE",
        expiresAt: input.expiresAt
      }
    });
  },

  findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });
  },

  rotateRefreshTokens(input: {
    currentTokenId: string;
    userId: string;
    familyId: string;
    nextTokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: input.currentTokenId },
        data: {
          status: "ROTATED",
          lastUsedAt: new Date()
        }
      }),
      prisma.refreshToken.create({
        data: {
          userId: input.userId,
          familyId: input.familyId,
          tokenHash: input.nextTokenHash,
          status: "ACTIVE",
          expiresAt: input.expiresAt
        }
      })
    ]);
  },

  revokeRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: {
        status: "REVOKED",
        revokedAt: new Date()
      }
    });
  },

  findGoogleUser(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        studentProfile: true,
        teacherProfile: {
          include: {
            homeroomClassRooms: {
              where: { deletedAt: null },
              orderBy: { updatedAt: "desc" },
              take: 1
            }
          }
        }
      }
    });
  },

  createGoogleStudentUser(input: { email: string; name: string }) {
    return prisma.user.create({
      data: {
        email: input.email,
        role: "STUDENT",
        status: "ACTIVE",
        authProvider: "GOOGLE",
        studentProfile: {
          create: {
            displayName: input.name,
            schoolName: "미정",
            gradeLevel: 0,
            track: "UNDECIDED",
            onboardingCompleted: false
          }
        }
      },
      include: {
        studentProfile: true,
        teacherProfile: {
          include: {
            homeroomClassRooms: {
              where: { deletedAt: null },
              orderBy: { updatedAt: "desc" },
              take: 1
            }
          }
        }
      }
    });
  },

  createGoogleTeacherUser(input: { email: string; name: string; schoolName: string }) {
    return prisma.user.create({
      data: {
        email: input.email,
        role: "TEACHER",
        status: "ACTIVE",
        authProvider: "GOOGLE",
        teacherProfile: {
          create: {
            displayName: input.name,
            schoolName: input.schoolName
          }
        }
      },
      include: {
        studentProfile: true,
        teacherProfile: {
          include: {
            homeroomClassRooms: {
              where: { deletedAt: null },
              orderBy: { updatedAt: "desc" },
              take: 1
            }
          }
        }
      }
    });
  }
};
