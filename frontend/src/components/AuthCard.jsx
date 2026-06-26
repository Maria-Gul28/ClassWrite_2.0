export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card-doodle w-full max-w-sm px-10 py-10"
           style={{ border: '2px solid #b8d9ee', boxShadow: '4px 5px 0 rgba(46,157,209,0.2)' }}>
        <h2 className="font-hand text-5xl text-ink-900 mb-2">{title}</h2>
        {subtitle && <p className="font-hand text-xl text-sky-500 mb-8">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}