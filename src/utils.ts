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
