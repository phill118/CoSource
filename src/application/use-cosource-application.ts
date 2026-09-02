import { useSyncExternalStore } from 'react'
import type { CoSourceApplication } from './cosource-application'

export function useCoSourceApplication(application:CoSourceApplication){
  return useSyncExternalStore(application.subscribe,application.getSnapshot,application.getSnapshot)
}
