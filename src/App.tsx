import { useState } from 'react';
import { Bus } from 'lucide-react';
import { useBusTracker } from './useBusTracker';
import { MapView } from './MapView';
import { StudentStopFinder } from './StudentStopFinder';
import { AdminPortal } from './AdminPortal';
import { FirebaseSettingsModal } from './FirebaseSettingsModal';

export default function App() {
  const {
    routes,
    selectedRoute,
    changeRoute,
    busData,
    targetStopId,
    setTargetStopId,
    bouncieConnected,
    firestoreSyncStatus,
    findRoutesByStop,
    selectStopAndFocus,
    saveRoute,
    deleteRoute,
    resetRoutes,
    allStops
  } = useBusTracker();

  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState<boolean>(false);

  // When a student selects a stop from the finder
  const handleSelectRouteAndStop = (routeId: string, stopId: string) => {
    selectStopAndFocus(routeId, stopId);
  };

  // Find target stop details if selected
  const activeTargetStop = selectedRoute?.stops.find((s) => s.id === targetStopId) || null;

  return (
    <div className="school-layout">
      {/* Universal Top Navigation Header */}
      <header className="app-navbar">
        <div className="brand-title">
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(245, 158, 11, 0.4)'
          }}>
            <Bus size={22} color="#78350f" />
          </div>
          <div>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Trackify
            </span>
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <div className="nav-tab-group">
          <button
            className={`nav-tab-btn ${activeTab === 'student' ? 'active' : ''}`}
            onClick={() => setActiveTab('student')}
          >
            Find & Track Bus
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Route Admin Portal
          </button>
        </div>

        {/* Right Status Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Cloud Firestore Sync Status Button */}
          <button
            type="button"
            onClick={() => setIsFirebaseModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              background: firestoreSyncStatus === 'synced' ? '#ecfdf5' : '#f8fafc',
              border: `1px solid ${firestoreSyncStatus === 'synced' ? '#a7f3d0' : '#cbd5e1'}`,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: firestoreSyncStatus === 'synced' ? '#065f46' : '#475569',
              cursor: 'pointer'
            }}
            title="Click to view Firebase & Firestore Cloud Sync settings"
          >
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: firestoreSyncStatus === 'synced' ? '#10b981' : firestoreSyncStatus === 'connecting' ? '#f59e0b' : '#94a3b8',
              display: 'inline-block'
            }} />
            <span>{firestoreSyncStatus === 'synced' ? 'Firestore Live' : firestoreSyncStatus === 'connecting' ? 'Connecting...' : 'Cloud Standby'}</span>
          </button>

          {/* Bouncie GPS Source Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '6px',
            background: bouncieConnected ? '#ecfdf5' : '#f1f5f9',
            border: `1px solid ${bouncieConnected ? '#a7f3d0' : '#e2e8f0'}`,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: bouncieConnected ? '#065f46' : '#475569'
          }} title={bouncieConnected ? 'Connected to live Bouncie vehicle GPS' : 'Bouncie API Standby / Simulation Active'}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: bouncieConnected ? '#059669' : '#b45309',
              display: 'inline-block'
            }} />
            <span>{bouncieConnected ? 'Bouncie GPS Live' : 'GPS Active'}</span>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      {activeTab === 'student' ? (
        <div className="main-app-body">
          {/* Left Student & Parent Control Sidebar - Clean, Simple, Secure */}
          <aside className="sidebar-panel">
            <div className="sidebar-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge-tag">
                  Student & Parent Portal
                </span>
                <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                  ● Live Transit
                </span>
              </div>
            </div>

            <div className="sidebar-content">
              {/* Feature 1: Student Stop Input & Automatic Route Decision */}
              <StudentStopFinder
                routes={routes}
                onSelectRouteAndStop={handleSelectRouteAndStop}
                findRoutesByStop={findRoutesByStop}
                allStops={allStops}
              />

              {/* Clean Student & Parent Bus Arrival Card */}
              <div className="school-card highlight" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                      {activeTargetStop ? 'Your Morning Pickup Stop' : 'Next Approaching Stop'}
                    </span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                      {activeTargetStop ? activeTargetStop.name : busData.nextStop}
                    </h3>
                    {activeTargetStop?.address && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {activeTargetStop.address}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Arrival Time
                    </span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em' }}>
                      ~{busData.etaMinutes}m
                    </div>
                  </div>
                </div>

                {/* Clean Bus Details */}
                <div style={{
                  marginTop: '0.9rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Assigned: </span>
                    <strong style={{ color: '#0f172a' }}>{selectedRoute?.busNumber || busData.vehicleName}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({selectedRoute?.driverName || 'District Driver'})</span>
                  </div>
                  <span className="status-pill" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                    {busData.status}
                  </span>
                </div>

                {/* Scheduled Time info */}
                {activeTargetStop && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 600 }}>
                    Scheduled Pickup: <strong>{activeTargetStop.scheduledTime}</strong>
                  </div>
                )}

                {/* Destination School */}
                {selectedRoute?.destinationSchool && (
                  <div style={{ marginTop: '0.45rem', fontSize: '0.73rem', color: '#1e40af', fontWeight: 700 }}>
                    Destination: <strong>{selectedRoute.destinationSchool}</strong>
                  </div>
                )}
              </div>

              {/* Quick Parent Notification Toggle */}
              <div className="school-card" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a', display: 'block' }}>Arrival Alerts</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Notify me 5 mins before bus arrives
                    </div>
                  </div>
                  <button
                    className={`btn-matte ${notificationsEnabled ? 'primary' : ''}`}
                    style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => {
                      setNotificationsEnabled(!notificationsEnabled);
                      if (!notificationsEnabled) {
                        alert('Arrival alerts enabled! You will be notified when your bus is approaching your stop.');
                      }
                    }}
                  >
                    {notificationsEnabled ? 'Alerts ON' : 'Turn ON'}
                  </button>
                </div>
              </div>

              {/* Status and Last Ping Footer */}
              <div style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.25rem'
              }}>
                <span>Last GPS Ping: {busData.lastUpdated}</span>
              </div>
            </div>
          </aside>

          {/* Main Map View Area - Google Maps */}
          <main className="map-viewport">
            {selectedRoute && (
              <MapView
                activeBus={busData}
                route={selectedRoute}
                targetStopId={targetStopId}
                onSelectStop={(stop) => {
                  setTargetStopId(stop.id);
                }}
              />
            )}
          </main>
        </div>
      ) : (
        /* Full-page Route Admin Portal Mode */
        <main className="admin-full-page">
          <AdminPortal
            routes={routes}
            onSaveRoute={saveRoute}
            onDeleteRoute={deleteRoute}
            onResetDefaults={resetRoutes}
            onSelectRoute={(id) => changeRoute(id)}
            onSwitchToStudentView={() => setActiveTab('student')}
            firestoreSyncStatus={firestoreSyncStatus}
            onOpenFirebaseSettings={() => setIsFirebaseModalOpen(true)}
          />
        </main>
      )}

      {/* Firebase Cloud & Deployment Settings Modal */}
      <FirebaseSettingsModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        syncStatus={firestoreSyncStatus}
      />
    </div>
  );
}
