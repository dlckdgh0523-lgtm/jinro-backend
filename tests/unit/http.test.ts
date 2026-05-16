import { describe, expect, it } from "vitest";
import { ApiError, makePagination } from "../../src/common/http";

describe("ApiError", () => {
  it("has correct statusCode and code", () => {
    const error = new ApiError(404, "NOT_FOUND", "Resource not found.");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Resource not found.");
  });

  it("includes optional details", () => {
    const details = [{ path: "email", message: "required" }];
    const error = new ApiError(400, "VALIDATION_ERROR", "Validation failed.", details);
    expect(error.details).toEqual(details);
  });

  it("includes optional originalError", () => {
    const orig = new Error("DB connection failed");
    const error = new ApiError(500, "INTERNAL_ERROR", "Something went wrong.", undefined, orig);
    expect(error.originalError).toBe(orig);
  });

  it("is instanceof Error", () => {
    const error = new ApiError(409, "CONFLICT", "Already exists.");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("makePagination", () => {
  it("calculates basic pagination", () => {
    const result = makePagination(1, 20, 100);
    expect(result).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 100,
      totalPages: 5,
      hasNext: true,
      hasPrev: false
    });
  });

  it("last page has no next", () => {
    const result = makePagination(5, 20, 100);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });

  it("handles single page", () => {
    const result = makePagination(1, 20, 5);
    expect(result.totalPages).toBe(1);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(false);
  });

  it("handles zero items", () => {
    const result = makePagination(1, 20, 0);
    expect(result.totalPages).toBe(1);
    expect(result.totalItems).toBe(0);
  });

  it("calculates middle page correctly", () => {
    const result = makePagination(3, 10, 50);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(true);
    expect(result.totalPages).toBe(5);
  });

  it("handles partial last page", () => {
    const result = makePagination(1, 20, 25);
    expect(result.totalPages).toBe(2);
    expect(result.hasNext).toBe(true);
  });
});
