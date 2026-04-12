import type { Prisma } from "@prisma/client";
import { makePagination } from "../common/http";
import { admissionRepository } from "./admissions.repository";
import type { AdmissionsQueryInput } from "./admissions.validator";

const categoryMap = {
  "학생부교과": "STUDENT_RECORD_CURRICULUM",
  "학생부종합": "STUDENT_RECORD_COMPREHENSIVE",
  "논술": "ESSAY",
  "수능위주": "CSAT",
  "실기/실적": "PERFORMANCE"
} as const;

const typeMap = {
  "수시": "EARLY",
  "정시": "REGULAR"
} as const;

const serializeAdmission = (item: {
  id: string;
  year: number;
  admissionType: string;
  category: string;
  cutGradeText: string | null;
  seats: number | null;
  sourceName: string;
  updatedDate: Date;
  university: { name: string };
  department: { name: string } | null;
}) => ({
  id: item.id,
  university: item.university.name,
  department: item.department?.name ?? "미분류",
  year: item.year,
  type: item.admissionType === "EARLY" ? "수시" : "정시",
  category:
    item.category === "STUDENT_RECORD_CURRICULUM"
      ? "학생부교과"
      : item.category === "STUDENT_RECORD_COMPREHENSIVE"
        ? "학생부종합"
        : item.category === "ESSAY"
          ? "논술"
          : item.category === "CSAT"
            ? "수능위주"
            : "실기/실적",
  cutGrade: item.cutGradeText,
  seats: item.seats,
  source: item.sourceName,
  updated: item.updatedDate.toISOString().slice(0, 10)
});

const buildWhere = (query: AdmissionsQueryInput): Prisma.AdmissionRecordWhereInput => {
  const baseWhere: Prisma.AdmissionRecordWhereInput = {
    year: query.year ?? undefined,
    admissionType: query.type ? typeMap[query.type] : undefined,
    category: query.category ? categoryMap[query.category] : undefined,
    university: {
      is: {
        region: query.region || undefined,
        name: query.search ? { contains: query.search, mode: "insensitive" } : undefined
      }
    }
  };

  if (!query.search) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    OR: [
      {
        university: {
          is: {
            name: { contains: query.search, mode: "insensitive" }
          }
        }
      },
      {
        department: {
          is: {
            name: { contains: query.search, mode: "insensitive" }
          }
        }
      }
    ]
  };
};

export const admissionService = {
  async list(query: AdmissionsQueryInput) {
    const skip = (query.page - 1) * query.pageSize;
    const where = buildWhere(query);
    const [items, totalItems] = await Promise.all([
      admissionRepository.listAdmissions({
        where,
        skip,
        take: query.pageSize
      }),
      admissionRepository.countAdmissions(where)
    ]);

    return {
      data: items.map(serializeAdmission),
      meta: {
        pagination: makePagination(query.page, query.pageSize, totalItems)
      }
    };
  }
};
