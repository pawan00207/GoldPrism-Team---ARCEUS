export function describeFirebaseAuthError(error: unknown): string {
  const firebaseError =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown; message?: unknown })
      : null
  const code = typeof firebaseError?.code === 'string' ? firebaseError.code : ''
  const message =
    typeof firebaseError?.message === 'string' ? firebaseError.message : null

  if (code === 'auth/unauthorized-domain') {
    const hostname = typeof window === 'undefined' ? 'this app domain' : window.location.hostname
    return `Firebase blocked sign-in from “${hostname}”. Add this exact domain in Firebase Console → Authentication → Settings → Authorized domains, then retry.`
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is disabled for this Firebase project. Enable the Google provider under Firebase Console → Authentication → Sign-in method.'
  }
  if (code === 'auth/popup-blocked') {
    return 'The browser blocked the Google sign-in popup. Allow popups for this site and retry.'
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was closed before it finished. Select “Sign in to sync” to try again.'
  }
  if (code === 'auth/network-request-failed') {
    return 'Could not reach Firebase Authentication. Check the network connection and retry.'
  }

  return message ?? 'Google sign-in failed. Retry or check the Firebase Authentication configuration.'
}

export function describeFirebaseSyncError(error: unknown): string {
  const firebaseError =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown; message?: unknown })
      : null
  const code = typeof firebaseError?.code === 'string' ? firebaseError.code : ''
  const message = typeof firebaseError?.message === 'string' ? firebaseError.message : ''

  if (code.startsWith('auth/')) return describeFirebaseAuthError(error)
  if (code === 'permission-denied' || message.includes('permission-denied')) {
    return 'Firestore denied cloud sync. Confirm the latest firestore.rules are deployed and sign in with a verified Google account.'
  }
  if (code === 'unauthenticated' || message.includes('unauthenticated')) {
    return 'Your Firebase session has expired. Sign in again to sync this paper-trading workspace.'
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') {
    return 'Firestore is unreachable. Check your connection; this browser will keep its local paper-trading data.'
  }
  if (code === 'failed-precondition') {
    return 'Firestore rejected this sync operation because a project prerequisite is missing. Check Firebase Console and the deployed security rules.'
  }

  return 'Firestore cloud sync failed. Local paper-trading data remains in this browser; retry after checking Firebase configuration.'
}
