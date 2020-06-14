import {
  FlechetteController,
  FlechetteResponse,
  getFlechetteInstance,
  NetResponse,
  ResponseFunc,
  RetryAction,
  SendArgs,
  ToggleFunc
} from "./flechette";

import { 
  checkCodes,
  combineHeaders,
  determineRetryAction 
} from "./utils";

export type SendAndEvalFunc = (
  args: SendArgs | Array<SendArgs>,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc,
  waitingFunc?: ToggleFunc
) => void;

export const send = (
  args: SendArgs | Array<SendArgs>,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc,
  waitingFunc?: ToggleFunc,
) => {
  if (Array.isArray(args)) {
    var timeout = 0;
    var maxRetries = 0;
    var sendFunc: SendAndEvalFunc;
    var abortFunc;
    const instancesRef: Array<FlechetteController> = [];

    args.forEach((a) => {
      const flechetteInstance = getFlechetteInstance(a.instanceName);
      instancesRef.push(flechetteInstance);
      initialArgSetup(flechetteInstance, a);
      // find the biggest timeout and retry count amoung each flechette instance
      if (flechetteInstance.timeout > timeout) {
        timeout = flechetteInstance.timeout;
      }
      if (flechetteInstance.maxTimeoutRetryCount > maxRetries) {
        maxRetries = flechetteInstance.maxTimeoutRetryCount;
      }
    });
    sendFunc = sendAndEvaluateMultiple;
    abortFunc = () => { instancesRef.forEach((f) => {
      // perform all abort actions
      f.abortCurrentFetch();
      }) 
    };

  } else {
    const flechetteInstance = getFlechetteInstance(args.instanceName);
    initialArgSetup(flechetteInstance, args);
    timeout = flechetteInstance.timeout;
    maxRetries = flechetteInstance.maxTimeoutRetryCount;
    sendFunc = sendAndEvaluate;
    abortFunc = () => { flechetteInstance.abortCurrentFetch() };
  }
  sendRetryOrAbort(
    args,
    timeout,
    maxRetries,
    abortFunc,
    sendFunc,
    successFunc, 
    failureFunc,
    waitingFunc
  );
};

export const initialArgSetup = (flechetteInstance: FlechetteController, args: SendArgs) => {
  args.signal = flechetteInstance.abortController.signal;
  if (args.path && !args.path.includes(flechetteInstance.baseUrl)) {
    args.path = flechetteInstance.baseUrl + args.path;
  }
  // if the SendArgs has headers, use those. Otherwise, use flechette's
  args.headers = combineHeaders(args.headers, flechetteInstance.headers);
}

const buildAbortResponse = (args: SendArgs) => {
  return {
    success: false,
    statusCode: 500,
    response: "Request Timed Out",
    sent: args
  };
}

export const sendRetryOrAbort = (
  args: SendArgs | Array<SendArgs>,
  timeout: number | undefined,
  maxRetryCount: number,
  abortFunc: () => void,
  sendAndEvalFunc: SendAndEvalFunc,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc,
  waitingFunc?: ToggleFunc
) => {
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
  
  if (typeof timeout === "number" && timeout > 0) {
    // need to create all timeouts upfront so they can easily be cleared on success of one
    // first, create the final timeout
    t.push(setTimeout(() => {
      abortFunc();
      // since this is the final timeout, run failureFunc
      var failureResponse: FlechetteResponse | Array<FlechetteResponse>;
      if (Array.isArray(args)) {
        failureResponse = [];
        args.forEach((a) => {
          (failureResponse as Array<FlechetteResponse>).push(buildAbortResponse(a));
        });
      } else {
        failureResponse = buildAbortResponse(args);
      }
      waitingFunc && waitingFunc(false);
      failureFunc(failureResponse);
    }, (timeout * maxRetryCount) + timeout));
    for (let i = 1; i <= maxRetryCount; ++i) {
      // then create the abort + retry scenarios
      t.push(
        setTimeout(() => {
          abortFunc();
          console.warn(
            "Timeout limit reached without a network response. Retrying..."
          );
          sendAndEvalFunc(args, sf, ff, waitingFunc);
        }, timeout * i)
      );
    }
  }
  sendAndEvalFunc(args, sf, ff, waitingFunc);
}

