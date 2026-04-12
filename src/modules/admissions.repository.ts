import type { Prisma } from "@prisma/client";
import { prisma } from "../infra/prisma";

export const admissionRepository = {
  listAdmissions(input: {
    where: Prisma.AdmissionRecordWhereInput;
    skip: number;
    take: number;
  }) {
    return prisma.admissionRecord.findMany({
      where: input.where,
      include: {
        university: true,
        department: true
      },
      orderBy: { updatedDate: "desc" },
      skip: input.skip,
      take: input.take
    });
  },

  countAdmissions(where: Prisma.AdmissionRecordWhereInput) {
    return prisma.admissionRecord.count({ where });
  }
};
