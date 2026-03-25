declare module 'wa-sqlite/dist/wa-sqlite-async.mjs' {
  export default function SQLiteESMFactory(): Promise<any>;
}

declare module 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js' {
  export class IDBBatchAtomicVFS {
    constructor(name: string);
  }
}
