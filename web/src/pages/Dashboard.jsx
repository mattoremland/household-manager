import PageHeader from '../components/PageHeader'

export default function Dashboard() {
  return (
    <div className="page">
      <PageHeader title="Dashboard" />
      <p style={{ color: 'var(--text-muted)' }}>Summary view coming in Stage M11.</p>
    </div>
  )
}
