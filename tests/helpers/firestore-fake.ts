// Fake in-memory de Firestore para testear services/firebase/*.ts sin emulador ni red.
// Cubre solo las operaciones que los servicios realmente usan (doc/collection/get/set/
// update/delete/query+where/writeBatch/increment/serverTimestamp/Timestamp). No es un
// mock de `firebase/firestore` completo — si un servicio nuevo usa algo no cubierto acá,
// sumarlo puntualmente en vez de traer un emulador para todo el proyecto.

type DocData = Record<string, unknown>;

class FakeIncrement {
  constructor(public readonly delta: number) {}
}

class FakeTimestamp {
  constructor(public readonly date: Date) {}
  static fromDate(d: Date) { return new FakeTimestamp(d); }
  toDate() { return this.date; }
}

const SERVER_TIMESTAMP = { __serverTimestamp: true };

export class FakeFirestore {
  private data = new Map<string, DocData>();

  private applyValue(current: unknown, incoming: unknown): unknown {
    if (incoming instanceof FakeIncrement) return (typeof current === "number" ? current : 0) + incoming.delta;
    if (incoming === SERVER_TIMESTAMP) return new FakeTimestamp(new Date());
    return incoming;
  }

  private applyPatch(existing: DocData, patch: DocData): DocData {
    const result: DocData = { ...existing };
    for (const [key, value] of Object.entries(patch)) {
      // Soporta paths con punto ("meta.tipoCambioRef") como los usa updateDoc real.
      if (key.includes(".")) {
        const [head, ...rest] = key.split(".");
        const nested = (result[head] as DocData) ?? {};
        result[head] = this.applyPatch(nested, { [rest.join(".")]: value });
      } else {
        result[key] = this.applyValue(existing[key], value);
      }
    }
    return result;
  }

  getDoc(path: string): DocData | undefined {
    const v = this.data.get(path);
    return v ? { ...v } : undefined;
  }

  setDoc(path: string, value: DocData, opts?: { merge?: boolean }): void {
    const existing = this.data.get(path);
    if (opts?.merge && existing) this.data.set(path, this.applyPatch(existing, value));
    else this.data.set(path, this.applyPatch({}, value));
  }

  updateDoc(path: string, patch: DocData): void {
    const existing = this.data.get(path);
    if (!existing) throw new Error(`updateDoc: no existe el doc ${path}`);
    this.data.set(path, this.applyPatch(existing, patch));
  }

  deleteDoc(path: string): void {
    this.data.delete(path);
  }

  addDoc(collectionPath: string, value: DocData): string {
    const id = this.newId();
    this.data.set(`${collectionPath}/${id}`, this.applyPatch({}, value));
    return id;
  }

  /** Docs bajo `collectionPath/`, un solo nivel (no subcolecciones anidadas). */
  getCollection(collectionPath: string): { id: string; data: DocData }[] {
    const prefix = `${collectionPath}/`;
    const out: { id: string; data: DocData }[] = [];
    for (const [path, value] of this.data.entries()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.includes("/")) continue; // no es hijo directo
      out.push({ id: rest, data: { ...value } });
    }
    return out;
  }

  newId(): string {
    return `fake_${Math.random().toString(36).slice(2, 12)}`;
  }
}

// Instancia activa: cada test la resetea en beforeEach. Los mocks de los módulos
// `firebase/firestore` y `./firebase` (vía vi.mock, con rutas relativas al archivo que
// mockea) apuntan siempre a `getActiveFake()`, así los servicios bajo test —que importan
// `db` en el momento del import, no en cada llamada— siguen viendo la instancia vigente.
let active = new FakeFirestore();
export function getActiveFake(): FakeFirestore { return active; }
export function resetActiveFake(): FakeFirestore { active = new FakeFirestore(); return active; }

// ── API que imita la superficie usada de "firebase/firestore" ──

interface FakeDocRef { __path: string; id: string; }
interface FakeCollectionRef { __path: string; }
interface FakeWhereClause { field: string; op: string; value: unknown; }
interface FakeQuery { __collectionPath: string; __wheres: FakeWhereClause[]; }

export function doc(_db: unknown, path: string, ...segments: string[]): FakeDocRef {
  const full = segments.length ? `${path}/${segments.join("/")}` : path;
  const parts = full.split("/");
  return { __path: full, id: parts[parts.length - 1] };
}

export function collection(_db: unknown, path: string): FakeCollectionRef {
  return { __path: path };
}

export async function getDoc(ref: FakeDocRef) {
  const data = getActiveFake().getDoc(ref.__path);
  return {
    exists: () => data !== undefined,
    data: () => data,
    id: ref.id,
  };
}

export async function getDocs(refOrQuery: FakeCollectionRef | FakeQuery) {
  const collectionPath = "__collectionPath" in refOrQuery ? refOrQuery.__collectionPath : refOrQuery.__path;
  const wheres = "__wheres" in refOrQuery ? refOrQuery.__wheres : [];
  let docs = getActiveFake().getCollection(collectionPath);
  for (const w of wheres) {
    docs = docs.filter((d) => {
      const v = d.data[w.field];
      if (w.op === "==") return v === w.value;
      throw new Error(`FakeFirestore: operador where no soportado: ${w.op}`);
    });
  }
  return {
    // `ref` imita QueryDocumentSnapshot.ref del SDK real (get ref() en lite-api/snapshot.ts) —
    // sin esto, código real que hace `batch.update(d.ref, ...)` (válido y usado en el propio
    // repo) rompe solo contra el fake, no contra Firestore de verdad.
    docs: docs.map(({ id, data }) => ({ id, data: () => data, ref: doc({}, `${collectionPath}/${id}`) })),
    empty: docs.length === 0,
  };
}

export function query(coll: FakeCollectionRef, ...clauses: FakeWhereClause[]): FakeQuery {
  return { __collectionPath: coll.__path, __wheres: clauses };
}

export function where(field: string, op: string, value: unknown): FakeWhereClause {
  return { field, op, value };
}

export async function setDoc(ref: FakeDocRef, value: DocData, opts?: { merge?: boolean }) {
  getActiveFake().setDoc(ref.__path, value, opts);
}

export async function updateDoc(ref: FakeDocRef, patch: DocData) {
  getActiveFake().updateDoc(ref.__path, patch);
}

export async function deleteDoc(ref: FakeDocRef) {
  getActiveFake().deleteDoc(ref.__path);
}

export async function addDoc(coll: FakeCollectionRef, value: DocData) {
  const id = getActiveFake().addDoc(coll.__path, value);
  return { id };
}

export function increment(delta: number) { return new FakeIncrement(delta); }
export function serverTimestamp() { return SERVER_TIMESTAMP; }
export const Timestamp = FakeTimestamp;

export function writeBatch(_db: unknown) {
  const ops: (() => void)[] = [];
  return {
    set(ref: FakeDocRef, value: DocData) { ops.push(() => getActiveFake().setDoc(ref.__path, value)); },
    update(ref: FakeDocRef, patch: DocData) { ops.push(() => getActiveFake().updateDoc(ref.__path, patch)); },
    delete(ref: FakeDocRef) { ops.push(() => getActiveFake().deleteDoc(ref.__path)); },
    async commit() { ops.forEach((op) => op()); },
  };
}
