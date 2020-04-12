import {
  configureFlechette,
  Flechette,
  FlechetteController,
  FlechetteResponse,
  getFlechetteInstance,
  ResponseFunc,
  RetryAction,
  RetryFunc,
  SendArgs,
  ToggleFunc
} from "./flechette";

import { flechetteFetch } from "./senders";

import { clearFlechetteInstanceCache } from "./utils";

export {
  clearFlechetteInstanceCache,
  configureFlechette,
  Flechette,
  FlechetteController,
  flechetteFetch,
  FlechetteResponse,
  getFlechetteInstance,
  ResponseFunc,
  RetryAction,
  RetryFunc,
  SendArgs,
  ToggleFunc
};
