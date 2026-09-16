import { useEffect, useRef } from 'react'
import { YardController } from './yardController.ts'

/** 宠物小院面板：容器 + 控制器接线（薄壳，V7——领域与舞台都在 controller/engine 里）。 */
export function PetYardView(_props: unknown): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (containerRef.current === null) return
    const controller = new YardController(containerRef.current)
    controller.start()
    return () => controller.dispose()
  }, [])
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 360, position: 'relative', overflow: 'hidden' }}
    />
  )
}
