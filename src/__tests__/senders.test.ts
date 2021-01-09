// @ts-nocheck
import { configureFlechette, send, FlechetteResponse } from "../index";
import { getFlechetteInstance } from "../flechette";
import { MockHeaders, mockResponse } from "./mocks";
import {
  evaluateResponse,
  fetchWrap,
  initialArgSetup,
  retryMultiple,
  sendAndEvaluate,
  sendAndEvaluateMultiple,
  sendRetryOrAbort
} from "../senders";
import { deleteStorage, removeFromStorage } from "storage-deck";

window.Headers = MockHeaders;

describe("when using fetchWrap", () => {
  it("should return a Net Response on success", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(200, "x"));
      });
    };
    const args = { path: "/foo", method: "GET", body: "bar" };
    const p = fetchWrap(args);
    Promise.resolve(p).then(res => {
      expect(res).toStrictEqual({ statusCode: 200, response: "x", sent: args });
      done();
    });
  });
  it("should return a NetResponse on failure", done => {
    window.fetch = () => {
      return new Promise(reject => {
        throw new Error("rejection");
      });
    };
    const args = { path: "/foo", method: "GET", body: "bar" };
    const p = fetchWrap(args);
    Promise.resolve(p).then(res => {
      expect(res).toStrictEqual({
        statusCode: 0,
        response: "Unknown Error: Error: rejection",
        sent: args
      });
      done();
    });
  });
  it("should return a separate error for abort", done => {
    window.fetch = () => {
      return new Promise(reject => {
        var e = new Error("abort");
        e.name = "AbortError";
        throw e;
      });
    };
    const args = { path: "/foo", method: "GET", body: "bar" };
    const p = fetchWrap(args);
    Promise.resolve(p).then(res => {
      expect(res).toStrictEqual({
        statusCode: 0,
        response: "Request Aborted",
        sent: args
      });
      done();
    });
  });
  afterEach(() => {
    delete window.fetch;
  });
});

describe("when using evaluateResponse", () => {
  it("should evaluate success", () => {
    const e = evaluateResponse(
      { statusCode: 200, response: "foo", sent: "bar" },
      getFlechetteInstance()
    );
    expect(e).toStrictEqual({
      success: true,
      statusCode: 200,
      response: "foo",
      sent: "bar"
    });
  });
  it("should evaluate failure", () => {
    const e = evaluateResponse(
      { statusCode: 400, response: "foo", sent: "bar" },
      getFlechetteInstance()
    );
    expect(e).toStrictEqual({
      success: false,
      statusCode: 400,
      response: "foo",
      sent: "bar"
    });
  });
  it("should try to parse if it's json", () => {
    const e = evaluateResponse(
      { statusCode: 400, response: '{"foo": "bar"}', sent: "" },
      getFlechetteInstance()
    );
    expect(e.response.foo).toStrictEqual("bar");
  });
});

