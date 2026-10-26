import { useState, type FC } from 'react';
import {
  activeFirebaseConfig,
  isFirebaseConfigured,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig
} from './firebaseConfig';

interface FirebaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: 'synced' | 'connecting' | 'local_only';
}

export const FirebaseSettingsModal: FC<FirebaseSettingsModalProps> = ({
  isOpen,
  onClose,
  syncStatus
}) => {
  const [apiKey, setApiKey] = useState(
    activeFirebaseConfig.apiKey === 'AIzaSyDemoPlaceholderAPIKey' ? '' : activeFirebaseConfig.apiKey
  );
  const [projectId, setProjectId] = useState(
    activeFirebaseConfig.projectId === 'bus-app-demo' ? '' : activeFirebaseConfig.projectId
  );
  const [authDomain, setAuthDomain] = useState(
    activeFirebaseConfig.authDomain === 'bus-app-demo.firebaseapp.com' ? '' : activeFirebaseConfig.authDomain
  );
  const [storageBucket, setStorageBucket] = useState(
    activeFirebaseConfig.storageBucket === 'bus-app-demo.appspot.com' ? '' : activeFirebaseConfig.storageBucket
  );
  const [appId, setAppId] = useState(
    activeFirebaseConfig.appId.includes('1234567890') ? '' : activeFirebaseConfig.appId
  );
  const [activeTab, setActiveTab] = useState<'config' | 'deploy'>('config');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId.trim() || !apiKey.trim()) {
      alert('Please provide at least a Project ID and Web API Key from your Firebase Console.');
      return;
    }

    saveCustomFirebaseConfig({
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      storageBucket: storageBucket.trim() || `${projectId.trim()}.appspot.com`,
      messagingSenderId: '',
      appId: appId.trim() || `1:${Date.now()}:web:app`
    });
  };

  const handleClear = () => {
    if (confirm('Reset Firebase credentials back to defaults?')) {
      clearCustomFirebaseConfig();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 14,
        maxWidth: 580,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
        border: '1.5px solid #cbd5e1'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Firebase & Firestore Cloud Center
            </h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Manage cloud persistence for routes, destinations, and live website hosting.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-matte"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
          >
            Close
          </button>
        </div>

        {/* Status Banner */}
        <div style={{
          padding: '0.85rem 1.5rem',
          backgroundColor: syncStatus === 'synced' ? '#ecfdf5' : syncStatus === 'connecting' ? '#fef3c7' : '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
              Cloud Route Persistence Status
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', marginTop: '0.1rem' }}>
              {syncStatus === 'synced' && 'Connected to live Firestore. Route and destination edits sync across all devices.'}
              {syncStatus === 'connecting' && 'Connecting to Firestore cloud database...'}
              {syncStatus === 'local_only' && (
                isFirebaseConfigured()
                  ? 'Local Cache active. Attempting connection to Firestore.'
                  : 'Operating in Local Storage cache. Connect your Firebase project below for live cloud sync.'
              )}
            </div>
          </div>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '0.2rem 0.55rem',
            borderRadius: 6,
            backgroundColor: syncStatus === 'synced' ? '#10b981' : syncStatus === 'connecting' ? '#f59e0b' : '#64748b',
            color: '#ffffff',
            textTransform: 'uppercase'
          }}>
            {syncStatus === 'synced' ? 'Cloud Synced' : syncStatus === 'connecting' ? 'Connecting' : 'Local Cache'}
          </span>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 1.5rem', gap: '1rem', background: '#fafafa' }}>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            style={{
              padding: '0.75rem 0',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'config' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              color: activeTab === 'config' ? '#2563eb' : '#64748b',
              cursor: 'pointer'
            }}
          >
            A) Remember Routes in Firestore
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deploy')}
            style={{
              padding: '0.75rem 0',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'deploy' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              color: activeTab === 'deploy' ? '#2563eb' : '#64748b',
              cursor: 'pointer'
            }}
          >
            B) Live Website Hosting
          </button>
        </div>

        {/* Tab 1: Firestore Config */}
        {activeTab === 'config' && (
          <form onSubmit={handleSave} style={{ padding: '1.25rem 1.5rem' }}>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
              Paste your Firebase web project details from the Firebase Console (<strong>Project Settings &gt; General &gt; Your apps &gt; Web app</strong>).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label className="form-label">Firebase Project ID</label>
                <input
                  type="text"
                  className="select-input"
                  placeholder="e.g. tift-bus-tracker"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">Web API Key (apiKey)</label>
                <input
                  type="text"
                  className="select-input"
                  placeholder="e.g. AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Auth Domain (Optional)</label>
                  <input
                    type="text"
                    className="select-input"
                    placeholder="e.g. project.firebaseapp.com"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Storage Bucket (Optional)</label>
                  <input
                    type="text"
                    className="select-input"
                    placeholder="e.g. project.appspot.com"
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">App ID (appId, Optional)</label>
                <input
                  type="text"
                  className="select-input"
                  placeholder="e.g. 1:123456789:web:abcdef"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              {isFirebaseConfigured() ? (
                <button
                  type="button"
                  className="btn-matte"
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  onClick={handleClear}
                >
                  Reset Credentials
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn-matte" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-matte primary">
                  Save & Connect Firestore
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Live Website Hosting */}
        {activeTab === 'deploy' && (
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 600, marginBottom: '0.65rem' }}>
              How to publish this website to Firebase Hosting (Free & Live Worldwide with SSL):
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Step 1: Build the production web app
                </div>
                <pre style={{ margin: '0.35rem 0 0', background: '#0f172a', color: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.72rem' }}>
                  npm run build
                </pre>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Step 2: Log in to Firebase CLI (one-time)
                </div>
                <pre style={{ margin: '0.35rem 0 0', background: '#0f172a', color: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.72rem' }}>
                  npx firebase login
                </pre>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Step 3: Deploy website & Firestore security rules
                </div>
                <pre style={{ margin: '0.35rem 0 0', background: '#0f172a', color: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.72rem' }}>
                  npx firebase deploy --only hosting,firestore:rules
                </pre>
              </div>

              <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: 8, border: '1px solid #6ee7b7' }}>
                <strong style={{ fontSize: '0.76rem', color: '#065f46', display: 'block' }}>
                  Your Live Website URL:
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#047857', display: 'block', marginTop: '0.15rem' }}>
                  https://{activeFirebaseConfig.projectId || '&lt;your-project-id&gt;'}.web.app
                </span>
                <p style={{ fontSize: '0.7rem', color: '#047857', marginTop: '0.35rem' }}>
                  Anyone in Tift County can open this URL on their smartphone or laptop to search bus stops, view real-time arrivals, and follow live routes!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
