import {useEffect,useSyncExternalStore} from 'react'
import type {ProjectPortfolio} from './project-portfolio-controller'
export function useProjectPortfolio(portfolio:ProjectPortfolio){const snapshot=useSyncExternalStore(portfolio.subscribe,portfolio.getSnapshot,portfolio.getSnapshot);useEffect(()=>{void portfolio.initialize()},[portfolio]);return snapshot}