describe("when using sendAndEvaluate/retry", () => {
  it("should evaluate anything in the success codes as success", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(200, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x",
          sent: args
        });
        done();
      },
      (response: FlechetteResponse) => {
        //force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should evaluate anything out of success codes as failure", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(500, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 500,
          response: "x",
          sent: args
        });
        done();
      },
      toggleLoading
    );
  });
  it("should retry if the code is within the RetryActions", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(408, "x"));
      });
    };
    var loadingCount = 0;
    var isLoading = false;
    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 408,
          response: "x",
          sent: args
        });
        done();
      },
      toggleLoading
    );
  });
  it("should hit 429 for RetryActions by default", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(429, "x"));
      });
    };
    var loadingCount = 0;
    var isLoading = false;
    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 429,
          response: "x",
          sent: args
        });
        done();
      },
      toggleLoading
    );
  });
  it("should hit 504 for RetryActions by default", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(504, "x"));
      });
    };
    var loadingCount = 0;
    var isLoading = false;
    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 504,
          response: "x",
          sent: args
        });
        //make sure that the action is placed back into flechette
        expect(
          getFlechetteInstance().retryActions.findIndex(
            ra => ra.code === response.statusCode
          )
        ).toBeGreaterThan(-1);
        done();
      },
      toggleLoading
    );
  });
  it("should fire on success if retry is successful", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(504, "x"));
      });
    };
    var loadingCount = 0;
    var isLoading = false;
    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    const fi = getFlechetteInstance();
    fi.retryActions[2].action = (
      response,
      waitingFunc,
      successFunc,
      failureFunc
    ) => {
      //make fetch return success before running retryAction
      window.fetch = () => {
        return new Promise(resolve => {
          resolve(mockResponse(200, "x"));
        });
      };
      send(response.sent, waitingFunc, successFunc, failureFunc);
    };
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x",
          sent: args
        });
        done();
      },
      (response: FlechetteResponse) => {
        //force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should hit alternate failure path if no retryActions exist", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(500, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const fi = getFlechetteInstance();
    fi.retryActions.length = 0;
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 500,
          response: "x",
          sent: args
        });
        done();
      },
      toggleLoading
    );
  });
  it("should override global retryAction with local one once", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(504, "x"));
      });
    };
    var loadingCount = 0;
    var isLoading = false;
    var hitLocalRetry = false;
    var hitGlobalRetry = false;

    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    // the previous test blanked all retry actions, so add this one back in
    configureFlechette({ instanceName: "test" });
    const fi = getFlechetteInstance("test");
    fi.retryActions.push({
      code: 504,
      action: (r, s, f) => {
        hitGlobalRetry = true;
        send(r.sent, s, f);
      }
    });

    const args = {
      path: "",
      method: "",
      body: "",
      retryActions: [
        {
          code: 504,
          action: (r, s, f) => {
            hitLocalRetry = true;
            send(r.sent, s, f);
          }
        }
      ]
    };

    sendAndEvaluate(
      args,
      (response: FlechetteResponse) => {
        // force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(hitLocalRetry).toBeTruthy;
        expect(hitGlobalRetry).toBeTruthy;
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 504,
          response: "x",
          sent: args
        });
        // 504 retryAction should be removed from sendArgs
        expect(args.retryActions.find(ra => ra.code === 504)).toBeUndefined;
        // 504 retryAction should be back in the global sendArgs
        expect(fi.retryActions.find(ra => ra.code === 504)).not.toBeUndefined;
        done();
      },
      toggleLoading
    );
  });
  it("should not allow arrays of sendArgs", () => {
    const args = [{ path: "", method: "", body: "" }];
    expect(() => {
      sendAndEvaluate(
        args,
        () => {},
        () => {},
        () => {}
      );
    }).toThrow();
  });
  afterAll(() => {
    //clean up storage
    removeFromStorage("flechette", "appConfig");
    deleteStorage("appConfig");
  });
});

