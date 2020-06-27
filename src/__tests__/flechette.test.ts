import { configureFlechette, FlechetteController } from "../index";
import { getFlechetteInstance } from "../flechette";
import {
  deleteStorage,
  removeFromStorage,
  retrieveFromStorage
} from "storage-deck";

describe("when using configureFlechette", () => {
  it("should allow default configuration with an empty object", () => {
    configureFlechette();
    expect((window as any)["appConfig"]).not.toBeNull();
    const f: FlechetteController = retrieveFromStorage("flechette", "appConfig");
    expect(getFlechetteInstance()).toStrictEqual(f);
    expect(f).not.toBeNull();
    expect(f.successCodes).toStrictEqual(["200-399"]);
    expect(f.retryActions!.length).toStrictEqual(3);
    expect(f.timeout).toStrictEqual(30000);
    expect(f.maxTimeoutRetryCount).toStrictEqual(2);
    expect(f.baseUrl).toStrictEqual("");
    expect(f.headers).toBeUndefined;
    expect(f.instanceName).toStrictEqual("flechette");
  });
  it("should create a custom instance", () => {
    const h = {
      append: (name: string, value: string): void => {},
      delete: (name: string): void => {},
      get: (name: string): null => {
        return null;
      },
      has: (name: string): boolean => {
        return false;
      },
      set: (name: string, value: string): void => {},
      forEach: (): any => {
        return;
      },
      entries: (): any => {
        return;
      },
      keys: (): any => {
        return;
      },
      values: (): any => {
        return;
      },
      [Symbol.iterator]: (): any => {
        return;
      }
    };
    configureFlechette({
      successCodes: ["100-199", 300],
      retryActions: [],
      timeout: 10,
      maxTimeoutRetryCount: 1,
      baseUrl: "foo",
      headers: h,
      instanceName: "custom"
    });
    var f: FlechetteController = retrieveFromStorage("custom", "appConfig");
    expect(getFlechetteInstance("custom")).toStrictEqual(f);
    expect(f).not.toBeNull();
    expect(f.successCodes).toStrictEqual(["100-199", 300]);
    expect(f.retryActions!.length).toStrictEqual(0);
    expect(f.timeout).toStrictEqual(10);
    expect(f.maxTimeoutRetryCount).toStrictEqual(1);
    expect(f.baseUrl).toStrictEqual("foo");
    expect(f.headers).not.toBeUndefined;
    expect(f.instanceName).toStrictEqual("custom");
    // now make sure it can be reconfigured
    configureFlechette({
      instanceName: "custom"
    });
    f = retrieveFromStorage("custom", "appConfig");
    expect(getFlechetteInstance("custom")).toStrictEqual(f);
    expect(f).not.toBeNull();
    expect(f.successCodes).toStrictEqual(["200-399"]);
  });
  afterAll(() => {
    removeFromStorage("flechette", "appConfig");
    removeFromStorage("custom", "appConfig");
    deleteStorage("appConfig");
  });
});

describe("when using getFlechetteInstance", () => {
  it("should create a flechette instance if get throws an error", () => {
    const f = getFlechetteInstance();
    expect(f).not.toBeNull();
    expect(f.successCodes).toStrictEqual(["200-399"]);
    expect(f.retryActions.length).toStrictEqual(3);
    expect(f.timeout).toStrictEqual(30000);
    expect(f.maxTimeoutRetryCount).toStrictEqual(2);
    expect(f.baseUrl).toStrictEqual("");
    expect(f.headers).toBeUndefined;
    expect(f.instanceName).toStrictEqual("flechette");
  });
  it("should create a flechette instance if the intance is not found", () => {
    const f = getFlechetteInstance("meh");
    expect(f).not.toBeNull();
    expect(f.successCodes).toStrictEqual(["200-399"]);
    expect(f.retryActions.length).toStrictEqual(3);
    expect(f.timeout).toStrictEqual(30000);
    expect(f.maxTimeoutRetryCount).toStrictEqual(2);
    expect(f.baseUrl).toStrictEqual("");
    expect(f.headers).toBeUndefined;
    expect(f.instanceName).toStrictEqual("meh");
  });
  afterEach(() => {
    removeFromStorage("meh", "appConfig");
    removeFromStorage("flechette", "appConfig");
    deleteStorage("appConfig");
  });
});