export const sendAndEvaluate: SendAndEvalFunc = (
  args: SendArgs | Array<SendArgs>,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc,
  waitingFunc?: ToggleFunc,
) => {
  if (!Array.isArray(args)) {
    // here we must retrieve the flechette instance again to decouple the values
    // that we use for initial setup from the ones e send with. This is to help
    // support multiSends 
    waitingFunc && waitingFunc(true);
    const response = fetchWrap(args);
    Promise.resolve(response).then(res => {
      const flechetteInstance = getFlechetteInstance(args.instanceName);
      const reponse: FlechetteResponse = evaluateResponse(res, flechetteInstance);
      if (reponse.success) {
        waitingFunc && waitingFunc(false);
        successFunc(reponse);
      } else {
        // retry func encapsulates the whole retry process
        // if it returns false, it means we're not retrying so move onto failure
        if (!retry(reponse, flechetteInstance, successFunc, failureFunc, waitingFunc)) {
          waitingFunc && waitingFunc(false);
          failureFunc(reponse);
        }
      }
    });
  } else {
    throw new Error("Cannot use array of SendArgs"); 
  }
};

export const sendAndEvaluateMultiple: SendAndEvalFunc = (
  args: SendArgs | Array<SendArgs>,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc,
  waitingFunc?: ToggleFunc
) => {
  if (Array.isArray(args)) {
    const promises: Array<Promise<NetResponse>> = [];
    var responses: Array<FlechetteResponse> = []; // var since retry may change

    waitingFunc && waitingFunc(true);
    args.forEach((a) => {
      promises.push(fetchWrap(a));
    });
    Promise.all(promises).then(res => {
      res.forEach((r) => {
        const flechetteInstance = getFlechetteInstance(r.sent.instanceName);
        const ev = evaluateResponse(r, flechetteInstance);
        responses.push(ev);
      });
      if (responses.every((r) => { return r.success })) {
        waitingFunc && waitingFunc(false);
        successFunc(responses);
      } else {
        if (!retryMultiple(responses, successFunc, failureFunc, waitingFunc)) {
          waitingFunc && waitingFunc(false);
          failureFunc(responses);
        }
      }
    });
  } else {
    throw new Error("Must use array of SendArgs"); 
  }
}

const replaceOriginalPath = (path: string, ra: RetryAction): Array<string> | undefined => {
  var originalPathsToIgnore: string[] | undefined;
  if (Array.isArray(ra.pathsToIgnore)) {
    originalPathsToIgnore = [...ra.pathsToIgnore];
    ra.pathsToIgnore.push(path);
  } else {
    originalPathsToIgnore = undefined;
    ra.pathsToIgnore = [];
    ra.pathsToIgnore.push(path);
  }
  return originalPathsToIgnore;
}

export const retry = (
  response: FlechetteResponse,
  flechetteInstance: FlechetteController,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc,
  waitingFunc?: ToggleFunc,
) : boolean => {
  // this returns a array containing the desired retry action, if one exists,
  // and its index if it comes from the global retryActions.

  const ra = determineRetryAction(
    response.statusCode, 
    response.sent, 
    flechetteInstance.retryActions);
  if (ra[0] !== undefined) {
    var finalize = () => {waitingFunc && waitingFunc(false)};
    if (ra[1] > -1) {
      // this indicates it was in the global retry list, 
      // so we'll need to remove it and add it back in when all steps are done.
      const originalPathsToIgnore: string[] | undefined = replaceOriginalPath(
        response.sent.path,
        ra[0]
      );
      finalize = () => {
        waitingFunc && waitingFunc(false);
        flechetteInstance.retryActions[ra[1]].pathsToIgnore = originalPathsToIgnore;
      }
    }
    const sf = (rVal: FlechetteResponse|Array<FlechetteResponse>) => {
      finalize();
      successFunc(rVal);
    };
    const ff = (rVal: FlechetteResponse|Array<FlechetteResponse>) => {
      finalize();
      failureFunc(rVal);
    };
    // let retryAction determine when waiting is over
    ra[0].action(
      response, 
      sf, 
      ff
    );
    return true;
  }
  return false;
}

