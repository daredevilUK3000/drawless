// Small, quiet footer that cross-links Patrick's other apps.
export default function Footer() {
  const link = { color: '#3346D3', textDecoration: 'none', fontWeight: 600 };
  return (
    <footer style={{ marginTop: 28, paddingTop: 14, borderTop: '1px dashed #DEE4DD', fontSize: 12.5, color: '#5A6772', textAlign: 'center' }}>
      <div>A daily one-line physics puzzle.</div>
      <div style={{ marginTop: 6 }}>
        More from the same maker:{' '}
        <a href="https://attentionforest.app/" target="_blank" rel="noopener noreferrer" style={link}>Attention Forest</a>
        {'  ·  '}
        <a href="https://humanradio.app/" target="_blank" rel="noopener noreferrer" style={link}>The Human Radio</a>
      </div>
    </footer>
  );
}
