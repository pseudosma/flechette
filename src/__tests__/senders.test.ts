import {
  EvaluatedResponse,
  flechetteFetch,
  getFlechetteInstance
} from "../index";
import { evaluateResponse, send, sendAndEvaluate } from "../senders";
import { deleteStorage, removeFromStorage } from "storage-deck";

const mockHeader = {
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

const mockResponse = (statusCode: number, responseBody: string): Response => {
  return {
    status: statusCode,
    headers: mockHeader,
    ok: true,
    statusText: statusCode.toString(),
    redirected: false,
    trailer: new Promise(resolve => {
      resolve(mockHeader);
    }),
    type: "basic",
    url: "/foo",
    clone: () => {
      return new Response();
    },
    body: null,
    bodyUsed: true,
    arrayBuffer: () => {
      return new Promise(() => {});
    },
    blob: () => {
      return new Promise(() => {});
    },
    formData: () => {
      return new Promise(() => {});
    },
    json: () => {
      return new Promise(() => {});
    },
    text: () => {
      return new Promise(resolve => {
        resolve(responseBody);
      });
    }
  };
};

describe("when using send", () => {
  it("should return a Net Response on success", done => {
    window.fetch = () => {
      return new Promise(resolve => {
        resolve(mockResponse(200, "x"));
      });
    };
    const p = send({ path: "/foo", method: "GET", body: "bar" });
    Promise.resolve(p).then(res => {
      expect(res).toStrictEqual({ statusCode: 200, response: "x" });
      done();
    });
  });
  it("should return a Net Response on failure", done => {
    window.fetch = () => {
      return new Promise(reject => {
        throw new Error("rejection");
      });
    };
    const p = send({ path: "/foo", method: "GET", body: "bar" });
    Promise.resolve(p).then(res => {
      expect(res).toStrictEqual({
        statusCode: 500,
        response: "Unknown Error: Error: rejection"
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
    const p = send({ path: "/foo", method: "GET", body: "bar" });
    Promise.resolve(p).then(res => {
      expect(res).toStrictEqual({
        statusCode: 500,
        response: "Request Aborted"
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
      { statusCode: 200, response: "foo" },
      getFlechetteInstance()
    );
    expect(e).toStrictEqual({
      success: true,
      statusCode: 200,
      response: "foo"
    });
  });
  it("should evaluate failure", () => {
    const e = evaluateResponse(
      { statusCode: 400, response: "foo" },
      getFlechetteInstance()
    );
    expect(e).toStrictEqual({
      success: false,
      statusCode: 400,
      response: "foo"
    });
  });
  it("should try to parse if it's json", () => {
    const e = evaluateResponse(
      { statusCode: 400, response: '{"foo": "bar"}' },
      getFlechetteInstance()
    );
    expect(e.response.foo).toStrictEqual("bar");
  });
});

describe("when using sendAndEvaluate", () => {
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

    const fi = getFlechetteInstance();
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      fi,
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x"
        });
        done();
      },
      (response: EvaluatedResponse) => {
        //force an error if onFailure fires
        expect(true).toStrictEqual(false);
        done();
      }
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

    const fi = getFlechetteInstance();
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      fi,
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        //force an error if onSuccess fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 500,
          response: "x"
        });
        done();
      }
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

    const fi = getFlechetteInstance();
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      fi,
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        //force an error if onSuccess fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(3); //set loading to true twice, then false once
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 408,
          response: "x"
        });
        done();
      }
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

    const fi = getFlechetteInstance();
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      fi,
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        //force an error if onSuccess fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(3);
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 429,
          response: "x"
        });
        done();
      }
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

    const fi = getFlechetteInstance();
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      fi,
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        //force an error if onSuccess fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(3);
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 504,
          response: "x"
        });
        //make sure that the action is placed back into flechette
        expect(
          fi.retryActions.findIndex(ra => ra.code === response.statusCode)
        ).toBeGreaterThan(-1);
        done();
      }
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
      sent,
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
      flechetteFetch(sent, waitingFunc, successFunc, failureFunc);
    };
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      fi,
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(3);
        expect(isLoading).toStrictEqual(false);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x"
        });
        done();
      },
      (response: EvaluatedResponse) => {
        //force an error if onFailure fires
        expect(true).toStrictEqual(false);
        done();
      }
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
    fi.retryActions.length = 0; //
    const args = { path: "", method: "", body: "" };

    sendAndEvaluate(
      fi,
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        //force an error if onSuccess fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 500,
          response: "x"
        });
        done();
      }
    );
  });
  afterAll(() => {
    //clean up storage
    removeFromStorage("flechette", "appConfig");
    deleteStorage("appConfig");
  });
});

describe("when using flechetteFetch", () => {
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

    flechetteFetch(
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x"
        });
        done();
      },
      (response: EvaluatedResponse) => {
        //force an error if onFailure fires
        expect(true).toStrictEqual(false);
        done();
      }
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

    flechetteFetch(
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x"
        });
        removeFromStorage("test", "appConfig");
        done();
      },
      (response: EvaluatedResponse) => {
        //force an error if onFailure fires
        expect(true).toStrictEqual(false);
        done();
      }
    );
  });
  it("should fire onFailure when a failure code is encountered", done => {
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

    flechetteFetch(
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        //force an error if onSuccess fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(2);
        expect(response).toStrictEqual({
          success: false,
          statusCode: 500,
          response: "x"
        });
        done();
      }
    );
  });
  it("should retry for the max number of retries", done => {
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
    fi.timeout = 1000;
    const args = { path: "", method: "", body: "" };

    setTimeout(() => {
      window.fetch = () => {
        return new Promise(resolve => {
          resolve(mockResponse(200, "x"));
        });
      };
    }, 1100);

    flechetteFetch(
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        expect(loadingCount).toStrictEqual(4);
        //fires 3 times passing true, then once passing false
        expect(response).toStrictEqual({
          success: true,
          statusCode: 200,
          response: "x"
        });
        done();
      },
      (response: EvaluatedResponse) => {
        //force an error if onFailure fires
        expect(true).toStrictEqual(false);
        done();
      }
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

    flechetteFetch(
      args,
      toggleLoading,
      (response: EvaluatedResponse) => {
        //force an error if onSuccess fires
        expect(true).toStrictEqual(false);
        done();
      },
      (response: EvaluatedResponse) => {
        //force an error if onFailure fires
        expect(true).toStrictEqual(false);
        done();
      }
    );
  });
  afterEach(() => {
    removeFromStorage("flechette", "appConfig");
    deleteStorage("appConfig");
  });
});
