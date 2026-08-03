/** Modelo Mongo in-memory com o subconjunto de queries usado por NfseEmissionRepository. */
export class InMemoryNfseModel {
  private store = new Map<string, any>();
  private seq = 0;

  private static getPath(doc: any, path: string): any {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), doc);
  }

  private static matches(doc: any, filter: Record<string, any>): boolean {
    for (const [key, cond] of Object.entries(filter)) {
      if (key === '$and') {
        if (!(cond as any[]).every((sub) => InMemoryNfseModel.matches(doc, sub))) return false;
        continue;
      }
      if (key === '$or') {
        if (!(cond as any[]).some((sub) => InMemoryNfseModel.matches(doc, sub))) return false;
        continue;
      }
      const actual = InMemoryNfseModel.getPath(doc, key);
      if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
        if ('$lte' in cond && !(actual != null && actual <= (cond as any).$lte)) return false;
        if ('$gte' in cond && !(actual != null && actual >= (cond as any).$gte)) return false;
        if ('$exists' in cond && (actual !== undefined) !== Boolean((cond as any).$exists)) {
          return false;
        }
        if ('$in' in cond && !((cond as any).$in as any[]).includes(actual)) return false;
        continue;
      }
      if (actual !== cond) return false;
    }
    return true;
  }

  private findDocs(filter: Record<string, any>): any[] {
    return Array.from(this.store.values()).filter((doc) => InMemoryNfseModel.matches(doc, filter));
  }

  create(doc: any): any {
    this.seq += 1;
    const now = new Date();
    const stored = {
      ...doc,
      _id: `cafebabe000000000000${String(this.seq).padStart(4, '0')}`,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(stored._id, stored);
    return stored;
  }

  findById(id: string): any {
    return { exec: async () => this.store.get(id) ?? null };
  }

  findOne(filter: Record<string, any>): any {
    const docs = this.findDocs(filter);
    return {
      sort: () => ({ exec: async () => docs[0] ?? null }),
      exec: async () => docs[0] ?? null,
    };
  }

  find(filter: Record<string, any>): any {
    const docs = this.findDocs(filter);
    return {
      sort: (spec: Record<string, 1 | -1>) => {
        const entries = Object.entries(spec);
        const sorted = [...docs].sort((a, b) => {
          for (const [key, direction] of entries) {
            const va = InMemoryNfseModel.getPath(a, key);
            const vb = InMemoryNfseModel.getPath(b, key);
            if (va === vb) continue;
            const cmp = (va ?? 0) > (vb ?? 0) ? 1 : -1;
            return cmp * (direction === -1 ? -1 : 1);
          }
          return 0;
        });
        return {
          skip: (n: number) => ({
            limit: (l: number) => ({ exec: async () => sorted.slice(n, n + l) }),
            exec: async () => sorted.slice(n),
          }),
          limit: (l: number) => ({ exec: async () => sorted.slice(0, l) }),
          exec: async () => sorted,
        };
      },
      skip: (n: number) => ({
        limit: (l: number) => ({ exec: async () => docs.slice(n, n + l) }),
        exec: async () => docs.slice(n),
      }),
      limit: (l: number) => ({ exec: async () => docs.slice(0, l) }),
      exec: async () => docs,
    };
  }

  updateMany(filter: Record<string, any>, update: Record<string, any>): any {
    const docs = this.findDocs(filter);
    const patch = this.applyUpdate(update);
    for (const doc of docs) {
      this.store.set(doc._id, { ...doc, ...patch, updatedAt: new Date() });
    }
    return { matchedCount: docs.length, modifiedCount: docs.length };
  }

  updateOne(filter: Record<string, any>, update: Record<string, any>): any {
    const docs = this.findDocs(filter);
    if (!docs.length) return { matchedCount: 0, modifiedCount: 0 };
    const patch = this.applyUpdate(update);
    const doc = docs[0];
    this.store.set(doc._id, { ...doc, ...patch, updatedAt: new Date() });
    return { matchedCount: 1, modifiedCount: 1 };
  }

  countDocuments(filter: Record<string, any>): any {
    return { exec: async () => this.findDocs(filter).length };
  }

  private applyUpdate(update: Record<string, any>): Record<string, any> {
    const set = update?.$set;
    if (set && typeof set === 'object' && !Array.isArray(set)) return set;
    return update;
  }
}
