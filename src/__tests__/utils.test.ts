// @ts-nocheck
import { MockHeaders } from "./mocks";
import {
  checkCodes,
  combineHeaders,
  determineRetryAction,
  ignoreRetryPath
} from "../utils";

window.Headers = MockHeaders;

describe("when using checkCodes", () => {
  it("should return true if the code is in a range", () => {
    let codes = ["200-299", 302, 800];
    let b = false;
    codes.some(c => {
      b = checkCodes(233, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should return true if the code is in the array", () => {
    let codes = ["200-299", 302, 800];
    let b = false;
    codes.some(c => {
      b = checkCodes(302, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should return true if the code is at the start of the range", () => {
    let codes = ["200-299"];
    let b = false;
    codes.some(c => {
      b = checkCodes(200, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should return true if the code is at the end of the range", () => {
    let codes = ["200-299"];
    let b = false;
    codes.some(c => {
      b = checkCodes(299, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should work with multiple ranges", () => {
    let codes = ["200-299", "302-399", 408];
    let b = false;
    codes.some(c => {
      b = checkCodes(333, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should work with overlapping ranges ranges", () => {
    let codes = ["200-299", "222-240", 408];
    let b = false;
    codes.some(c => {
      b = checkCodes(230, c);
      return b;
    });
    expect(b).toStrictEqual(true);
  });
  it("should return true if the correct number is a string", () => {
    let codes = ["200", 302, 600];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(200, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the code isn't in the array", () => {
    let codes = [302, 800];
    let b = false;
    codes.some(c => {
      b = checkCodes(392, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the code isn't in the range", () => {
    let codes = ["200-299"];
    let b = false;
    codes.some(c => {
      b = checkCodes(392, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range is malformed", () => {
    let codes = ["200-299-300-400"];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range isn't a number", () => {
    let codes = ["assljhdjkh"];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range isn't a number but stll has a dash", () => {
    let codes = ["assljhdjkh-hgsjhs"];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range includes comma delimited numbers (malformed)", () => {
    let codes = ["200-299,302"];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the string is blank", () => {
    let codes = [""];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("should return false if the range is blank", () => {
    let codes = [""];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("shouldn't match if stringified number doesn't match", () => {
    let codes = ["202"];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
  it("shouldn't return false if comparing against something other than a string or number", () => {
    let codes = [{ foo: "bar" }];
    let b = false;
    codes.forEach(c => {
      b = checkCodes(201, c);
      return b;
    });
    expect(b).toStrictEqual(false);
  });
});

describe("when using combineHeaders", () => {
  it("should work with no headers added", () => {
    expect(combineHeaders()).toStrictEqual(new MockHeaders());
  });
  it("should work with only local headers", () => {
    const m = new MockHeaders();
    m.append("foo", "bar");
    expect(combineHeaders(m)).toStrictEqual(m);
  });
  it("should work with only global headers", () => {
    const m = new MockHeaders();
    m.append("foo", "bar");
    expect(combineHeaders(undefined, m)).toStrictEqual(m);
  });
  it("should combine local with global headers", () => {
    const a = new MockHeaders();
    a.append("foo", "bar");
    const b = new MockHeaders();
    b.append("bar", "foo");
    const c = new MockHeaders();
    c.append("bar", "foo");
    c.append("foo", "bar");
    expect(combineHeaders(a, b)).toStrictEqual(c);
  });
  it("should override global with local headers", () => {
    const a = new MockHeaders();
    a.append("foo", "bar");
    const b = new MockHeaders();
    b.append("foo", "meh");
    expect(combineHeaders(a, b)).toStrictEqual(a);
  });
});

describe("when using determineRetryActions", () => {
  it("should return undefined when arrays are empty", () => {
    const ra = determineRetryAction(500, { path: "_", retryActions: [] }, []);
    expect(ra[0]).toBeUndefined();
    expect(ra[1]).toStrictEqual(-1);
  });
  it("should return undefined when no arrays are provided", () => {
    const ra = determineRetryAction(500, { path: "_" });
    expect(ra[0]).toBeUndefined();
    expect(ra[1]).toStrictEqual(-1);
  });
  it("should return undefined when no action matches", () => {
    const r1: Array<RetryAction> = [
      {
        code: 401,
        action: (a, b, c, d) => {
          return;
        }
      }
    ];
    const r2: Array<RetryAction> = [
      {
        code: 420,
        action: (a, b, c, d) => {
          return;
        }
      }
    ];
    const ra = determineRetryAction(500, { path: "_", retryActions: r1 }, r2);
    expect(ra[0]).toBeUndefined();
    expect(ra[1]).toStrictEqual(-1);
  });
  it("should match from global retryActions", () => {
    const r = {
      code: 401,
      action: (a, b, c, d) => {
        return;
      }
    };
    const r1: Array<RetryAction> = [{ code: 500, action: null }, r];
    const ra = determineRetryAction(401, { path: "_", retryActions: [] }, r1);
    expect(ra[0]).toStrictEqual(r);
    expect(ra[1]).toStrictEqual(1);
  });
  it("should match from local retryActions", () => {
    const r = {
      code: 401,
      action: (a, b, c, d) => {
        return;
      }
    };
    const r1: Array<RetryAction> = [{ code: 500, action: null }, r];
    const r2: Array<RetryAction> = [{ code: 300, action: null }];
    const ra = determineRetryAction(401, { path: "_", retryActions: r1 }, r2);
    expect(ra[0]).toStrictEqual(r);
    expect(ra[1]).toStrictEqual(-1);
    // should remove retry action from local actions
    // this happens elsewhere for global actions since it needs to put them back later
    expect(r1.length).toStrictEqual(1);
    expect(r1[0].code).toStrictEqual(500);
  });
  it("should override global retryActions with local retryActions", done => {
    const a1 = {
      code: 401,
      action: (a, b, c, d) => {
        done();
      }
    };
    const a2 = {
      code: 401,
      action: (a, b, c, d) => {
        expect(true).toStrictEqual(false);
      }
    };
    const r1: Array<RetryAction> = [{ code: 500, action: null }, a1];
    const r2: Array<RetryAction> = [{ code: 300, action: null }, a2];
    const ra = determineRetryAction(401, { path: "_", retryActions: r1 }, r2);
    expect(ra[0]).toStrictEqual(a1);
    expect(ra[1]).toStrictEqual(-1);
    expect(r1.length).toStrictEqual(1);
    expect(r1[0].code).toStrictEqual(500);
    ra[0].action();
  });
  it("should skip local action if the path is ignored", done => {
    const a1 = {
      pathsToIgnore: ["_"],
      code: 401,
      action: (a, b, c, d) => {
        expect(true).toStrictEqual(false);
      }
    };
    const a2 = {
      code: 401,
      action: (a, b, c, d) => {
        done();
      }
    };
    const r1: Array<RetryAction> = [{ code: 500, action: null }, a1];
    const r2: Array<RetryAction> = [{ code: 300, action: null }, a2];
    const ra = determineRetryAction(401, { path: "_", retryActions: r1 }, r2);
    expect(ra[0]).toStrictEqual(a2);
    expect(ra[1]).toStrictEqual(1);
    expect(r1.length).toStrictEqual(2);
    expect(r2.length).toStrictEqual(2);
    ra[0].action();
  });
  it("should skip global retryActions if ignore path matches", () => {
    const r = {
      pathsToIgnore: ["_"],
      code: 401,
      action: (a, b, c, d) => {
        return;
      }
    };
    const r1: Array<RetryAction> = [{ code: 500, action: null }, r];
    const ra = determineRetryAction(401, { path: "_", retryActions: [] }, r1);
    expect(ra[0]).toBeUndefined();
    expect(ra[1]).toStrictEqual(-1);
  });
});

describe("when using ignoreRetryPath", () => {
  it("should return false if the retryAction has an undefined pathsToIgnore", () => {
    expect(
      ignoreRetryPath("path", { code: 100, action: (r, s, f) => {} })
    ).toBeFalsy();
  });
  it("should return false if the retryAction is an empty array", () => {
    expect(
      ignoreRetryPath("path", {
        code: 100,
        action: (r, s, f) => {},
        pathsToIgnore: []
      })
    ).toBeFalsy();
  });
  it("should return false if the retryAction doesn't have a match", () => {
    expect(
      ignoreRetryPath("path", {
        code: 100,
        action: (r, s, f) => {},
        pathsToIgnore: ["notPath"]
      })
    ).toBeFalsy();
  });
  it("should return true if the retryAction has a match", () => {
    expect(
      ignoreRetryPath("path", {
        code: 100,
        action: (r, s, f) => {},
        pathsToIgnore: ["notPath", "path"]
      })
    ).toBeTruthy();
  });
  it("should return true if path is matching to an empty string", () => {
    expect(
      ignoreRetryPath("", {
        code: 100,
        action: (r, s, f) => {},
        pathsToIgnore: ["notPath", ""]
      })
    ).toBeTruthy();
  });
});
