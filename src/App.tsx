import { useState } from 'react'
import InkEntry from './InkEntry'

export default function App() {
  const [impactComplete, setImpactComplete] = useState(false)

  return (
    <>
      <InkEntry onComplete={() => setImpactComplete(true)} />
      {/* future content mounts here once impactComplete === true */}
      {impactComplete && null}
    </>
  )
}
