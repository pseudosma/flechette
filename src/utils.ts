import {  
  CachingType,
  FlechetteResponse,
  reservedKeyName,
  RetryAction,
  SendArgs
} from "./flechette"

import {
  addToStorage,
  addToLocalStorage,
  addToSessionStorage,
  removeFromLocalStorage,
  removeFromSessionStorage,
  removeFromStorage,
  retrieveFromLocalStorage,
  retrieveFromSessionStorage,
  retrieveFromStorage,
  StorageKeyValuePair
} from "storage-deck";

const reservedCacheName = "appCache";

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

export const buildSearhRegEx = (name?: string, path?: string): RegExp => {
  const n: string = name ? name : reservedKeyName;
  const p: string = path ? path : ".*?";
  return new RegExp(n + "\-" + p + "\-[0-9]*"); // instanceName-path-expiration
}

export const clearFlechetteInstanceCache = (name?: string) => {
  const re = buildSearhRegEx(name);
  // now check all storage
  removeFromStorage(re, reservedCacheName);
  removeFromLocalStorage(re);
  removeFromSessionStorage(re);
};

export const cacheResponseData = (sendArgs: SendArgs, response: FlechetteResponse) => {
  if (sendArgs.cachingScheme) {
    const i =  sendArgs.instanceName ? sendArgs.instanceName : reservedKeyName;
    const k = i + "-" + sendArgs.path + "-" + Date.now();
    switch (sendArgs.cachingScheme.type) {
      case CachingType.Window: {
        addToStorage({key: k, value: response}, reservedCacheName);
        break;
      }
      case CachingType.Session: {
        addToSessionStorage({key: k, value: response});
        break;
      }
      case CachingType.Local: {
        addToLocalStorage({key: k, value: response});
        break;
      }
    }
  }
};

export const evaluateAndReturnCachedData = (getFunc: any, deleteFunc: any): any => {
  const r: StorageKeyValuePair[]|null  = getFunc();
  if (r !== null) {
    // a cached entry was found, now find out if it's expired
    const dt = Date.now();
    const a: string[] = r[0].key.split("-"); // should only be one, but this call returns an arrya
    const exp: string | undefined = a.pop(); 
    if (exp) {
      if (dt < parseInt(exp, 10)) {
        // not expired, return this value
        return r[0].value;
      } else {
        // it's expired so delete it and fall through to return null
        deleteFunc();
      }
    }
  }
  return null;
}

export const checkForCachedData = (sendArgs: SendArgs): FlechetteResponse|null => {
  if (sendArgs.cachingScheme) {
    const i =  sendArgs.instanceName ? sendArgs.instanceName : reservedKeyName;
    const s = buildSearhRegEx(i, sendArgs.path);
    switch (sendArgs.cachingScheme.type) {
      case CachingType.Window: {
        return evaluateAndReturnCachedData(
          () => { retrieveFromStorage(s, reservedCacheName); },
          () => { removeFromStorage(s, reservedCacheName); }
        );
      }
      case CachingType.Session: {
        // this should be json saved as a string
        const r = evaluateAndReturnCachedData(
          () => { retrieveFromSessionStorage(s); },
          () => { removeFromSessionStorage(s); }
        );
        if (r !== null) {
          return JSON.parse(r);
        }
        break;
      }
      case CachingType.Local: {
        const r = evaluateAndReturnCachedData(
          () => { retrieveFromLocalStorage(s); },
          () => { removeFromLocalStorage(s); }
        );
        if (r !== null) {
          return JSON.parse(r);
        }
        break;
      }
    }
  }
  return null;
};

export const combineHeaders = (
  localHeaders: Headers, 
  globalHeaders: Headers): Headers => {
  //headers on the send args override those of the same key on the instance
};

export const determineRetryAction = (
  statusCode: number,
  localRetryActions: Array<RetryAction>|undefined, 
  globalRetryActions: Array<RetryAction>|undefined): [RetryAction|undefined, number] => { 
    // A retry action on the send args should override the flechetteInstance's version
    var action: RetryAction|undefined = undefined;
    var i: number = -1;
    // first check if there's an existing action in the instance
    if (
      Array.isArray(globalRetryActions) &&
      globalRetryActions.length > 0
    ) {
      i = globalRetryActions.findIndex(
        ra => ra.code === statusCode
      );
      if (i > -1) {
        action = Object.assign({},globalRetryActions[i]);
        // shallow clone it since it will be spliced out later to avoid an infinite loop
      }
    }
    // next check if there's an override
    if (
      Array.isArray(localRetryActions) &&
      localRetryActions.length > 0
    ) {
      const newAction = localRetryActions.find(
        ra => ra.code === statusCode
      );
      if (newAction) {
        action = newAction;
        // in case of overridden retryAction, the intention is for this to be a one
        // time use, so we do not want to interfere with the default retry code in
        // case it happens again.
        // Make it look like there is not one in the list by .
        i = -1;
      }
    }
    return [action,i];
};