describe("when using sendAndEvaluateMultiple/retryMultiple", () => {
  it("should evaluate anything in the success codes as success", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(200, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const a1 = { path: "", method: "", body: "" };
    const a2 = { path: "", method: "", body: "" };
    const args = [a1, a2];

    sendAndEvaluateMultiple(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual([
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a1
          },
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a2
          }
        ]);
        done();
      },
      (response: FlechetteResponse) => {
        //force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should evaluate anything out of success codes as failure", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(500, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const a1 = { path: "", method: "", body: "" };
    const a2 = { path: "", method: "", body: "", instanceName: "test" };
    const args = [a1, a2];

    sendAndEvaluateMultiple(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual([
          {
            success: false,
            statusCode: 500,
            response: "x",
            sent: a1
          },
          {
            success: false,
            statusCode: 500,
            response: "x",
            sent: a2
          }
        ]);
        done();
      },
      toggleLoading
    );
  });
  it("should retry if the code is within the RetryActions", done => {
    // this also tests removing/readding retryActions with the same code from
    // separate controllers
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(504, "x"));
      });
    };
    var loadingCount = 0;
    var isLoading = false;
    var retry1 = false;
    var retry2 = false;

    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    // the previous test blanked all retry actions, so add this one back in
    configureFlechette({
      instanceName: "test1",
      retryActions: [
        {
          code: 504,
          action: (r, w, s, f) => {
            window.fetch = () => {
              return new Promise(resolve => {
                resolve(mockResponse(200, "x"));
              });
            };
            send(r.sent, s, f);
          }
        }
      ]
    });
    configureFlechette({
      instanceName: "test2",
      retryActions: [
        {
          code: 504,
          action: (r, w, s, f) => {
            window.fetch = () => {
              return new Promise(resolve => {
                resolve(mockResponse(200, "x"));
              });
            };
            send(r.sent, s, f);
          }
        }
      ]
    });

    const a1 = { path: "a", method: "", body: "", instanceName: "test1" };
    const a2 = { path: "b", method: "", body: "", instanceName: "test2" };
    const args = [a1, a2];

    sendAndEvaluateMultiple(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(retry1).toBeTruthy;
        expect(retry2).toBeTruthy;
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual([
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a1
          },
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a2
          }
        ]);
        const fi1 = getFlechetteInstance("test1");
        const fi2 = getFlechetteInstance("test2");
        expect(fi1.retryActions.find(ra => ra.code === 504)).not.toBeUndefined;
        expect(fi2.retryActions.find(ra => ra.code === 504)).not.toBeUndefined;
        done();
      },
      (response: FlechetteResponse) => {
        // force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should override global retryAction with local one", done => {
    window.fetch = (path, args) => {
      switch (path) {
        case "meh1":
          return new Promise(resolve => {
            resolve(mockResponse(450, "x"));
          });
        case "meh3":
          return new Promise(resolve => {
            resolve(mockResponse(450, "x"));
          });
        default:
          return new Promise(resolve => {
            resolve(mockResponse(504, "x"));
          });
      }
    };
    var loadingCount = 0;
    var isLoading = false;
    var hitLocalRetry = false;
    var hitGlobalRetry = false;
    var hitAnotherRetry = false;

    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    configureFlechette({
      instanceName: "test",
      retryActions: [
        {
          code: 504,
          action: (r, s, f) => {
            window.fetch = (path, args) => {
              switch (path) {
                case "meh2":
                  return new Promise(resolve => {
                    resolve(mockResponse(450, "x"));
                  });
                default:
                  return new Promise(resolve => {
                    resolve(mockResponse(200, "x"));
                  });
              }
            };
            hitGlobalRetry = true;
            send(r.sent, s, f);
          }
        },
        {
          pathsToIgnore: ["_"],
          code: 450,
          action: (r, s, f) => {
            if (r.sent.path === "meh2") {
              // this is only hit on 2nd retry of a4
              hitAnotherRetry = true;
            }
            send(r.sent, s, f);
          }
        }
      ]
    });

    const a1 = {
      path: "foo",
      method: "",
      body: "",
      instanceName: "test",
      retryActions: [
        {
          code: 504,
          action: (r, s, f) => {
            hitLocalRetry = true;
            send(r.sent, s, f);
          }
        }
      ]
    };
    const a2 = { path: "bar", method: "", body: "" };
    const a3 = { path: "meh1", method: "", body: "", instanceName: "test" };
    const a4 = { path: "meh2", method: "", body: "", instanceName: "test" };
    const a5 = { path: "meh3", method: "", body: "", instanceName: "test" };
    const args = [a1, a2, a3, a4, a5];

    sendAndEvaluateMultiple(
      args,
      (response: FlechetteResponse) => {
        // force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(hitLocalRetry).toBeTruthy;
        expect(hitGlobalRetry).toBeTruthy;
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual(
          // a1 = "foo". It retries on local retry action and global.
          // the global changes the fetch to return 200 only if not "meh1"
          [
            { success: true, statusCode: 200, response: "x", sent: a1 },
            {
              // a2 retries just once and returns the same 504 since
              // a1's second retry has not fired
              success: false,
              statusCode: 504,
              response: "x",
              sent: a2
            },
            {
              // a3 hits the global retry action on the first round
              // and returns the same code, thus fails
              success: false,
              statusCode: 450,
              response: "x",
              sent: a3
            },
            {
              // a4 retries once along with a3, but it hits another retryAction
              // different from the first on the second run
              success: false,
              statusCode: 450,
              response: "x",
              sent: a4
            },
            {
              // a5 just works first time
              success: true,
              statusCode: 200,
              response: "x",
              sent: a5
            }
          ]
        );
        // 504 retryAction should be removed from sendArgs
        expect(a1.retryActions.find(ra => ra.code === 504)).toBeUndefined;
        // 504 retryAction should be unchanged in the global sendArgs
        const fi = getFlechetteInstance("test");
        const ra1 = fi.retryActions.find(ra => ra.code === 504);
        const ra2 = fi.retryActions.find(ra => ra.code === 450);
        expect(ra1).not.toBeUndefined;
        expect(ra2).not.toBeUndefined;
        expect(ra1.pathsToIgnore).toBeUndefined;
        expect(ra2.pathsToIgnore).toStrictEqual(["_"]);
        expect(hitAnotherRetry).toBeTruthy();
        done();
      },
      toggleLoading
    );
  });
  it("should fire successFunc if retry is successful", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(200, "x"));
      });
    };
    var loadingCount = 0;
    var isLoading = false;

    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    const a1 = { path: "", method: "", body: "" };
    const a2 = { path: "", method: "", body: "" };
    const args = [a1, a2];

    sendAndEvaluateMultiple(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual([
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a1
          },
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a2
          }
        ]);
        done();
      },
      (response: FlechetteResponse) => {
        // force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should hit alternate failure path if no retryActions exist", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(504, "x"));
      });
    };
    var loadingCount = 0;
    var isLoading = false;

    const toggleLoading = (b: boolean) => {
      isLoading = b;
      ++loadingCount;
    };

    // the previous test blanked all retry actions, so add this one back in
    const fi = getFlechetteInstance("test");
    fi.retryActions.length = 0;

    const a1 = { path: "", method: "", body: "" };
    const a2 = { path: "", method: "", body: "" };
    const args = [a1, a2];

    sendAndEvaluateMultiple(
      args,
      (response: FlechetteResponse) => {
        // force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(isLoading).toStrictEqual(false);
        // a2 becomes first since it's removed and added back in
        expect(response).toStrictEqual([
          {
            success: false,
            statusCode: 504,
            response: "x",
            sent: a2
          },
          {
            success: false,
            statusCode: 504,
            response: "x",
            sent: a1
          }
        ]);
        done();
      },
      toggleLoading
    );
  });
  it("should only allow arrays of sendArgs", () => {
    const args = { path: "", method: "", body: "" };
    expect(() => {
      sendAndEvaluateMultiple(
        args,
        () => {},
        () => {}
      );
    }).toThrow();
  });
  afterAll(() => {
    // clean up storage
    removeFromStorage("test", "appConfig");
    removeFromStorage("test1", "appConfig");
    removeFromStorage("test2", "appConfig");
    removeFromStorage("flechette", "appConfig");
    deleteStorage("appConfig");
  });
});

