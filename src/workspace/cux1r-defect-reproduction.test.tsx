// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {afterEach,describe,expect,it} from 'vitest'
import App from '../App'

afterEach(()=>{window.history.replaceState(null,'','/');cleanup()})

describe('CUX1R journey correction',()=>{
 it('keeps safeguards visible in the document and presents one ordered primary journey',()=>{render(<App/>);expect(screen.getByText('Real catalogue evidence')).toBeVisible();expect(screen.getByText('Human-approved changes')).toBeVisible();expect(screen.getByText('No automatic purchasing')).toBeVisible();const ids=['stage-define','stage-discover','stage-compare','stage-plan','stage-review'];const elements=ids.map(id=>document.getElementById(id));expect(elements.every(Boolean)).toBe(true);expect(new Set(elements).size).toBe(ids.length);for(let index=1;index<elements.length;index++)expect(elements[index-1]!.compareDocumentPosition(elements[index]!)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();const advanced=screen.getByText('Advanced workspace').closest('details')!;expect(advanced).not.toHaveAttribute('open')})
 it('reveals an exact advanced target when a monitoring route changes the hash',async()=>{render(<App/>);const advanced=screen.getByText('Advanced workspace').closest('details')!;expect(advanced.open).toBe(false);window.location.hash='#evidence-resolution';fireEvent(window,new HashChangeEvent('hashchange'));await waitFor(()=>expect(advanced.open).toBe(true));expect(document.getElementById('evidence-resolution')).toBeInTheDocument()})
})
