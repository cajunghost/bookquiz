import React from 'react'

// Catches render-time errors so a runtime exception shows a readable message
// instead of a blank page. Surfaces the actual error text to aid debugging.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('BookQuiz error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 640, margin: '3rem auto', padding: '1.5rem', fontFamily: 'sans-serif' }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <p>The app hit an unexpected error. Details:</p>
          <pre
            style={{
              background: '#fbe9e9',
              color: '#b42318',
              padding: '1rem',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