describe("when using retryMultiple", () => {
  it("should not dupe actionsToRebuild", done => {
    var hitRetry = false;
    configureFlechette({
      instanceName: "z",
      retryActions: [
        {
          code: 504,
          action: (r, s, f) => {
            hitRetry = true;
            s(r.sent);
            // give the promise a minute to resolve before checkng this
            setTimeout(() => {
              expect(
                getFlechetteInstance("z").retryActions.find(
                  ra => ra.code === 504
                )
              ).not.toBeUndefined();
              done();
            }, 1000);
          }
        }
      ]
    });
    expect(
      retryMultiple(
        [
          {
            success: false,
            statusCode: 504,
            response: "x",
            sent: { path: "a", instanceName: "z" }
          },
          {
            success: false,
            statusCode: 504,
            response: "y",
            sent: { path: "b", instanceName: "z" }
          }
        ],
        response => {},
        response => {}
      )
    ).toBeTruthy();
    expect(hitRetry).toBeTruthy();
  });
  afterAll(() => {
    // clean up storage
    removeFromStorage("z", "appConfig");
    deleteStorage("appConfig");
  });
});

describe("when using sendRetryOrAbort", () => {
  it("should not abort if there is a zero timeout", done => {
    setTimeout(() => {
      done();
    }, 100); // trigger failure if it takes this long
    sendRetryOrAbort(
      null,
      0,
      0,
      () => {
        throw "test should not retry";
      },
      () => {
        return;
      }, // sendAndEvalFunc
      () => {
        return;
      }, // successFunc
      () => {
        return;
      }, // failureFunc
      () => {
        return;
      } // waitingFunc
    );
  });
  it("should abort if timout is reached before success or failure", done => {
    var sendCount = 0;
    var abortCount = 0;
    setTimeout(() => {
      expect(sendCount).toStrictEqual(10);
      expect(abortCount).toStrictEqual(10);
      done();
    }, 1000);
    sendRetryOrAbort(
      null,
      10,
      9,
      () => {
        ++abortCount;
      }, //abortFunc
      () => {
        ++sendCount;
      }, // sendAndEvalFunc
      () => {
        return;
      }, // successFunc
      () => {
        return;
      } // failureFunc
    );
  });
  it("should only abort if it has a zero retry count", done => {
    var sendCount = 0;
    var abortCount = 0;
    setTimeout(() => {
      expect(sendCount).toStrictEqual(1);
      expect(abortCount).toStrictEqual(1);
      done();
    }, 100);
    sendRetryOrAbort(
      null,
      10,
      0,
      () => {
        ++abortCount;
      }, //abortFunc
      () => {
        ++sendCount;
      }, // sendAndEvalFunc
      () => {
        return;
      }, // successFunc
      () => {
        return;
      } // failureFunc
    );
  });
});

