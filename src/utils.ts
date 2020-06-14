import { RetryAction, SendArgs } from "./flechette";

export const checkCodes = (
  incomingCode: number,
  referenceCode: any
): boolean => {
  if (typeof referenceCode === "number") {
    if (incomingCode === referenceCode) {
      return true;
    }
  } else if (typeof referenceCode === "string") {
    const codeRange = referenceCode.split("-");
    if (codeRange.length > 1 && codeRange.length < 3) {
      if (codeRange[0].includes(",") || codeRange[1].includes(",")) {
        // just in case they've included comma separated numbers, reject early
        // these will be parse to ints largely without issue since we're using
        // 3 digit codes that and might cause some confusing behavior if allowed

        // for example: "200-299,302" would put the range between 200 and 299302
        // rather than having 302 as a separate code
        return false;
      }
      const a: number = parseInt(codeRange[0], 10);
      const b: number = parseInt(codeRange[1], 10);
      if (isNaN(a) || isNaN(b)) {
        // invalid number, exit early
        return false;
      }
      if (a <= incomingCode && incomingCode <= b) {
        return true;
      }
    } else {
      if (incomingCode.toString() === referenceCode) {
        // do a straight text comparison
        return true;
      }
    }
  }
  return false;
};

export const combineHeaders = (
  localHeaders: Headers | string[][] | Record<string, string> | undefined,
  globalHeaders: Headers | string[][] | Record<string, string> | undefined
): Headers => {
  // headers on the send args override those of the same key on the instance
  const newHeaders: Headers = new Headers();
  if (globalHeaders) {
    // force conversion to Headers
    const gh: Headers = new Headers(globalHeaders);
    for (const pair of gh.entries()) {
      newHeaders.append(pair[0], pair[1]);
    }
  }
  if (localHeaders) {
    const lh: Headers = new Headers(localHeaders);
    for (const pair of lh.entries()) {
      newHeaders.append(pair[0], pair[1]);
    }
  }
  return newHeaders;
};

export const determineRetryAction = (
  statusCode: number,
  sentArgs: SendArgs,
  globalRetryActions: Array<RetryAction> | undefined
): [RetryAction | undefined, number] => {
  // A retry action on the send args should override the flechetteInstance's version
  var action: RetryAction | undefined;
  var i: number = -1;
  // first check if there's an existing action in the instance
  if (Array.isArray(globalRetryActions) && globalRetryActions.length > 0) {
    i = globalRetryActions.findIndex(ra => ra.code === statusCode);
    if (i > -1) {
      // okay, we have a retryAction matching this code.
      // now make sure it's not a path we want to ignore
      if (ignoreRetryPath(sentArgs.path, globalRetryActions[i])) {
        i = -1; // make it seem like there is no match
      } else {
        action = globalRetryActions[i];
      }
    }
  }
  // next check if there's an override
  if (
    Array.isArray(sentArgs.retryActions) &&
    sentArgs.retryActions.length > 0
  ) {
    const newActionIndex = sentArgs.retryActions.findIndex(
      ra => ra.code === statusCode
    );
    if (newActionIndex > -1) {
      if (
        !ignoreRetryPath(sentArgs.path, sentArgs.retryActions[newActionIndex])
      ) {
        // make sure it's not a path we want to ignore
        // this would be a weird use-case but honor
        // the same rules for local as global
        action = sentArgs.retryActions[newActionIndex];
        // in case of overridden retryAction, the intention is for this to be a one
        // time use, so we do not want to interfere with the default retry code in
        // case it happens again.
        i = -1;
        // now remove it from our local list
        sentArgs.retryActions.splice(newActionIndex, 1);
      }
    }
  }
  return [action, i];
};

export const ignoreRetryPath = (
  path: string,
  retryAction: RetryAction
): boolean => {
  const retVal: boolean = false;
  if (Array.isArray(retryAction.pathsToIgnore)) {
    if ((retryAction.pathsToIgnore as Array<string>).includes(path)) {
      return true;
    }
  }
  return retVal;
};
