import React, { useState } from 'react';
import logoSvg from './assets/logo.svg';

const styles = {
  body: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: '#0a0a12',
    color: 'hsla(0,0%,100%,.95)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: 0,
  },
  header: {
    width: '100%',
    padding: '1rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    borderBottom: '1px solid hsla(0,0%,100%,.06)',
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #fff, #00d4ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  container: {
    background: 'hsla(0,0%,100%,.03)',
    backdropFilter: 'blur(20px)',
    border: '1px solid hsla(0,0%,100%,.08)',
    padding: '3rem',
    borderRadius: '1.5rem',
    textAlign: 'center',
    maxWidth: '500px',
    width: '100%',
  },
  h1: {
    fontSize: '1.8rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #fff, #00d4ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '1rem',
  },
  p: {
    color: 'hsla(0,0%,100%,.5)',
    marginBottom: '2rem',
    lineHeight: 1.6,
  },
  btn: {
    display: 'inline-block',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #0066ff, #00d4ff)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  result: {
    marginTop: '2rem',
    textAlign: 'left',
    background: '#0e0e1a',
    border: '1px solid hsla(0,0%,100%,.06)',
    color: 'hsla(0,0%,100%,.7)',
    padding: '1rem',
    borderRadius: '10px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.82rem',
    whiteSpace: 'pre-wrap',
  },
  links: { marginTop: '2rem' },
  link: { color: '#00d4ff', margin: '0 10px', textDecoration: 'none', fontSize: '0.9rem' },
};

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function testAPI() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hello', data: { test: true } }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text) throw new Error('Empty response');
      const data = JSON.parse(text);
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(
        'API not available yet.\n\nDeploy your API function first using the\n"Deploy Locally" button in the OpenKBS UI,\nor run: openkbs fn deploy api'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.body}>
      <header style={styles.header}>
        <img src={logoSvg} alt="OpenKBS" style={styles.headerLogo} />
        <span style={styles.headerTitle}>OpenKBS</span>
      </header>
      <div style={styles.main}>
        <div style={styles.container}>
          <h1 style={styles.h1}>OpenKBS Project</h1>
          <p style={styles.p}>
            Your OpenKBS platform is ready. Deploy agents, functions, and build
            your AI-powered application.
          </p>
          <button style={styles.btn} onClick={testAPI} disabled={loading}>
            {loading ? 'Loading...' : 'Test API'}
          </button>
          <div style={styles.links}>
            <a style={styles.link} href="https://openkbs.com/docs" target="_blank" rel="noopener noreferrer">Documentation</a>
            <a style={styles.link} href="https://github.com/open-kbs/openkbs" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          {result && <pre style={styles.result}>{result}</pre>}
        </div>
      </div>
    </div>
  );
}
