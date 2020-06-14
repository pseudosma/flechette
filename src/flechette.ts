import {
  addToStorage,
  createNewStorage,
  retrieveFromStorage
} from "storage-deck";

import { send } from "./senders";

export const reservedKeyName = "flechette";
const reservedStorageName = "appConfig";
const defaultTimeout = 30000;
const defaultTimeoutRetryCount = 2;
const defaultSuccessCodes: Array<any> = ["200-399"];
const defaultRetryActions: Array<RetryAction> = [
  {
    action: (
      response: FlechetteResponse,
      successFunc: ResponseFunc,
      failureFunc: ResponseFunc
    ) => {
      send(response.sent, successFunc, failureFunc);
    },
    code: 408
  },
  {
    action: (
      response: FlechetteResponse,
      successFunc: ResponseFunc,
      failureFunc: ResponseFunc
    ) => {
      send(response.sent, successFunc, failureFunc);
    },
    code: 429
  },
  {
    action: (
      response: FlechetteResponse,
      successFunc: ResponseFunc,
      failureFunc: ResponseFunc
    ) => {
      send(response.sent, successFunc, failureFunc);
    },
    code: 504
  }
];

export interface NetResponse {
  statusCode: number;
  response: string;
  sent: SendArgs;
}

export interface FlechetteResponse {
  success: boolean;
  statusCode: number;
  response: any;
  sent: SendArgs;
}

export interface SendArgs extends RequestInit {
  path: string;
  instanceName?: string;
  retryActions?: Array<RetryAction>; // single use retry action
}

export type ResponseFunc = (
  response: FlechetteResponse | Array<FlechetteResponse>
) => void;

export type ToggleFunc = (isWaiting: boolean) => void;

export type RetryFunc = (
  response: FlechetteResponse,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc
) => void;

export interface RetryAction {
  code: number;
  action: RetryFunc;
  pathsToIgnore?: Array<string>;
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
  public headers: Headers | string[][] | Record<string, string> | undefined;
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

export const configureFlechette = (i?: Flechette): FlechetteController => {
  const f = new FlechetteController(i ? i : {});
  createNewStorage(reservedStorageName);
  addToStorage({ key: f.instanceName, value: f }, reservedStorageName);
  return f;
};

export const getFlechetteInstance = (
  instanceName?: string
): FlechetteController => {
  const i = instanceName ? instanceName : reservedKeyName;
  try {
    const s = retrieveFromStorage(i, reservedStorageName);
    if (s) {
      return s;
    } else {
      throw "failed to find flechette instance";
    }
  } catch {
    console.warn(
      "No active flechette instance found. Creating a new instance named " + i
    );
    return configureFlechette({ instanceName: i });
  }
};
