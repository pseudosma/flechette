import {
  FlechetteController,
  FlechetteResponse,
  getFlechetteInstance,
  NetResponse,
  ResponseFunc,
  SendArgs,
  ToggleFunc
} from "./flechette";

import { 
  cacheResponseData, 
  checkCodes, 
  checkForCachedData,
  determineRetryAction 
} from "./utils";

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
): FlechetteResponse => {
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
  return { success: s, statusCode: resp.statusCode, response: r, isCachedResponse: false };
};

export const retry = (
  response: FlechetteResponse,
  args: SendArgs, 
  flechetteInstance: FlechetteController,
  waitingFunc: ToggleFunc,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc
) : boolean => {
  // this returns a tuple containing the desired retry action, if one exists,
  // and its index if it comes from the global retryActions.

  const ra = determineRetryAction(
    response.statusCode, 
    args.retryActions, 
    flechetteInstance.retryActions);
  if (ra[0] !== undefined) {
    var finalize = () => {};
    if (ra[1] > -1) {
      // this indicates it was in the global retry list, 
      // so we'll need to remove it and add it back in when all steps are done.
      flechetteInstance.retryActions.splice(ra[1], 1);
      finalize = () => {
        if (ra[0]) {
          flechetteInstance.retryActions.push(ra[0]);
        }
      }
    }
    const sf = (rVal: FlechetteResponse) => {
      finalize();
      successFunc(rVal);
    };
    const ff = (rVal: FlechetteResponse) => {
      finalize();
      failureFunc(rVal);
    };
    // let retryAction determine when waiting is over
    ra[0].action(response, args, waitingFunc, sf, ff);
    return true;
  }
  return false;
}

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
    const retVal: FlechetteResponse = evaluateResponse(res, flechetteInstance);
    if (retVal.success) {
      cacheResponseData(args, retVal);
      waitingFunc(false);
      successFunc(retVal);
    } else {
      // retry func encapsulates the whole retry process
      // if it returns false, it means we're not retrying so move onto failure
      if (!retry(retVal, args, flechetteInstance, waitingFunc, successFunc, failureFunc)) {
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
  // before anything else check to see if there's a cached response to these args
  const r = checkForCachedData(args);
  if (r === null) {
    // no cached item found, continue through normal flow
    const f = getFlechetteInstance(args.instanceName);
    // initial setup
    args.signal = f.abortController.signal;
    args.path = f.baseUrl + args.path;
    //if the SendArgs has headers, use those. Otherwise, use flechette's
    if (!args.headers) {
      args.headers = f.headers;
    }
  
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
  } else {
    waitingFunc(false);
    successFunc(r);
  }
};
