import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/shops/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/shops/"!</div>
}
