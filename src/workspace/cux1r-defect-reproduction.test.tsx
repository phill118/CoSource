// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {afterEach,describe,expect,it} from 'vitest'
import App from '../App'

afterEach(()=>{cleanup();window.history.replaceState(null,'','/')})

describe('CUX1R journey correction',()=>{
 it('keeps safeguards visible while presenting only one active primary workspace',()=>{render(<App/>);expect(document.getElementById('stage-define')).toBeInTheDocument();expect(document.getElementById('stage-discover')).not.toBeInTheDocument();expect(document.getElementById('stage-compare')).not.toBeInTheDocument();expect(screen.getByText(/does not perform checkout or payment/i)).toBeVisible();fireEvent.click(screen.getByRole('link',{name:'Overview'}));expect(screen.getByText('CoSource turns a resource requirement into an evidence-backed, human-approved plan.')).toBeVisible();expect(screen.getAllByText(/Agents research and propose/i).length).toBeGreaterThan(0);expect(document.getElementById('stage-define')).not.toBeInTheDocument()})
 it('reveals an exact advanced target from its direct hash',async()=>{window.history.replaceState(null,'','/#evidence-resolution');render(<App/>);await waitFor(()=>expect(document.getElementById('evidence-resolution')).toBeInTheDocument());expect(screen.getByRole('heading',{name:'Decision intelligence'})).toBeInTheDocument();expect(document.getElementById('supplier-intelligence')).not.toBeInTheDocument()})
})
