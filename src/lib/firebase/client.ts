'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import firebaseConfig from '../../../firebase-applet-config.json'
import { ClosedPaperTrade, INITIAL_PAPER_CAPITAL_INR, PaperPosition } from '@/lib/goldprism/trade-engine'

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  _path: string | null
): never {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'unknown'
  console.error('Firestore operation failed', { operationType, code })
  throw error instanceof Error ? error : new Error(`Firestore operation failed (${code})`)
}

let connectionTested = false

export async function testConnection() {
  if (typeof window === 'undefined' || connectionTested) return
  connectionTested = true
  try {
    await getDocFromServer(doc(db, 'test', 'connection'))
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.')
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection()
}

function sanitizeId(raw: string, maxLen = 64): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen)
  return cleaned.length > 0 ? cleaned : `ID-${Date.now()}`
}

export async function ensureUserWorkspace(params: {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  initialCashInr?: number
}): Promise<number> {
  const uid = sanitizeId(params.uid, 128)
  const userPath = `users/${uid}`
  const privatePath = `users/${uid}/private/info`
  const displayName = (params.displayName || params.email?.split('@')[0] || 'MCX Trader').slice(0, 120)

  let resolvedCash = params.initialCashInr ?? INITIAL_PAPER_CAPITAL_INR

  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) {
      await setDoc(doc(db, 'users', uid), {
        uid,
        displayName,
        cashInr: resolvedCash,
        defaultExposureG: 50,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      const data = snap.data()
      if (typeof data?.cashInr === 'number') {
        resolvedCash = data.cashInr
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath)
  }

  // PII isolated under /users/{uid}/private/info
  try {
    const privSnap = await getDoc(doc(db, 'users', uid, 'private', 'info'))
    const piiPayload: Record<string, unknown> = {
      uid,
      email: (params.email || '').slice(0, 180),
      updatedAt: serverTimestamp(),
    }
    if (params.photoURL) {
      piiPayload.photoURL = params.photoURL.slice(0, 512)
    }
    if (!privSnap.exists()) {
      await setDoc(doc(db, 'users', uid, 'private', 'info'), piiPayload)
    } else {
      await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
        email: piiPayload.email,
        ...(piiPayload.photoURL ? { photoURL: piiPayload.photoURL } : {}),
        updatedAt: serverTimestamp(),
      })
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath)
  }

  return resolvedCash
}

export async function persistOpenTradeToCloud(
  uid: string,
  pos: PaperPosition,
  newCashInr: number
): Promise<void> {
  const safeUid = sanitizeId(uid, 128)
  const tradeId = sanitizeId(pos.id, 64)
  const path = `users/${safeUid}/trades/${tradeId}`

  const payload: Record<string, unknown> = {
    id: tradeId,
    ownerId: safeUid,
    status: 'OPEN',
    kind: pos.kind,
    side: pos.side,
    headline: pos.headline.slice(0, 160),
    verdictAtEntry: pos.verdictAtEntry,
    disciplineOverridden: pos.disciplineOverridden,
    contractA: pos.contractA,
    entryPriceA: pos.entryPriceA,
    lotsA: pos.lotsA,
    gramsA: pos.gramsA,
    expiryA: pos.expiryA.slice(0, 24),
    marginBlockedInr: pos.marginBlockedInr,
    entryFeeInr: pos.entryFeeInr,
    sourceLabel: pos.sourceLabel.slice(0, 120),
    asOfPrice: pos.asOfPrice.slice(0, 48),
    rationale: pos.rationale.slice(0, 600),
    openedAt: pos.openedAt.slice(0, 48),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  if (pos.kind === 'SPREAD' && pos.contractB && pos.entryPriceB && pos.lotsB && pos.gramsB) {
    payload.contractB = pos.contractB
    payload.entryPriceB = pos.entryPriceB
    payload.lotsB = pos.lotsB
    payload.gramsB = pos.gramsB
    if (pos.expiryB) payload.expiryB = pos.expiryB.slice(0, 24)
  }

  try {
    const batch = writeBatch(db)
    batch.set(doc(db, 'users', safeUid, 'trades', tradeId), payload)
    batch.update(doc(db, 'users', safeUid), {
      cashInr: Number(newCashInr.toFixed(2)),
      updatedAt: serverTimestamp(),
    })
    await batch.commit()
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path)
  }
}

export async function persistCloseTradeToCloud(
  uid: string,
  closed: ClosedPaperTrade,
  newCashInr: number
): Promise<void> {
  const safeUid = sanitizeId(uid, 128)
  const tradeId = sanitizeId(closed.id, 64)
  const path = `users/${safeUid}/trades/${tradeId}`

  const updatePayload: Record<string, unknown> = {
    status: 'CLOSED',
    exitPriceA: closed.exitPriceA,
    exitFeeInr: closed.exitFeeInr,
    grossPnlInr: closed.grossPnlInr,
    netPnlInr: closed.netPnlInr,
    returnOnMarginPct: closed.returnOnMarginPct,
    closedAt: closed.closedAt.slice(0, 48),
    updatedAt: serverTimestamp(),
  }
  if (typeof closed.exitPriceB === 'number') {
    updatePayload.exitPriceB = closed.exitPriceB
  }

  try {
    const batch = writeBatch(db)
    batch.update(doc(db, 'users', safeUid, 'trades', tradeId), updatePayload)
    batch.update(doc(db, 'users', safeUid), {
      cashInr: Number(newCashInr.toFixed(2)),
      updatedAt: serverTimestamp(),
    })
    await batch.commit()
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path)
  }
}

export async function resetCloudWorkspaceTrades(uid: string): Promise<void> {
  const safeUid = sanitizeId(uid, 128)
  const path = `users/${safeUid}/trades`
  try {
    const q = query(collection(db, 'users', safeUid, 'trades'), where('ownerId', '==', safeUid))
    const snap = await getDocs(q)
    const deletes = snap.docs.map((d) => deleteDoc(d.ref))
    await Promise.all(deletes)
    await updateDoc(doc(db, 'users', safeUid), {
      cashInr: INITIAL_PAPER_CAPITAL_INR,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path)
  }
}

export async function saveCopilotLogToCloud(
  uid: string,
  prompt: string,
  reply: string
): Promise<void> {
  const safeUid = sanitizeId(uid, 128)
  const logId = sanitizeId(`LOG-${Date.now().toString(36)}`, 64)
  const path = `users/${safeUid}/copilotLogs/${logId}`
  try {
    await setDoc(doc(db, 'users', safeUid, 'copilotLogs', logId), {
      id: logId,
      ownerId: safeUid,
      prompt: prompt.slice(0, 600),
      reply: reply.slice(0, 2400),
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path)
  }
}

export async function fetchRecentCopilotLogs(
  uid: string
): Promise<Array<{ id: string; prompt: string; reply: string }>> {
  const safeUid = sanitizeId(uid, 128)
  const path = `users/${safeUid}/copilotLogs`
  try {
    const q = query(
      collection(db, 'users', safeUid, 'copilotLogs'),
      where('ownerId', '==', safeUid),
      orderBy('createdAt', 'desc'),
      limit(10)
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        prompt: String(data.prompt ?? ''),
        reply: String(data.reply ?? ''),
      }
    })
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path)
  }
}
