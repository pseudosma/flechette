import {
  addToStorage,
  createNewStorage,
  retrieveFromStorage
} from "storage-deck";

import { flechetteFetch } from "./senders";

const reservedKeyName = "flechette";
const reservedStorageName = "appConfig";
const defaultTimeout = 30000;
const defaultTimeoutRetryCount = 2;
const defaultSuccessCodes: Array<any> = ["200-299"];
const defaultRetryActions: Array<RetryAction> = [
  {
    action: (
      response: EvaluatedResponse,
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
      response: EvaluatedResponse,
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
      response: EvaluatedResponse,
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

export interface NetResponse {
  statusCode: number;
  response: string;
}

export interface EvaluatedResponse {
  success: boolean;
  statusCode: number;
  response: any;
}

export interface SendArgs extends RequestInit {
  path: string;
  instanceName?: string;
}

export type ResponseFunc = (response: EvaluatedResponse) => void;

export type ToggleFunc = (isWaiting: boolean) => void;

export type RetryFunc = (
  response: EvaluatedResponse,
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
  public headers: Headers | null = null; // empty headers by default
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
  addToStorage(f.instanceName, f, reservedStorageName);
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
