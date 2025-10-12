'use client';
import { useEffect, useState } from 'react';
import BinCard from '@/components/BinCard';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  StatsCard, 
  QuickActionsCard, 
  ActivityFeed, 
  SystemHealth, 
  ProgressChart 
} from '@/components/DashboardComponents';
import { Bin } from '@/lib/bins';
import { ChartIcon, TruckIcon, UsersIcon, ShieldIcon, RecycleIcon, LeafIcon } from '@/components/ui/icons';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'bins' | 'users' | 'analytics'>('overview');

  useEffect(() => {
    fetch('/api/bins')
      .then(res => res.json())
      .then(setBins);
  }, []);

  // Calculate stats from bins
  const stats = {
    totalBins: bins.length,
    fullBins: bins.filter(bin => bin.status === 'Full').length,
    normalBins: bins.filter(bin => bin.status === 'Normal').length,
    emptyBins: bins.filter(bin => bin.status === 'Empty').length,
    hazardBins: bins.filter(bin => bin.status === 'Hazard').length,
    avgFillLevel: bins.length > 0 ? Math.round(bins.reduce((sum, bin) => sum + bin.fillLevel, 0) / bins.length) : 0
  };

  const mockActivities = [
    {
      id: '1',
      message: 'Bin BIN001 reported as full and scheduled for pickup',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      type: 'success' as const,
      user: 'System'
    },
    {
      id: '2',
      message: 'Contractor John D. completed pickup for BIN002',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      type: 'success' as const,
      user: 'John Doe'
    },
    {
      id: '3',
      message: 'Hazard detected at BIN003 - requires immediate attention',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      type: 'warning' as const,
      user: 'Safety System'
    },
    {
      id: '4',
      message: 'New citizen registered in the system',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      type: 'info' as const,
      user: 'Registration System'
    }
  ];

  const systemHealth = [
    { name: 'Blockchain Network', status: 'online' as const, lastCheck: new Date(), uptime: '99.9%' },
    { name: 'IoT Sensors', status: 'online' as const, lastCheck: new Date(), uptime: '98.5%' },
    { name: 'Mobile App API', status: 'online' as const, lastCheck: new Date(), uptime: '99.7%' },
    { name: 'Payment Gateway', status: 'warning' as const, lastCheck: new Date(), uptime: '97.2%' },
  ];

  const quickActions = [
    {
      label: '🚨 Emergency Collection',
      onClick: () => alert('Emergency collection protocol activated'),
      variant: 'destructive' as const
    },
    {
      label: '📊 Generate Report',
      onClick: () => alert('Generating monthly report...'),
      variant: 'default' as const
    },
    {
      label: '👥 Manage Users',
      onClick: () => setSelectedView('users')
    },
    {
      label: '🔧 System Settings',
      onClick: () => alert('Opening system settings...')
    }
  ];

  const collectionProgress = [
    { label: 'Today\'s Collections', value: 12, total: 15, color: 'bg-green-500' },
    { label: 'Weekly Target', value: 78, total: 100, color: 'bg-blue-500' },
    { label: 'Monthly Goal', value: 240, total: 400, color: 'bg-purple-500' }
  ];

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Smart Bins"
          value={stats.totalBins}
          change="+2 this week"
          changeType="positive"
          icon={<RecycleIcon className="h-6 w-6 text-blue-600" />}
        />
        <StatsCard
          title="Bins Requiring Pickup"
          value={stats.fullBins}
          change={stats.fullBins > 0 ? 'Urgent' : 'All clear'}
          changeType={stats.fullBins > 0 ? 'negative' : 'positive'}
          icon={<TruckIcon className="h-6 w-6 text-red-600" />}
        />
        <StatsCard
          title="Average Fill Level"
          value={`${stats.avgFillLevel}%`}
          change="+5% from yesterday"
          changeType="neutral"
          icon={<ChartIcon className="h-6 w-6 text-green-600" />}
        />
        <StatsCard
          title="Hazard Alerts"
          value={stats.hazardBins}
          change={stats.hazardBins === 0 ? 'All safe' : 'Action needed'}
          changeType={stats.hazardBins === 0 ? 'positive' : 'negative'}
          icon={<ShieldIcon className="h-6 w-6 text-yellow-600" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Critical Alerts */}
          {(stats.fullBins > 0 || stats.hazardBins > 0) && (
            <Card className="p-6 border-red-200 bg-red-50">
              <CardTitle className="text-lg font-semibold text-red-800 mb-4">
                🚨 Critical Alerts
              </CardTitle>
              <CardContent className="p-0 space-y-3">
                {stats.fullBins > 0 && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <span className="text-red-700">
                      {stats.fullBins} bin{stats.fullBins > 1 ? 's' : ''} requiring immediate pickup
                    </span>
                    <Button size="sm" variant="destructive">
                      Dispatch Now
                    </Button>
                  </div>
                )}
                {stats.hazardBins > 0 && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <span className="text-yellow-700">
                      {stats.hazardBins} hazard alert{stats.hazardBins > 1 ? 's' : ''} detected
                    </span>
                    <Button size="sm" variant="outline">
                      Investigate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Collection Progress */}
          <ProgressChart title="Collection Progress" data={collectionProgress} />
          
          {/* Activity Feed */}
          <ActivityFeed activities={mockActivities} />
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          <QuickActionsCard title="Quick Actions" actions={quickActions} />
          <SystemHealth systems={systemHealth} />
          
          {/* Environmental Impact */}
          <Card className="p-6 bg-green-50 border-green-200">
            <CardTitle className="text-lg font-semibold text-green-800 mb-4 flex items-center">
              <LeafIcon className="h-5 w-5 mr-2" />
              Environmental Impact Today
            </CardTitle>
            <CardContent className="p-0 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-green-700">CO₂ Saved</span>
                <span className="font-bold text-green-800">42kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-green-700">Waste Diverted</span>
                <span className="font-bold text-green-800">156kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-green-700">Energy Saved</span>
                <span className="font-bold text-green-800">89kWh</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderBins = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Smart Bins Management</h2>
          <p className="text-gray-600">Monitor and manage all smart bins in the network</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            🔄 Refresh Data
          </Button>
          <Button size="sm">
            + Add New Bin
          </Button>
        </div>
      </div>
      
      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-red-100 text-red-800">
          Full ({stats.fullBins})
        </Badge>
        <Badge className="bg-green-100 text-green-800">
          Normal ({stats.normalBins})
        </Badge>
        <Badge className="bg-gray-100 text-gray-800">
          Empty ({stats.emptyBins})
        </Badge>
        <Badge className="bg-yellow-100 text-yellow-800">
          Hazard ({stats.hazardBins})
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bins.map((bin) => (
          <BinCard 
            key={bin.id} 
            bin={bin} 
            showActions={true}
            onAction={(binId, action) => {
              console.log(`Admin action: ${action} for bin ${binId}`);
              alert(`Admin performed ${action} for bin ${binId}`);
            }}
          />
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (selectedView) {
      case 'bins': return renderBins();
      case 'users': return (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">User Management</h2>
          <p className="text-gray-600 mb-4">Coming soon - Advanced user management features</p>
          <Button onClick={() => setSelectedView('overview')}>← Back to Overview</Button>
        </div>
      );
      case 'analytics': return (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Advanced Analytics</h2>
          <p className="text-gray-600 mb-4">Coming soon - Detailed analytics and reporting</p>
          <Button onClick={() => setSelectedView('overview')}>← Back to Overview</Button>
        </div>
      );
      default: return renderOverview();
    }
  };

  return (
    <DashboardLayout title="Administrator Dashboard" userType="admin">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
          {[
            { key: 'overview', label: '📊 Overview', icon: ChartIcon },
            { key: 'bins', label: '🗑️ Smart Bins', icon: RecycleIcon },
            { key: 'users', label: '👥 Users', icon: UsersIcon },
            { key: 'analytics', label: '📈 Analytics', icon: ChartIcon }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedView(tab.key as 'overview' | 'bins' | 'users' | 'analytics')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedView === tab.key
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Main Content */}
        {renderContent()}
      </div>
    </DashboardLayout>
  );
}