export const retryMultiple = (
  responses: Array<FlechetteResponse>,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc,
  waitingFunc?: ToggleFunc
) : boolean => {
  var retVal: boolean = false;
  const promises: Array<Promise<FlechetteResponse>> = [];
  const localResponses = [...responses]; // make a copy since we'll mutate the index
  const actionsToRebuild: Array<{instanceName: string, code: number, pathsToIgnore?: Array<string>}> =[];
  localResponses.forEach((r) => {
    if (!r.success) {
      const fi: FlechetteController = getFlechetteInstance(r.sent.instanceName);
      const ra = determineRetryAction(
        r.statusCode, 
        r.sent, 
        fi.retryActions
      );
      if (ra[0] !== undefined) {
        retVal = true;
        // splice out the retry from the responses
        const i: number = responses.findIndex((res) => { 
          return (res.sent.path === r.sent.path && res.sent.instanceName === r.sent.instanceName);
        });
        responses.splice(i,1);
        if (ra[1] > -1) {
          // this means we've got a global action.
          // we need to add this path to the action's pathsToIgnore
          const originalPathsToIgnore: string[] | undefined = replaceOriginalPath(
            r.sent.path,
            ra[0]
          );
          // now add this to a list to change back later
          const a = actionsToRebuild.find(
            (a) => { 
              return (a.code === (ra[0] as RetryAction).code 
              && a.instanceName === fi.instanceName)
            }
          );
          if (!a) {
            actionsToRebuild.push({
              instanceName: fi.instanceName, 
              code: ra[0].code,
              pathsToIgnore: originalPathsToIgnore
            });
          }
        }
        // we can't guarantee that all RetryActions will do another send
        // so retries need to be wrapped in a promise that resolves 
        // when all the success or failure funcs are fired.
        promises.push(new Promise((resolve) => {
          const sf = (rVal: FlechetteResponse|Array<FlechetteResponse>) => {
            resolve(rVal as FlechetteResponse);
          };
          const ff = (rVal: FlechetteResponse|Array<FlechetteResponse>) => {
            resolve(rVal as FlechetteResponse);
          };
          (ra[0] as RetryAction).action(r, 
            sf, 
            ff);
        }));
      }
    }
  });
  if (promises.length > 0) {
    Promise.all(promises).then((res) => {
      // add the new responses from retry actions back to existing list
      responses = responses.concat(res);
      // rebuild any actions we've removed
      actionsToRebuild.forEach((atr) => {
        const fi = getFlechetteInstance(atr.instanceName);
        const ra: RetryAction|undefined = fi.retryActions.find((ra) => {
          return ra.code === atr.code;
        });
        (ra) && (ra.pathsToIgnore = atr.pathsToIgnore);
      });
      // finally, call the success or failure func
      waitingFunc && waitingFunc(false);
      if (responses.every((r) => { return r.success })) {
        successFunc(responses);
      } else {
        failureFunc(responses);
      }
    });
  }
  return retVal;
}

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
  return { success: s, statusCode: resp.statusCode, response: r, sent:  resp.sent};
};

export const fetchWrap = (args: SendArgs): Promise<NetResponse> => {
  return fetch(args.path, args)
    .then(response => {
      return Promise.resolve(response.text()).then(res => ({
        d: res,
        sc: response.status
      }));
    })
    .then(res => {
      return { response: res.d, statusCode: res.sc, sent: args };
    })
    .catch(err => {
      let r = "Unknown Error: " + err;
      if (err.name === "AbortError") {
        r = "Request Aborted";
      }
      return { response: r, statusCode: 500, sent: args };
    });
};
