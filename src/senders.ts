import {
  EvaluatedResponse,
  FlechetteController,
  getFlechetteInstance,
  NetResponse,
  ResponseFunc,
  RetryAction,
  SendArgs,
  ToggleFunc
} from "./flechette";

import { checkCodes } from "./utils";

export const send = (args: SendArgs): Promise<NetResponse> => {
  return fetch(args.path, args)
    .then(response => {
      return Promise.resolve(response.text()).then(res => ({
        d: res,
        sc: response.status
      }));
    })
    .then(res => {
      return { response: res.d, statusCode: res.sc };
    })
    .catch(err => {
      let r = "Unknown Error: " + err;
      if (err.name === "AbortError") {
        r = "Request Aborted";
      }
      return { response: r, statusCode: 500 };
    });
};

export const evaluateResponse = (
  resp: NetResponse,
  f: FlechetteController
): EvaluatedResponse => {
  let s: boolean = false;
  let r;
  try {
    // try to parse it to an object if it is json
    r = JSON.parse(resp.response);
  } catch {
    r = resp.response;
  }
  f.successCodes.some(sc => {
    s = checkCodes(resp.statusCode, sc);
    return s;
  });
  return { success: s, statusCode: resp.statusCode, response: r };
};

export const sendAndEvaluate = (
  flechetteInstance: FlechetteController,
  args: SendArgs,
  waitingFunc: ToggleFunc,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc
) => {
  waitingFunc(true);
  const response = send(args);
  Promise.resolve(response).then(res => {
    const retVal: EvaluatedResponse = evaluateResponse(res, flechetteInstance);
    if (retVal.success) {
      waitingFunc(false);
      successFunc(retVal);
    } else {
      if (
        Array.isArray(flechetteInstance.retryActions) &&
        flechetteInstance.retryActions.length > 0
      ) {
        // check just in case this has been manipulated
        const i = flechetteInstance.retryActions.findIndex(
          ra => ra.code === retVal.statusCode
        );
        if (i > -1) {
          const r: RetryAction = Object.assign(
            {},
            flechetteInstance.retryActions[i]
          );
          // need to temporarily remove the retryAction so it doesn't loop
          flechetteInstance.retryActions.splice(i, 1);
          // add it back in success/failure
          const sf = (rVal: EvaluatedResponse) => {
            flechetteInstance.retryActions.push(r);
            successFunc(rVal);
          };
          const ff = (rVal: EvaluatedResponse) => {
            flechetteInstance.retryActions.push(r);
            failureFunc(rVal);
          };
          // let retryAction determine when waiting is over
          r.action(retVal, args, waitingFunc, sf, ff);
        } else {
          waitingFunc(false);
          failureFunc(retVal);
        }
      } else {
        waitingFunc(false);
        failureFunc(retVal);
      }
    }
  });
};

export const flechetteFetch = (
  args: SendArgs,
  waitingFunc: ToggleFunc,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc
) => {
  const f = getFlechetteInstance(args.instanceName);
  // initial setup
  args.signal = f.abortController.signal;
  args.path = f.baseUrl + args.path;

  const t: Array<number> = []; // will be the timeout handlers

  const sf: ResponseFunc = res => {
    // wrap this so our timeout is cleared if sendAndEvaluate finishes
    t.forEach(o => {
      clearTimeout(o);
    });
    successFunc(res);
  };
  const ff: ResponseFunc = res => {
    t.forEach(o => {
      clearTimeout(o);
    });
    failureFunc(res);
  };

  if (typeof f.timeout === "number" && f.timeout > 0) {
    // check just in case this has been manipulated
    for (let i = 1; i <= f.maxTimeoutRetryCount; i++) {
      // need to create all timeouts upfront so they can easily be cleared on success of one
      t.push(
        setTimeout(() => {
          f.abortCurrentFetch();
          console.warn(
            "Timeout limit reached without a network response. Retrying..."
          );
          sendAndEvaluate(f, args, waitingFunc, sf, ff);
        }, f.timeout * i)
      );
    }
  }
  sendAndEvaluate(f, args, waitingFunc, sf, ff);
};
