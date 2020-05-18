import {
  addToStorage,
  createNewStorage,
  retrieveFromStorage,
} from "storage-deck";

import { flechetteFetch } from "./senders";

export const reservedKeyName = "flechette";
const reservedStorageName = "appConfig";
const defaultTimeout = 30000;
const defaultTimeoutRetryCount = 2;
const defaultSuccessCodes: Array<any> = ["200-299"];
const defaultRetryActions: Array<RetryAction> = [
  {
    action: (
      response: FlechetteResponse,
      sent: SendArgs,
      waitingFunc: ToggleFunc,
      successFunc: ResponseFunc,
      failureFunc: ResponseFunc
    ) => {
      flechetteFetch(sent, waitingFunc, successFunc, failureFunc);
    },
    code: 408
  },
  {
    action: (
      response: FlechetteResponse,
      sent: SendArgs,
      waitingFunc: ToggleFunc,
      successFunc: ResponseFunc,
      failureFunc: ResponseFunc
    ) => {
      flechetteFetch(sent, waitingFunc, successFunc, failureFunc);
    },
    code: 429
  },
  {
    action: (
      response: FlechetteResponse,
      sent: SendArgs,
      waitingFunc: ToggleFunc,
      successFunc: ResponseFunc,
      failureFunc: ResponseFunc
    ) => {
      flechetteFetch(sent, waitingFunc, successFunc, failureFunc);
    },
    code: 504
  }
];

export enum CachingType {
  Window = 0,
  Session = 1,
  Local = 2
}

export interface CachingScheme {
  type: CachingType;
  expiration: Date;
}

export interface NetResponse {
  statusCode: number;
  response: string;
}

export interface FlechetteResponse {
  success: boolean;
  statusCode: number;
  response: any;
  isCachedResponse: boolean;
}

export interface SendArgs extends RequestInit {
  path: string;
  instanceName?: string;
  cachingScheme?: CachingScheme;
  retryActions?: Array<RetryAction>; //single use retry acion
}

export type ResponseFunc = (response: FlechetteResponse) => void;

export type ToggleFunc = (isWaiting: boolean) => void;

export type RetryFunc = (
  response: FlechetteResponse,
  sent: SendArgs,
  waitingFunc: ToggleFunc,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc
) => void;

export interface RetryAction {
  code: number;
  action: RetryFunc;
}

export interface Flechette {
  successCodes?: Array<number | string>;
  retryActions?: Array<RetryAction>;
  timeout?: number;
  maxTimeoutRetryCount?: number;
  baseUrl?: string;
  headers?: Headers;
  instanceName?: string;
}

export class FlechetteController {
  public successCodes: Array<number | string> = defaultSuccessCodes;
  public retryActions: Array<RetryAction> = defaultRetryActions;
  public timeout: number = defaultTimeout;
  public maxTimeoutRetryCount: number = defaultTimeoutRetryCount;
  public baseUrl: string = "";
  public headers: Headers | string[][] | Record<string, string> | undefined
  public instanceName: string = reservedKeyName;
  public abortController = new AbortController();

  constructor(props: Flechette) {
    if (props.successCodes) {
      this.successCodes = props.successCodes;
    }
    if (props.retryActions) {
      this.retryActions = props.retryActions;
    }
    if (props.timeout) {
      this.timeout = props.timeout;
    }
    if (props.maxTimeoutRetryCount) {
      this.maxTimeoutRetryCount = props.maxTimeoutRetryCount;
    }
    if (props.baseUrl) {
      this.baseUrl = props.baseUrl;
    }
    if (props.headers) {
      this.headers = props.headers;
    }
    if (props.instanceName) {
      if (props.instanceName.includes("-")) {
        throw new Error("Dashes (-) cannot be used in flechette instance names");
      }
      this.instanceName = props.instanceName;
    }
  }

  public abortCurrentFetch() {
    this.abortController.abort();
  }
}

export const configureFlechette = (i: Flechette) => {
  const f = new FlechetteController(i);
  createNewStorage(reservedStorageName);
  addToStorage({ key: f.instanceName, value: f}, reservedStorageName);
};

export const getFlechetteInstance = (
  instanceName?: string
): FlechetteController => {
  const i = instanceName ? instanceName : reservedKeyName;
  try {
    return retrieveFromStorage(i, reservedStorageName);
  } catch {
    console.warn(
      "No active flechette instance found. Creating a new instance named " + i
    );
    configureFlechette({ instanceName: i });
    return retrieveFromStorage(i, reservedStorageName);
  }
};