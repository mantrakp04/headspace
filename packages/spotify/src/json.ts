export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { readonly [key: string]: JsonValue | undefined };
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;

export function decodeJson(text: string): JsonValue {
  // SAFETY: JSON.parse yields a JSON value or throws SyntaxError.
  return JSON.parse(text) as JsonValue;
}

export function tryDecodeJson(text: string): JsonValue {
  try {
    return decodeJson(text);
  } catch {
    return null;
  }
}

export async function decodeResponseJson(
  response: Response,
): Promise<JsonValue> {
  const text = await response.text();
  return text ? decodeJson(text) : null;
}

function typeTag(value: JsonValue | undefined): string {
  return Object.prototype.toString.call(value);
}

export function isJsonObject(
  value: JsonValue | undefined,
): value is JsonObject {
  return (
    value !== undefined && !Array.isArray(value) && Object(value) === value
  );
}

export function isJsonString(value: JsonValue | undefined): value is string {
  return typeTag(value) === '[object String]';
}

export function isFiniteNumber(value: JsonValue | undefined): value is number {
  return typeTag(value) === '[object Number]' && Number.isFinite(Number(value));
}

export function isJsonBoolean(value: JsonValue | undefined): value is boolean {
  return value === true || value === false;
}

export function object(value: JsonValue | undefined): JsonObject {
  return isJsonObject(value) ? value : {};
}

export function list(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

export function string(value: JsonValue | undefined): string {
  return isJsonString(value) ? value : '';
}
