export default function HomePage() {
  return (
    <main className="home-shell">
      <iframe
        className="site-frame"
        src="https://automatic-workflows2.vercel.app/"
        title="Automatic Workflows"
        allow="fullscreen"
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <noscript>
        <p className="fallback">
          JavaScript is required to view Automatic Workflows.{' '}
          <a href="https://automatic-workflows2.vercel.app/">Open the site directly</a>.
        </p>
      </noscript>
    </main>
  )
}

