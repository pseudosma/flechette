// @ts-nocheck
export class MockHeaders {
  constructor(headerInit) {
    this.kv = [];
    if (headerInit) {
      // for tests, we'll only run Headers initializing Headers
      this.kv = headerInit.entries();
    }
  }

  append(name: string, value: string): void {
    const i = this.kv.findIndex(f => f[0] === name);
    if (i === -1) {
      this.kv.push([name, value]);
    } else {
      this.kv.splice(i, 1, [name, value]);
    }
  }

  entries() {
    return this.kv;
  }
}

export const mockResponse = (
  statusCode: number,
  responseBody: string
): Response => {
  return {
    status: statusCode,
    headers: MockHeaders,
    ok: true,
    statusText: statusCode.toString(),
    redirected: false,
    trailer: new Promise(resolve => {
      resolve(MockHeaders);
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
