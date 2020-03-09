import { checkCodes } from "../utils";

describe("when using checkCodes", () => {
  it("should return true if the code is in a range", () => {
    var codes = ["200-299", 302, 800];
    var b = false;
    codes.some(c => {
      b = checkCodes(233, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should return true if the code is in the array", () => {
    var codes = ["200-299", 302, 800];
    var b = false;
    codes.some(c => {
      b = checkCodes(302, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should return true if the code is at the start of the range", () => {
    var codes = ["200-299"];
    var b = false;
    codes.some(c => {
      b = checkCodes(200, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should return true if the code is at the end of the range", () => {
    var codes = ["200-299"];
    var b = false;
    codes.some(c => {
      b = checkCodes(299, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should work with multiple ranges", () => {
    var codes = ["200-299", "302-399", 408];
    var b = false;
    codes.some(c => {
      b = checkCodes(333, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should work with overlapping ranges ranges", () => {
    var codes = ["200-299", "222-240", 408];
    var b = false;
    codes.some(c => {
      b = checkCodes(230, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should return true if the correct number is a string", () => {
    var codes = ["200", 302, 600];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(200, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the code isn't in the array", () => {
    var codes = [302, 800];
    var b = false;
    codes.some(c => {
      b = checkCodes(392, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the code isn't in the range", () => {
    var codes = ["200-299"];
    var b = false;
    codes.some(c => {
      b = checkCodes(392, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range is malformed", () => {
    var codes = ["200-299-300-400"];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range isn't a number", () => {
    var codes = ["assljhdjkh"];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range isn't a number but stll has a dash", () => {
    var codes = ["assljhdjkh-hgsjhs"];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range includes comma delimited numbers (malformed)", () => {
    var codes = ["200-299,302"];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the string is blank", () => {
    var codes = [""];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range is blank", () => {
    var codes = [""];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("shouldn't match if stringified number doesn't match", () => {
    var codes = ["202"];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("shouldn't return false if comparing against something other than a string or number", () => {
    var codes = [{ foo: "bar" }];
    var b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
});