describe("when using initialArgSetup", () => {
  it("should replace base url and headers", () => {
    const h1 = new MockHeaders();
    h1.append("foo", "bar");
    const h2 = new MockHeaders();
    h2.append("foo", "meh");
    h2.append("bar", "foo");
    const args = { path: "meh", headers: h1 };
    configureFlechette({ instanceName: "test", baseUrl: "_", headers: h2 });
    initialArgSetup(getFlechetteInstance("test"), args);
    expect(args.path).toStrictEqual("_meh");
    expect(args.headers.entries().length).toStrictEqual(2);
    expect(args.headers.entries()[0]).toStrictEqual(["foo", "bar"]);
    expect(args.headers.entries()[1]).toStrictEqual(["bar", "foo"]);
  });
  afterAll(() => {
    removeFromStorage("test", "appConfig");
    deleteStorage("appConfig");
  });
});

describe("when using send", () => {
  it("should use default instance when no instance name is provided", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(200, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const args = { path: "", method: "", body: "" };

    send(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x",
          sent: args
        });
        done();
      },
      (response: FlechetteResponse) => {
        //force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should use named instance when it is provided", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(200, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const args = { path: "", method: "", body: "", instanceName: "test" };

    send(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x",
          sent: args
        });
        removeFromStorage("test", "appConfig");
        done();
      },
      (response: FlechetteResponse) => {
        //force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should fire failureFunc when a failure code is encountered", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(500, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const args = { path: "", method: "", body: "" };

    send(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 500,
          response: "x",
          sent: args
        });
        done();
      },
      toggleLoading
    );
  });
  it("should retry for the max number of retries", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        // do not resolve
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const fi = getFlechetteInstance();
    fi.timeout = 1000;
    const args = { path: "", method: "", body: "" };

    setTimeout(() => {
      window.fetch = () => {
        return new Promise(resolve => {
          resolve(mockResponse(200, "x"));
        });
      };
    }, 1100);

    send(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(4);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x",
          sent: args
        });
        done();
      },
      (response: FlechetteResponse) => {
        // force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should run failureFunc if retries do not get a response", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        // do not resolve
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const fi = getFlechetteInstance();
    fi.timeout = 1000;
    const args = { path: "", method: "", body: "" };

    send(
      args,
      (response: FlechetteResponse) => {
        // force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(4);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 0,
          response: "Request Timed Out",
          sent: args
        });
        done();
      },
      toggleLoading
    );
  });
  it("should not attempt a retry if the timeout is 0", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        //do not resolve
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const fi = getFlechetteInstance();
    fi.timeout = 0;
    const args = { path: "", method: "", body: "" };

    setTimeout(() => {
      //make sure a retry never happens if timeout = 0
      expect(loadingCount).toStrictEqual(1);
      done();
    }, 4000);

    send(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        //force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should fire successFunc when multiple sendArgs are successful", done => {
    window.fetch = (path, args) => {
      switch (path) {
        case "foo":
          return new Promise(resolve => {
            resolve(mockResponse(200, "x"));
          });
        case "_bar": // this one uses a base url
          return new Promise(resolve => {
            resolve(mockResponse(200, '{"x": "y"}'));
          });
        default:
          return new Promise(resolve => {
            resolve(mockResponse(500, "x"));
          });
      }
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    configureFlechette({
      maxTimeoutRetryCount: 3,
      timeout: 10000
    });
    configureFlechette({
      instanceName: "test",
      maxTimeoutRetryCount: 5,
      timeout: 1500,
      baseUrl: "_"
    });
    const a1 = { path: "foo", method: "", body: "" };
    const a2 = { path: "bar", method: "", body: "", instanceName: "test" };
    const args = [a1, a2];

    send(
      args,
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual([
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a1
          },
          {
            success: true,
            statusCode: 200,
            response: { x: "y" },
            sent: a2
          }
        ]);
        done();
      },
      (response: FlechetteResponse) => {
        //force an error if failureFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      toggleLoading
    );
  });
  it("should fire failureFunc when only one sendArg fails", done => {
    window.fetch = (path, args) => {
      switch (path) {
        case "foo":
          return new Promise(resolve => {
            resolve(mockResponse(200, "x"));
          });
        default:
          return new Promise(resolve => {
            resolve(mockResponse(500, '{"x": "y"}'));
          });
      }
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const a1 = { path: "foo", method: "", body: "" };
    const a2 = { path: "bar", method: "", body: "", instanceName: "test" };
    const args = [a1, a2];

    send(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual([
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a1
          },
          {
            success: false,
            statusCode: 500,
            response: { x: "y" },
            sent: a2
          }
        ]);
        done();
      },
      toggleLoading
    );
  });
  it("should fire failureFunc when all sendArgs fail", done => {
    window.fetch = (path, args) => {
      return new Promise(resolve => {
        resolve(mockResponse(500, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const a1 = { path: "1", method: "", body: "" };
    const a2 = { path: "2", method: "", body: "" };
    const args = [a1, a2];

    send(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual([
          {
            success: false,
            statusCode: 500,
            response: "x",
            sent: a1
          },
          {
            success: false,
            statusCode: 500,
            response: "x",
            sent: a2
          }
        ]);
        done();
      },
      toggleLoading
    );
  });
  it("should use the largest timeout and retry count", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        //do not resolve
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    configureFlechette({
      maxTimeoutRetryCount: 3,
      timeout: 60
    });
    configureFlechette({
      instanceName: "test",
      maxTimeoutRetryCount: 5,
      timeout: 50,
      baseUrl: "_"
    });
    const a1 = { path: "foo", method: "", body: "" };
    const a2 = { path: "bar", method: "", body: "", instanceName: "test" };
    const args = [a1, a2];

    send(
      args,
      (response: FlechetteResponse) => {
        //force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(7);
        // 1 for initial run, 5 for retries, then 1 for final one
        expect(response).toStrictEqual([
          {
            success: false,
            statusCode: 0,
            response: "Request Timed Out",
            sent: a1
          },
          {
            success: false,
            statusCode: 0,
            response: "Request Timed Out",
            sent: a2
          }
        ]);
        done();
      },
      toggleLoading
    );
  });
  it("should retry in a basic retry scenario", done => {
    window.fetch = (path, args) => {
      return new Promise(resolve => {
        resolve(mockResponse(900, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const args = {
      path: "1",
      method: "",
      body: "",
      retryActions: [
        {
          code: 900,
          action: (r, w, s, f) => {
            // just try to resend. this will fail on the second go
            send(r.sent, w, s, f);
          }
        }
      ]
    };

    send(
      args,
      (response: FlechetteResponse) => {
        // force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: FlechetteResponse) => {
        expect(loadingCount).toStrictEqual(2);
        // this should be removed to prevent a loop
        expect(args.retryActions.length).toStrictEqual(0);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 900,
          response: "x",
          sent: args
        });
        done();
      },
      toggleLoading
    );
  });
  it("should retry in a basic multi-retry scenario", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(900, "x"));
      });
    };
    var loadingCount = 0;
    const toggleLoading = () => {
      ++loadingCount;
    };

    const a1 = { path: "foo", method: "", body: "" };
    const a2 = {
      path: "bar",
      method: "",
      body: "",
      instanceName: "test",
      retryActions: [
        {
          code: 900,
          action: (r, w, s, f) => {
            window.fetch = () => {
              return new Promise(resolve => {
                resolve(mockResponse(200, "x"));
              });
            };
            send(r.sent, w, s, f);
          }
        }
      ]
    };
    const args = [a1, a2];

    send(
      args,
      response => {
        // force an error if successFunc fires
        expect(true).toStrictEqual(false);
        done();
      },
      response => {
        expect(loadingCount).toStrictEqual(2);
        // this should be removed to prevent a loop
        expect(a2.retryActions.length).toStrictEqual(0);
        // we should see one success for the retried call
        expect(response).toStrictEqual([
          {
            success: false,
            statusCode: 900,
            response: "x",
            sent: a1
          },
          {
            success: true,
            statusCode: 200,
            response: "x",
            sent: a2
          }
        ]);
        done();
      },
      toggleLoading
    );
  });
  afterEach(() => {
    removeFromStorage("test", "appConfig");
    removeFromStorage("flechette", "appConfig");
    deleteStorage("appConfig");
  });
});
