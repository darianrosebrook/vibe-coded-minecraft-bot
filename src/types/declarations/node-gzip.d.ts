declare module 'node-gzip' {
  export function gzip(input: string | Buffer): Promise<Buffer>;
  export function ungzip(input: Buffer): Promise<Buffer>;
} 