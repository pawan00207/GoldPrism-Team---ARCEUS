import firebaseConfig from '../../../firebase-applet-config.json'

export function FirebaseAuthNotice({ message }: { message: string }) {
  const unauthorizedDomain = message.includes('Authorized domains')
  const settingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`

  return (
    <div
      role="alert"
      className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-destructive"
    >
      <span>{message}</span>
      {unauthorizedDomain ? (
        <a
          href={settingsUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-2"
        >
          Open Firebase Auth settings
        </a>
      ) : null}
    </div>
  )
}
