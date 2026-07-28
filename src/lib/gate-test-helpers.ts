/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
export function coercePayload(input: any): any {
  return input?.data ?? input;
}
