import { Buffer } from "buffer";

const scope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!scope.Buffer) scope.Buffer = Buffer;
