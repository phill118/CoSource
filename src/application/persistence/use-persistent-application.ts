import {useEffect,useSyncExternalStore} from 'react'
import type {PersistentApplication} from './persistent-application'

export function usePersistence(controller:PersistentApplication){const lifecycle=useSyncExternalStore(controller.subscribePersistence,controller.getPersistenceSnapshot,controller.getPersistenceSnapshot);useEffect(()=>{void controller.initialize()},[controller]);return lifecycle}
